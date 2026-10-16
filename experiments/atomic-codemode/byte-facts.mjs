// Native loaded-image data is not instruction decoding or original-file mapping.
import { z } from "zod";
import { FactFailure } from "./fact-error.mjs";
import { MAX_BYTE_BATCH_BYTES, NATIVE_OUTPUT_BYTES } from "./limits.mjs";

const hex = z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u);
const payload = z.string().regex(/^(?:[0-9a-f]{2})*$/u);
const header = z.object({
  binary: z.string(),
  kind: z.literal("data"),
  start_hex: hex,
  end_hex: hex,
  count: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_BYTE_BATCH_BYTES / 16),
  bytes: z.number().int().nonnegative().max(MAX_BYTE_BATCH_BYTES),
  hex: payload,
  truncated: z.boolean(),
  notes: z.array(z.string()),
});
const row = z.object({
  address_hex: hex,
  size: z.number().int().min(1).max(16),
  bytes: payload,
});
const requireFact = (valid, message) => {
  if (!valid) throw new FactFailure("invalid_provider_output", message);
};

export function parseByteFacts(text, inputPath, request) {
  try {
    requireFact(
      Buffer.byteLength(text) <= NATIVE_OUTPUT_BYTES,
      "Byte source exceeds capture capacity",
    );
    const raw = JSON.parse(text);
    requireFact(
      Array.isArray(raw?.rows) && raw.rows.length <= MAX_BYTE_BATCH_BYTES / 16,
      "Byte rows exceed capacity or have invalid shape",
    );
    const doc = header.parse(raw);
    requireFact(
      doc.binary === inputPath && doc.start_hex === request.address,
      "Byte source names a different target/window",
    );
    requireFact(
      doc.bytes <= request.length && doc.count === raw.rows.length,
      "Byte source exceeds the request or disagrees with row count",
    );
    let end = BigInt(request.address);
    const pieces = raw.rows.map((value, index) => {
      const item = row.parse(value);
      requireFact(
        BigInt(item.address_hex) === end && item.bytes.length === item.size * 2,
        "Byte row address/length is inconsistent",
      );
      requireFact(
        index === raw.rows.length - 1 || item.size === 16,
        "Nonfinal byte row is not the declared native width",
      );
      end += BigInt(item.size);
      return item.bytes;
    });
    requireFact(
      end === BigInt(doc.end_hex) &&
        end - BigInt(request.address) === BigInt(doc.bytes) &&
        pieces.join("") === doc.hex &&
        doc.hex.length === doc.bytes * 2,
      "Byte rows, payload and extent disagree",
    );
    return {
      hex: doc.hex,
      returned_bytes: doc.bytes,
      end_address: doc.end_hex,
      coverage: {
        authority: "native loaded-image bytes",
        requested_bytes: request.length,
        status:
          doc.bytes === request.length
            ? "complete-for-requested-range"
            : "partial",
        provider_truncated: doc.truncated,
        notes: doc.notes,
        original_file_mapping: "unknown",
        runtime_memory: "not-observed",
      },
    };
  } catch (error) {
    if (error instanceof FactFailure) throw error;
    throw new FactFailure(
      "invalid_provider_output",
      "Native byte window does not match the declared format",
      {
        reason:
          error instanceof z.ZodError
            ? error.issues[0]?.message.slice(0, 256)
            : String(error.message).slice(0, 256),
      },
    );
  }
}
