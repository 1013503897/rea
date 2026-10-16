// The native owner supplies targets and passing locations; never parse display.
import { z } from "zod";

import { hex, ordinal, valueId, operationId } from "./native-contract.mjs";
const location = z.strictObject({ space: z.string().min(1), offset: hex });
const storage = location.extend({
  size_bytes: z.number().int().positive().max(0x7fffffff),
});
export const nativeCall = z.strictObject({
  id: operationId,
  origin_address: hex,
  block: ordinal,
  opcode: z.enum(["CPUI_CALL", "CPUI_CALLIND"]),
  is_dead: z.boolean(),
  target_value_id: valueId.nullable(),
  spec_available: z.boolean(),
  target: location.nullable(),
  target_name: z.string().min(1).nullable(),
  arguments: z.array(
    z.strictObject({
      input_index: z.number().int().positive().max(0x7fffffff),
      value_id: valueId.nullable(),
      storage: storage.nullable(),
      storage_authority: z
        .enum(["final-input-storage", "locked-prototype"])
        .nullable(),
    }),
  ),
  output: valueId.nullable(),
  prototype: z
    .strictObject({
      model: z.string().nullable(),
      model_unknown: z.boolean().nullable(),
      inputs_locked: z.boolean(),
      variadic: z.boolean(),
      parameter_shift: z.number().int().min(-0x80000000).max(0x7fffffff),
    })
    .nullable(),
  stack_offset: hex.nullable(),
});

export const callCoverage = Object.freeze({
  scope: "all retained CALL/CALLIND operations in this recovered function",
  target_authority: "native recovered call specification; not runtime binding",
  argument_authority:
    "native finalized passing storage or locked prototype; null remains unknown",
  source_parameter_ordinals: "unknown",
  source_signature: "unknown",
  machine_call_equivalence: "unknown",
  memory_alias_dependencies: "unknown",
});
