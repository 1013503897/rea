// Native JSON decoding and resource admission; row-wise validation bounds errors.
import { z } from "zod";
import { FactFailure } from "./fact-error.mjs";
const requireFact = (condition, reason) => {
  if (!condition) throw new FactFailure("invalid_provider_output", reason);
};

const hex = z.string().regex(/^0x[0-9a-f]+$/u);
const ordinal = z.number().int().nonnegative();
const valueId = z.string().regex(/^v[0-9a-f]+$/u);
const operationId = z.string().regex(/^0x[0-9a-f]+:[0-9a-f]+$/u);
const edgeId = z.string().regex(/^\d+:\d+$/u);
const edge = z.strictObject({
  id: edgeId,
  target: ordinal,
  index: ordinal,
  polarity: z.enum(["true", "false"]).nullable(),
  condition_value: valueId.nullable(),
  condition_test: z.enum(["eq-zero", "ne-zero"]).nullable(),
});
const operation = z.strictObject({
  id: operationId,
  address: hex,
  block: ordinal,
  opcode: z.string(),
  statement: z.string(),
  is_dead: z.boolean(),
  inputs: z.array(
    z.strictObject({
      input_index: ordinal,
      value_id: valueId.nullable(),
      phi_predecessor: ordinal.nullable(),
      phi_predecessor_edge: edgeId.nullable(),
    }),
  ),
  output: valueId.nullable(),
});
const value = z.strictObject({
  id: valueId,
  space: z.string().nullable(),
  offset: hex,
  size_bytes: z.number().int().positive(),
  is_constant: z.boolean(),
  is_input: z.boolean(),
  is_annotation: z.boolean(),
  definition: operationId.nullable(),
  type_name: z.string(),
});
const factsSchema = z.strictObject({
  schema_version: z.literal(1),
  blocks: z
    .array(
      z.strictObject({
        id: ordinal,
        start: hex,
        operations: z.array(operationId),
        predecessors: z.array(ordinal),
        successors: z.array(edge),
      }),
    )
    .min(1)
    .max(12000),
  operations: z.array(operation).max(12000),
  values: z.array(value).max(36000),
  coverage: z.strictObject({
    scope: z.string(),
    machine_semantic_equivalence: z.literal("unknown"),
    indirect_branch_operations: z.array(operationId),
    omitted_definition_ids: z.array(operationId),
    issues: z.array(z.string()),
  }),
});
const documentSchema = z.object({
  functions: z
    .array(
      z.object({
        address_hex: hex,
        code: z.string(),
        error: z.null(),
        atomic_facts: z.unknown(),
      }),
    )
    .length(1),
});

// Parse one row at a time: a bad provider must not expand thousands of malformed
// records into a giant Zod issue list before the caller can reject the source.
const rowParser = (schema, arrays) => {
  const metadata = schema.omit(
    Object.fromEntries(Object.keys(arrays).map((key) => [key, true])),
  );
  return (raw) => {
    const fields = { ...raw };
    for (const key of Object.keys(arrays)) delete fields[key];
    const result = metadata.parse(fields);
    for (const [key, parse] of Object.entries(arrays)) {
      requireFact(Array.isArray(raw[key]), `Native ${key} must be an array`);
      result[key] = raw[key].map(parse);
    }
    return result;
  };
};
const nativeBlock = factsSchema.shape.blocks.element;
const parseBlock = rowParser(nativeBlock, {
  operations: (id) => operationId.parse(id),
  predecessors: (id) => ordinal.parse(id),
  successors: (row) => edge.parse(row),
});
const parseOperation = rowParser(operation, {
  inputs: (row) => operation.shape.inputs.element.parse(row),
});
const parseFacts = rowParser(factsSchema, {
  blocks: parseBlock,
  operations: parseOperation,
  values: (row) => value.parse(row),
});

function preflight(raw) {
  requireFact(
    Array.isArray(raw?.functions) && raw.functions.length === 1,
    "Native source must describe exactly one function",
  );
  const facts = raw.functions[0]?.atomic_facts;
  requireFact(
    facts && typeof facts === "object",
    "Native atomic facts facet is unavailable; inspect the retained source for its reason and C",
  );
  requireFact(
    facts.blocks?.length > 0,
    "Native recovered graph is unavailable",
  );
  for (const [key, limit] of [
    ["blocks", 12000],
    ["operations", 12000],
    ["values", 36000],
  ])
    requireFact(
      Array.isArray(facts[key]) && facts[key].length <= limit,
      `Native ${key} exceeds resource capacity or has invalid shape`,
    );
  const inputs = facts.operations.reduce(
    (sum, op) => sum + (Array.isArray(op?.inputs) ? op.inputs.length : 0),
    0,
  );
  const members = facts.blocks.reduce(
    (sum, block) =>
      sum + (Array.isArray(block?.operations) ? block.operations.length : 0),
    0,
  );
  const edges = facts.blocks.reduce(
    (sum, block) =>
      sum +
      (Array.isArray(block?.successors) ? block.successors.length : 0) +
      (Array.isArray(block?.predecessors) ? block.predecessors.length : 0),
    0,
  );
  requireFact(
    inputs <= 50000 && members <= 12000 && edges <= 100000,
    "Native relationships exceed resource capacity",
  );
}
export function parseNativeFunction(text, entry) {
  try {
    requireFact(
      Buffer.byteLength(text) <= 8 * 1024 * 1024,
      "Native JSON source exceeds transport budget",
    );
    const raw = JSON.parse(text);
    preflight(raw);
    const fn = documentSchema.parse(raw).functions[0];
    requireFact(
      fn.address_hex === entry,
      "Native function entry differs from requested subject",
    );
    return { code: fn.code, facts: parseFacts(fn.atomic_facts) };
  } catch (error) {
    if (error instanceof FactFailure) throw error;
    const details =
      error instanceof z.ZodError
        ? {
            issues: error.issues.slice(0, 8).map(({ path, code, message }) => ({
              path,
              code,
              message: message.slice(0, 160),
            })),
          }
        : { reason: String(error.message).slice(0, 256) };
    throw new FactFailure(
      "invalid_provider_output",
      "Native IR source does not match the declared format",
      details,
    );
  }
}
