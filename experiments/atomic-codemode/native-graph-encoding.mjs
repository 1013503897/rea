// The wire owner validates the archive before normal graph-row admission.
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { requireFact } from "./native-contract.mjs";
import { NATIVE_OUTPUT_BYTES } from "./limits.mjs";

export const MAX_GRAPH_JSON_BYTES = 32 * 1024 * 1024;
const envelope = z.strictObject({
  schema_version: z.literal(4),
  encoding: z.literal("gzip-base64"),
  raw_bytes: z.number().int().min(1).max(MAX_GRAPH_JSON_BYTES),
  data: z.string().max(NATIVE_OUTPUT_BYTES),
});
export function decodeGraphArchive(raw) {
  if (raw?.schema_version !== 4) return undefined;
  const encoded = envelope.parse(raw);
  requireFact(
    encoded.data.length > 0 &&
      encoded.data.length % 4 === 0 &&
      /^[A-Za-z0-9+/]*={0,2}$/u.test(encoded.data),
    "Native compressed graph has invalid base64",
  );
  const bytes = Buffer.from(encoded.data, "base64");
  requireFact(
    bytes.toString("base64") === encoded.data,
    "Native compressed graph has noncanonical base64",
  );
  // The native-declared length is admitted before inflation, not checked only
  // after an unbounded allocation. Node also verifies the gzip framing/CRC.
  const decoded = gunzipSync(bytes, { maxOutputLength: encoded.raw_bytes });
  requireFact(
    decoded.length === encoded.raw_bytes,
    "Native compressed graph length differs from its declaration",
  );
  return new TextDecoder("utf-8", { fatal: true }).decode(decoded);
}
