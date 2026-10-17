// Native query protocol stays at the provider boundary; shared facts own normalization.
import { z } from "zod";
import { requireNativeCaptureFacts } from "./native-capture-facts.mjs";
import { MAX_RETAINED_SOURCE_BYTES } from "./limits.mjs";
import {
  KunaJsonDocumentReader,
  parseKunaRow,
} from "../../dist/kuna/KunaJsonStream.js";
import {
  kunaStringFactFieldsSchema,
  normalizeKunaStringFact,
} from "../../dist/kuna/KunaStringFacts.js";
import { FactFailure } from "./fact-error.mjs";
import { freezeFacts, projectFact, sourceSummary } from "./fact-reads.mjs";

// Linux x86-64 MAX_ARG_STRLEN is 32 base pages, including NUL. This experimental
// profile is explicitly restricted to that host; 4,096-byte pages were verified.
const MAX_LITERAL_ARGUMENT_BYTES = 128 * 1024;
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const row = kunaStringFactFieldsSchema.omit({ address: true }).extend({
  address_hex: kunaStringFactFieldsSchema.shape.address,
  source_row: count,
  section: z.string().nullable(),
});
const header = z.object({
  schema_version: z.literal(1),
  binary: z.string(),
  query_utf16le_hex: z.string(),
  encoding: z.literal("all"),
  min_length: z.literal(5),
  section: z.null(),
  termination: z.literal("any"),
  scanned: z.enum(["sections", "segments"]),
  xrefs: z.literal(false),
  examined_rows: count,
  total: count,
  offset: count,
  limit: count,
  next_offset: count.nullable(),
  text_requested: z.boolean(),
  text_included: z.boolean(),
  output_bytes: count.min(1).max(MAX_RETAINED_SOURCE_BYTES),
  status: z.enum(["complete", "text-omitted"]),
  required_encoded_bytes_at_least: count.nullable(),
});
const document = (text) => ({
  header: new Set(Object.keys(header.shape)),
  sections: new Map(),
  rows: new Map([
    [
      "items",
      {
        fields: new Set(Object.keys(row.shape)),
        addresses: new Set(),
        empty: new Set(),
        nulls: text ? new Set() : new Set(["text"]),
      },
    ],
  ]),
});
export function nativeStringQueryInput(input) {
  const bytes = input.query.length * 4 + 1;
  if (bytes > MAX_LITERAL_ARGUMENT_BYTES)
    throw new FactFailure(
      "resource_constraint",
      "Literal query exceeds this Linux profile's single-argument capacity",
      {
        scope: "native_query_argument",
        required_bytes: bytes,
        limit_bytes: MAX_LITERAL_ARGUMENT_BYTES,
      },
    );
  return {
    hex: Buffer.from(input.query, "utf16le").toString("hex"),
    text: input.fields === undefined || input.fields.includes("value"),
    offset: input.offset,
    limit: input.limit,
    query: input.query,
  };
}
export class NativeStringQueryReader extends KunaJsonDocumentReader {
  #items = [];
  #seen = new Set();
  constructor(request, outputBytes) {
    super(
      "kuna:atomic-string-query",
      "Native string query",
      document(request.text),
    );
    this.request = request;
    this.outputBytes = outputBytes;
  }
  acceptRow(_name, fields) {
    if (this.#items.length >= this.request.limit)
      throw new Error("native query exceeds the requested page");
    const entry = parseKunaRow(row, "string query", fields);
    const normalized = normalizeKunaStringFact({
      ...entry,
      address: entry.address_hex,
    });
    if (entry.text !== undefined && !entry.text.includes(this.request.query))
      throw new Error("native string does not match the literal query");
    const identity = normalized.address + ":" + normalized.string.encoding;
    if (this.#seen.has(identity))
      throw new Error("native query repeats a string identity");
    this.#seen.add(identity);
    this.#items.push({ ...normalized, source_row: entry.source_row });
  }
  discardRows() {
    this.#items.length = 0;
    this.#seen.clear();
  }
  #checkHeader(meta, input) {
    const request = this.request;
    if (
      meta.binary !== input ||
      meta.query_utf16le_hex !== request.hex ||
      meta.offset !== request.offset ||
      meta.limit !== request.limit ||
      meta.text_requested !== request.text ||
      meta.output_bytes !== this.outputBytes
    )
      throw new Error(
        "native string query does not describe the requested capture",
      );
    const returned = Math.min(
      request.limit,
      Math.max(0, meta.total - request.offset),
    );
    const next =
      request.offset + returned < meta.total ? request.offset + returned : null;
    if (
      meta.total > meta.examined_rows ||
      this.#items.length !== returned ||
      meta.next_offset !== next
    )
      throw new Error("native string query counts or pagination disagree");
    const omitted = request.text && !meta.text_included;
    if (
      (omitted &&
        (meta.status !== "text-omitted" ||
          meta.required_encoded_bytes_at_least === null ||
          meta.required_encoded_bytes_at_least <= meta.output_bytes)) ||
      (!omitted &&
        (meta.status !== "complete" ||
          meta.required_encoded_bytes_at_least !== null)) ||
      (!request.text && meta.text_included)
    )
      throw new Error("native query omission and failure status disagree");
  }
  #checkRows(meta) {
    let previous = -1;
    let previousAddress = -1n;
    let previousEncoding = "";
    for (const item of this.#items) {
      const address = BigInt(item.address);
      if (
        item.source_row <= previous ||
        item.source_row >= meta.examined_rows ||
        address < previousAddress ||
        (address === previousAddress &&
          item.string.encoding <= previousEncoding) ||
        Object.hasOwn(item, "value") !== meta.text_included
      )
        throw new Error(
          "native row provenance or text presence contradicts the query",
        );
      previous = item.source_row;
      previousAddress = address;
      previousEncoding = item.string.encoding;
    }
  }
  finish(input) {
    const completed = this.complete();
    if (!completed.ok) return completed;
    try {
      const meta = parseKunaRow(
        header,
        "string query header",
        completed.value.header,
      );
      this.#checkHeader(meta, input);
      this.#checkRows(meta);
      return {
        ok: true,
        value: freezeFacts({
          items: this.#items,
          meta,
          sha256: completed.value.sha256,
          bytes: completed.value.bytes,
        }),
      };
    } catch (cause) {
      return {
        ok: false,
        error: this.unusable(cause.message ?? String(cause)),
      };
    }
  }
}

