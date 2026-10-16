import { z } from "zod";
import { nativeCall } from "./native-calls.mjs";
import {
  ordinal,
  value,
  rowParser,
  readNativeFacet,
  requireFact,
} from "./native-contract.mjs";

const callFacet = z.strictObject({
  schema_version: z.literal(1),
  items: z.array(nativeCall).max(12000),
  values: z.array(value).max(36000),
  coverage: z.strictObject({
    scope: z.string(),
    blocks_examined: ordinal.min(1),
    operations_examined: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    value_scope: z.string(),
    machine_call_equivalence: z.literal("unknown"),
  }),
});
const parseCall = rowParser(nativeCall, {
  arguments: (row) => nativeCall.shape.arguments.element.parse(row),
});
const parseFacet = rowParser(callFacet, {
  items: parseCall,
  values: (row) => value.parse(row),
});
export const readCallFacet = (fn) =>
  readNativeFacet(fn, "atomic_calls", "recovered calls", (raw) => {
    requireFact(
      raw && typeof raw === "object" && raw.schema_version === 1,
      "Unsupported native call facet schema; expected 1",
    );
    for (const [name, limit] of [
      ["items", 12000],
      ["values", 36000],
    ])
      requireFact(
        Array.isArray(raw[name]) && raw[name].length <= limit,
        `Native call ${name} exceeds capacity or has invalid shape`,
      );
    requireFact(
      raw.items.reduce(
        (sum, row) =>
          sum + (Array.isArray(row?.arguments) ? row.arguments.length : 0),
        0,
      ) <= 50000,
      "Native call inputs exceed capacity",
    );
    return parseFacet(raw);
  });
