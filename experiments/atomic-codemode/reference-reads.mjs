// Shared native reference selection; adapters never reinterpret wire endpoints.
import { parseKunaReferenceFacts } from "../../dist/kuna/KunaReferenceFiles.js";
import { pageFacts } from "./fact-reads.mjs";
import { FactFailure, requireResult } from "./fact-error.mjs";
import { parseKunaReferenceRanges } from "../../dist/kuna/KunaReferenceRanges.js";
import {
  freezeFacts,
  projectFact,
  readFactBatch,
  sourceSummary,
} from "./fact-reads.mjs";
import { NATIVE_OUTPUT_BYTES } from "./limits.mjs";

export class NativeReferenceReads {
  #lastRange;
  constructor(capture, readSource, requireRanges) {
    this.capture = capture;
    this.readSource = readSource;
    this.requireRanges = requireRanges;
  }
  clear() {
    this.#lastRange = undefined;
  }
  async read(input, signal) {
    if (input.ranges) return this.#ranges(input, signal);
    return readFactBatch(
      input.addresses.map((address) => referenceReader.query(input, address)),
      (query) =>
        this.capture(
          referenceReader.key(query),
          (path) => referenceReader.arguments(path, query),
          signal,
        ),
      async (capture, query) =>
        referenceReader.read(
          await this.readSource(capture.source.evidence_id),
          capture.input,
          query,
          input,
        ),
    );
  }
  async #ranges(input, signal) {
    this.requireRanges();
    const capture = await this.capture(
      `xref-ranges:${JSON.stringify([input.ranges, input.kinds, input.offset, input.limit])}`,
      (path) => [
        "xrefs",
        path,
        ...input.ranges.flatMap((r) => [
          "--to-range",
          `${r.start}:${r.end_inclusive}`,
        ]),
        "--offset",
        String(input.offset),
        "--limit",
        String(input.limit),
        "--output-bytes",
        String(NATIVE_OUTPUT_BYTES),
        ...(input.kinds ? ["--kind", input.kinds.join(",")] : []),
        "--json",
      ],
      signal,
    );
    if (this.#lastRange?.source.evidence_id !== capture.source.evidence_id) {
      try {
        const facts = requireResult(
          parseKunaReferenceRanges(
            await this.readSource(capture.source.evidence_id),
            capture.input,
            input,
          ),
          "invalid_provider_output",
        );
        this.#lastRange = freezeFacts({
          facts,
          source: sourceSummary(capture.source),
        });
      } catch (error) {
        throw new FactFailure(
          error.code ?? "invalid_provider_output",
          error.message,
          {
            ...error.details,
            evidence_id: capture.source.evidence_id,
            source_retained: true,
          },
        );
      }
    }
    const { facts, source } = this.#lastRange;
    return {
      results: facts.results.map((page) => ({
        ok: true,
        range: { ...page.range },
        range_index: page.range_index,
        items: page.facts.map((row) =>
          projectFact(row, input.fields, ["source_row", "from", "to", "kind"]),
        ),
        total: page.total,
        next_offset: page.next_offset,
        source,
        coverage: {
          direction: "incoming",
          scope: "target-address membership in the inclusive static image span",
          examined_rows: page.total,
          returned_rows: page.facts.length,
          alias_expansion: "not-applied",
          discovery: "unknown",
          indirect_targets: "unknown",
          machine_semantic_equivalence: "unknown",
          runtime_binding: "unknown",
          memory_access_overlap: "not-established",
          whole_string_use: "not-established",
        },
      })),
    };
  }
}

export const referenceReader = {
  query: (input, address) => ({
    address,
    direction: input.direction === "incoming" ? "to" : "from",
    scope: input.scope,
    kinds: input.kinds,
  }),
  // Scope/fields/pages select the same native source; do not re-run its analysis.
  key: (query) =>
    `xref:${JSON.stringify([query.direction, query.address, query.kinds])}`,
  arguments: (path, query) => [
    "xrefs",
    path,
    `--${query.direction}`,
    query.address,
    ...(query.kinds ? ["--kind", query.kinds.join(",")] : []),
    "--json",
  ],
  read: (text, path, query, input) => {
    const parsed = requireResult(
      parseKunaReferenceFacts(text, path, query),
      "invalid_provider_output",
    );
    return {
      ...pageFacts(parsed.facts, input, ["source_row", "from", "to", "kind"]),
      coverage: {
        direction: query.direction === "to" ? "incoming" : "outgoing",
        scope:
          query.scope === "function"
            ? "native owning-function references"
            : "exact address; not an object extent",
        function_scope: parsed.functionScope,
        examined_rows: parsed.rows,
        excluded_alias_rows: parsed.excludedAliasRows,
        excluded_scope_rows: parsed.excludedScopeRows,
        unattributed_scope_rows: parsed.unattributedScopeRows,
        discovery: "unknown",
        indirect_targets: "unknown",
        machine_semantic_equivalence: "unknown",
        runtime_binding: "unknown",
      },
    };
  },
};