export class NativeStringQueryReads {
  #loaded = new Map();
  constructor(capture) {
    this.capture = capture;
  }
  clear() {
    this.#loaded.clear();
  }
  async read(input, signal) {
    const request = nativeStringQueryInput(input),
      base = JSON.stringify([request.hex, request.offset, request.limit]);
    const key = base + ":" + Number(request.text),
      fullKey = base + ":1";
    let loaded =
      this.#loaded.get(key) ??
      (!request.text ? this.#loaded.get(fullKey) : undefined);
    if (!loaded) {
      const capture = await this.capture(
        "string-query:" + key,
        (path, outputBytes) => [
          "strings",
          path,
          "--json",
          "--encoding",
          "all",
          "--min-length",
          "5",
          "--termination",
          "any",
          "--no-xrefs",
          "--atomic-literal-utf16le-hex",
          request.hex,
          "--atomic-offset",
          String(request.offset),
          "--atomic-limit",
          String(request.limit),
          "--atomic-output-bytes",
          String(outputBytes),
          ...(request.text ? [] : ["--atomic-metadata-only"]),
        ],
        signal,
        (outputBytes) => new NativeStringQueryReader(request, outputBytes),
      );
      const facts = requireNativeCaptureFacts(capture);
      loaded = { facts, source: Object.freeze(sourceSummary(capture.source)) };
      this.#loaded.set(key, loaded);
    }
    const { facts, source } = loaded;
    const data = {
      source,
      items: facts.items.map((item) =>
        projectFact(item, input.fields, ["address", "string", "source_row"]),
      ),
      total: facts.meta.total,
      next_offset: facts.meta.next_offset,
      coverage: {
        scope: "native candidate inventory, minimum 5, any termination",
        scanned: facts.meta.scanned,
        examined: facts.meta.examined_rows,
        native_selection: "complete",
        matching: "literal_utf16",
        source_scope: "selected query report",
        artifact_discovery: "unknown",
        reference_attribution: "not-computed",
        source_text: facts.meta.text_included
          ? "included"
          : facts.meta.text_requested
            ? "omitted-by-budget"
            : "not-requested",
      },
    };
    if (request.text && !facts.meta.text_included)
      throw new FactFailure(
        "resource_constraint",
        "Selected string text exceeds the native query output budget",
        {
          scope: "native_query_output",
          limit_bytes: facts.meta.output_bytes,
          required_encoded_bytes_at_least:
            facts.meta.required_encoded_bytes_at_least,
          evidence_id: source.evidence_id,
          source_retained: true,
          partial_observation: data,
          omitted_fields: ["value"],
        },
      );
    return data;
  }
}
