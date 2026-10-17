// One native program per missing-window batch; normalized facts share the byte owner.
import { z } from "zod";
import { hex } from "./api-contracts.mjs";
import { normalizeByteFacts, parseByteSourceJson } from "./byte-facts.mjs";
import { FactFailure, projectFactFailure } from "./fact-error.mjs";
import { freezeFacts, sourceSummary } from "./fact-reads.mjs";
import {
  MAX_BYTE_BATCH_BYTES,
  MAX_BYTE_WINDOWS,
  NATIVE_OUTPUT_BYTES,
} from "./limits.mjs";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const document = z.strictObject({
  schema_version: z.literal(1),
  binary: z.string(),
  window_count: count.min(1).max(MAX_BYTE_WINDOWS),
  program_loads: z.literal(1),
  output_bytes: count.min(1).max(NATIVE_OUTPUT_BYTES),
  windows: z.array(z.unknown()).min(1).max(MAX_BYTE_WINDOWS),
});
const identity = {
  source_row: count,
  request_address_hex: hex,
  requested_bytes: count.min(1).max(MAX_BYTE_BATCH_BYTES),
};
const window = z.discriminatedUnion("ok", [
  z.strictObject({ ...identity, ok: z.literal(true), result: z.unknown() }),
  z.strictObject({
    ...identity,
    ok: z.literal(false),
    error: z.strictObject({
      code: z.literal("window_unavailable"),
      message: z.string(),
    }),
  }),
]);
const counterKeys = [
  "schema_version",
  "window_count",
  "program_loads",
  "output_bytes",
  "source_row",
  "requested_bytes",
];
const key = (request) => `${request.address}:${request.length}`;
const failure = (cause, source, sourceRow) => {
  const error =
    cause instanceof z.ZodError
      ? {
          code: "invalid_provider_output",
          message: "Native byte batch has an invalid format",
          details: { reason: cause.issues[0]?.message.slice(0, 256) },
        }
      : projectFactFailure(cause, "invalid_provider_output");
  return {
    ...error,
    details: {
      ...error.details,
      ...(source
        ? { evidence_id: source.evidence_id, source_retained: true }
        : {}),
      ...(sourceRow === undefined ? {} : { source_row: sourceRow }),
    },
  };
};

export function parseNativeByteBatch(text, capture, requests) {
  let doc;
  try {
    doc = document.parse(parseByteSourceJson(text, counterKeys));
    if (
      doc.binary !== capture.input ||
      doc.output_bytes !== capture.output_bytes ||
      Buffer.byteLength(text) > doc.output_bytes ||
      doc.window_count !== requests.length ||
      doc.windows.length !== requests.length
    )
      throw new FactFailure(
        "invalid_provider_output",
        "Native byte batch does not match its capture request",
      );
  } catch (cause) {
    const error = failure(cause, capture.source);
    throw new FactFailure(error.code, error.message, error.details);
  }
  return doc.windows.map((value, index) => {
    const request = requests[index];
    try {
      const row = window.parse(value);
      if (
        row.source_row !== index ||
        row.request_address_hex !== request.address ||
        row.requested_bytes !== request.length
      )
        throw new FactFailure(
          "invalid_provider_output",
          "Native byte row describes a different requested window",
        );
      if (!row.ok)
        return {
          ok: false,
          address: request.address,
          error: failure(
            new FactFailure(row.error.code, row.error.message),
            capture.source,
            index,
          ),
        };
      return {
        ok: true,
        address: request.address,
        source_row: index,
        source: sourceSummary(capture.source),
        ...normalizeByteFacts(row.result, capture.input, request),
      };
    } catch (cause) {
      return {
        ok: false,
        address: request.address,
        error: failure(cause, capture.source, index),
      };
    }
  });
}

export class NativeByteBatchReads {
  #loaded = new Map();
  constructor(capture, readSource) {
    Object.assign(this, { capture, readSource });
  }
  clear() {
    this.#loaded.clear();
  }
  async read(input, signal) {
    const current = new Map(
      input.windows.flatMap((request) => {
        const id = key(request),
          loaded = this.#loaded.get(id);
        return loaded ? [[id, loaded]] : [];
      }),
    );
    const missing = [
      ...new Map(
        input.windows
          .filter((r) => !current.has(key(r)))
          .map((r) => [key(r), r]),
      ).values(),
    ];
    if (missing.length) {
      try {
        const selection = missing
          .map((r) => `${r.address}:${r.length}`)
          .join(",");
        const capture = await this.capture(
          "byte-batch:" + selection,
          (path, outputBytes) => [
            "read",
            path,
            "--atomic-windows",
            selection,
            "--json",
            "--atomic-output-bytes",
            String(outputBytes),
          ],
          signal,
        );
        const rows = parseNativeByteBatch(
          await this.readSource(capture.source.evidence_id),
          capture,
          missing,
        );
        for (const [index, row] of rows.entries()) {
          const id = key(missing[index]),
            frozen = freezeFacts(row);
          current.set(id, frozen);
          if (row.ok || row.error.code === "window_unavailable")
            this.#loaded.set(id, frozen);
        }
      } catch (cause) {
        for (const request of missing)
          current.set(key(request), {
            ok: false,
            address: request.address,
            error: failure(cause),
          });
      }
    }
    return {
      results: input.windows.map((r) => structuredClone(current.get(key(r)))),
    };
  }
}
