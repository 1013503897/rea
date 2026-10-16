// The machine-decoding boundary is separate from optimized recovered IR.
import { z } from "zod";
import { FactFailure } from "./fact-error.mjs";

const hex = z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u);
const rowSchema = z.object({
  address_hex: hex,
  size: z.number().int().positive().max(65536),
  bytes: z.string().regex(/^(?:[0-9a-f]{2})+$/u),
  mnemonic: z.string(),
  operands: z.string(),
  text: z.string(),
});
const envelopeSchema = z.object({
  binary: z.string(),
  kind: z.literal("code"),
  start_hex: hex,
  end_hex: hex,
  count: z.number().int().nonnegative().max(4096),
  bytes: z.number().int().nonnegative(),
  truncated: z.boolean(),
  notes: z.array(z.string()),
});
const requireFact = (condition, message) => {
  if (!condition) throw new FactFailure("invalid_provider_output", message);
};

export function parseInstructions(
  text,
  inputPath,
  request,
  fields = ["bytes", "text"],
) {
  try {
    requireFact(
      Buffer.byteLength(text) <= 8 * 1024 * 1024,
      "Instruction source exceeds transport capacity",
    );
    const raw = JSON.parse(text);
    requireFact(
      Array.isArray(raw?.instructions) && raw.instructions.length <= 4096,
      "Instruction window exceeds decoded-row capacity",
    );
    const doc = envelopeSchema.parse(raw);
    requireFact(
      doc.binary === inputPath && doc.start_hex === request.address,
      "Instruction source does not match the selected input/window",
    );
    requireFact(
      doc.count === raw.instructions.length && doc.count <= request.count,
      "Instruction count does not match the requested window",
    );
    let next = BigInt(request.address);
    const items = raw.instructions.map((value) => {
      const row = rowSchema.parse(value);
      requireFact(
        BigInt(row.address_hex) === next && row.bytes.length === row.size * 2,
        "Instruction bytes/size or sequential address mismatch",
      );
      next += BigInt(row.size);
      const fact = {
        address: row.address_hex,
        size: row.size,
        status: row.mnemonic === ".byte" ? "undecoded" : "decoded",
        bytes: row.bytes,
        mnemonic: row.mnemonic,
        operands: row.operands,
        text: row.text,
      };
      return Object.fromEntries(
        [...new Set(["address", "size", "status", ...fields])].map((key) => [
          key,
          fact[key],
        ]),
      );
    });
    requireFact(
      next === BigInt(doc.end_hex) &&
        next - BigInt(request.address) === BigInt(doc.bytes),
      "Instruction window end/byte coverage mismatch",
    );
    return {
      items,
      resume_address: doc.end_hex,
      coverage: {
        authority: "machine bytes and native linear decoding; not recovered IR",
        request,
        listed_count: items.length,
        truncated: doc.truncated,
        notes: doc.notes,
        alignment:
          "caller-selected start; runtime execution and instruction alignment are not established",
      },
    };
  } catch (error) {
    if (error instanceof FactFailure) throw error;
    throw new FactFailure(
      "invalid_provider_output",
      "Native instruction window does not match the declared format",
      {
        reason:
          error instanceof z.ZodError
            ? error.issues[0]?.message.slice(0, 256)
            : String(error.message).slice(0, 256),
      },
    );
  }
}
