// The native owner supplies targets and passing locations; never parse display.
import { z } from "zod";
import { FactFailure } from "./fact-error.mjs";
import { freezeFacts } from "./fact-reads.mjs";

const hex = z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u);
const location = z.strictObject({ space: z.string().min(1), offset: hex });
const storage = location.extend({
  size_bytes: z.number().int().positive().max(0x7fffffff),
});
export const nativeCall = z.strictObject({
  id: z.string().regex(/^0x[0-9a-f]{1,16}:[0-9a-f]{1,8}$/u),
  spec_available: z.boolean(),
  target: location.nullable(),
  target_name: z.string().min(1).nullable(),
  arguments: z.array(
    z.strictObject({
      input_index: z.number().int().positive().max(0x7fffffff),
      value_id: z
        .string()
        .regex(/^v[0-9a-f]{1,16}$/u)
        .nullable(),
      storage: storage.nullable(),
      storage_authority: z
        .enum(["final-input-storage", "locked-prototype"])
        .nullable(),
    }),
  ),
  output: z
    .string()
    .regex(/^v[0-9a-f]{1,16}$/u)
    .nullable(),
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

const requireFact = (valid, reason) => {
  if (!valid) throw new FactFailure("invalid_provider_output", reason);
};
export function indexCalls(rows, operations) {
  const calls = new Map();
  for (const row of rows) {
    const op = operations.get(row.id);
    requireFact(
      op &&
        ["CPUI_CALL", "CPUI_CALLIND"].includes(op.opcode) &&
        !calls.has(row.id),
      "Native call ownership or identity mismatch",
    );
    requireFact(
      row.output === op.output &&
        row.arguments.length === Math.max(0, op.inputs.length - 1),
      "Native call argument/output arity mismatch",
    );
    for (const [i, argument] of row.arguments.entries())
      requireFact(
        argument.input_index === i + 1 &&
          argument.value_id === op.inputs[i + 1].value_id &&
          (argument.storage === null) === (argument.storage_authority === null),
        "Native call input/storage binding mismatch",
      );
    requireFact(
      row.spec_available
        ? row.prototype !== null
        : row.target === null &&
            row.target_name === null &&
            row.prototype === null &&
            row.stack_offset === null &&
            row.arguments.every((a) => a.storage === null),
      "Native missing call specification has invented facts",
    );
    calls.set(
      row.id,
      freezeFacts({
        ...row,
        origin_address: op.address,
        block: op.block,
        opcode: op.opcode,
      }),
    );
  }
  for (const op of operations.values())
    requireFact(
      !["CPUI_CALL", "CPUI_CALLIND"].includes(op.opcode) || calls.has(op.id),
      "Native call operation omitted from call coverage",
    );
  return calls;
}

export const callCoverage = Object.freeze({
  scope: "all retained CALL/CALLIND operations in this recovered function",
  target_authority: "native recovered call specification; not runtime binding",
  argument_authority:
    "native finalized passing storage or locked prototype; null remains unknown",
  source_parameter_ordinals: "unknown",
  machine_call_equivalence: "unknown",
  memory_alias_dependencies: "unknown",
});
