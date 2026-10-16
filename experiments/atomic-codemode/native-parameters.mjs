// One format owner for recovered formal prototype entries, not raw input flags.
import { z } from "zod";
import { nativeStorage } from "./native-storage.mjs";
import { rowParser, readNativeFacet, requireFact } from "./native-contract.mjs";
import { freezeFacts, projectFact } from "./fact-reads.mjs";
import { nativePage } from "./native-reads.mjs";

const parameter = z.strictObject({
  id: z.string(),
  native_index: z.number().int().nonnegative().nullable(),
  name: z.string(),
  type_name: z.string().nullable(),
  size_bytes: z.number().int().min(-0x80000000).max(0x7fffffff),
  is_void: z.boolean().nullable(),
  storage: nativeStorage.nullable(),
  type_locked: z.boolean(),
  name_locked: z.boolean(),
  size_locked: z.boolean(),
  this_pointer: z.boolean(),
  indirect_storage: z.boolean(),
  hidden_return: z.boolean(),
});
const schema = z.strictObject({
  schema_version: z.literal(1),
  model: z.string().nullable(),
  model_unknown: z.boolean().nullable(),
  inputs_locked: z.boolean(),
  output_locked: z.boolean(),
  variadic: z.boolean(),
  input_errors: z.boolean(),
  output_errors: z.boolean(),
  items: z.array(parameter).max(12000),
  output: parameter,
});
const parse = rowParser(schema, { items: (row) => parameter.parse(row) });
const validate = (row, index) => {
  requireFact(
    row.native_index === index &&
      row.id === (index === null ? "return" : `parameter:${index}`),
    "Native parameter identity/index mismatch",
  );
  requireFact(
    row.storage === null || row.storage.size_bytes === row.size_bytes,
    "Native parameter storage/width mismatch",
  );
  requireFact(
    (row.type_name === null) === (row.is_void === null),
    "Native parameter type/void knowledge mismatch",
  );
  requireFact(
    row.is_void !== true || (row.size_bytes === 0 && row.storage === null),
    "Native void parameter has invented storage",
  );
};
export const readParameterFacet = (fn) =>
  readNativeFacet(fn, "atomic_parameters", "function parameters", (raw) => {
    const facts = parse(raw);
    facts.items.forEach(validate);
    validate(facts.output, null);
    requireFact(
      (facts.model === null) === (facts.model_unknown === null),
      "Native prototype model knowledge mismatch",
    );
    return facts;
  });
const defaultFields = [
  "storage",
  "size_bytes",
  "is_void",
  "type_locked",
  "indirect_storage",
  "hidden_return",
  "this_pointer",
];
const identity = ["id", "native_index"];
export function createParameterViews(facts) {
  freezeFacts(facts);
  const { schema_version: _version, items, output, ...prototype } = facts;
  freezeFacts(prototype);
  const coverage = freezeFacts({
    scope: "all entries in the captured native recovered function prototype",
    source_signature: "unknown",
    source_parameter_ordinals: "unknown",
    raw_input_values:
      "is_input is not formal-parameter membership; globals/stack may also be input varnodes",
    ssa_binding:
      "not collected here; exact selected storage/width lookup is separate and does not prove aliases",
    runtime_binding: "unknown",
    machine_semantic_equivalence: "unknown",
    input_recovery_errors: prototype.input_errors,
    output_recovery_errors: prototype.output_errors,
  });
  return {
    count: items.length,
    parameters: (input) => {
      const indices =
        input.indices === undefined ? null : [...new Set(input.indices)];
      const rows = indices
        ? indices.flatMap((index) => items[index] ?? [])
        : items;
      const fields = input.fields ?? defaultFields;
      return {
        ...nativePage(rows, { ...input, fields }, identity),
        missing_indices:
          indices?.filter((index) => index >= items.length) ?? [],
        output: projectFact(output, fields, identity),
        prototype,
        coverage,
      };
    },
  };
}
