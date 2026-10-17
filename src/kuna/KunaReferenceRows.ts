// Provider wire endpoints and normalized facts have one interpretation.
import { z } from "zod";
export const kunaReferenceAddressKeys = new Set([
  "address",
  "from_address",
  "to_address",
]);
export const kunaReferenceAddressSchema = z
  .string()
  .regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u);
export const kunaReferenceCountSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
export const kunaReferenceKindSchema = z.enum([
  "call",
  "jump",
  "data",
  "read",
  "write",
]);
const address = kunaReferenceAddressSchema,
  kind = kunaReferenceKindSchema;
export const kunaReferenceFunctionSchema = z.object({
  name: z.string().min(1),
  address,
  address_hex: address,
});
export const kunaReferenceRowSchema = z.object({
  address,
  address_hex: address,
  kind,
  from_address: address,
  from_address_hex: address,
  to_address: address,
  to_address_hex: address,
  from_function: kunaReferenceFunctionSchema.nullable(),
  to_function: kunaReferenceFunctionSchema.nullable(),
  instruction: z.string(),
});
export const validateKunaReferenceRow = <
  T extends z.infer<typeof kunaReferenceRowSchema>,
>(
  row: T,
  direction: "to" | "from",
): T => {
  if (
    row.address !== row.address_hex ||
    row.address !== (direction === "to" ? row.from_address : row.to_address) ||
    row.from_address !== row.from_address_hex ||
    row.to_address !== row.to_address_hex
  )
    throw new Error(
      "xref endpoints disagree with numeric or directional fields",
    );
  for (const fn of [row.from_function, row.to_function])
    if (fn !== null && fn.address !== fn.address_hex)
      throw new Error("xref function address disagrees with its hex field");
  return row;
};

export type KunaReferenceFact = {
  readonly source_row: number;
  readonly from: string;
  readonly to: string;
  readonly kind: z.infer<typeof kind>;
  readonly fromFunction: {
    readonly address: string;
    readonly name: string;
  } | null;
  readonly toFunction: {
    readonly address: string;
    readonly name: string;
  } | null;
  readonly instruction: string;
};

export const kunaReferenceFact = (
  row: z.infer<typeof kunaReferenceRowSchema>,
  source_row: number,
): KunaReferenceFact => ({
  source_row,
  from: row.from_address,
  to: row.to_address,
  kind: row.kind,
  fromFunction:
    row.from_function === null
      ? null
      : {
          address: row.from_function.address,
          name: row.from_function.name,
        },
  toFunction:
    row.to_function === null
      ? null
      : {
          address: row.to_function.address,
          name: row.to_function.name,
        },
  instruction: row.instruction,
});
