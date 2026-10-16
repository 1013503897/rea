// Native JSON decoding and resource admission; row-wise validation bounds errors.
import { z } from "zod";
import { FactFailure } from "./fact-error.mjs";
import { NATIVE_OUTPUT_BYTES } from "./limits.mjs";
import { readCallFacet } from "./native-call-contract.mjs";
import { readProjectionFacet } from "./native-projection-contract.mjs";
import { readSwitchFacet } from "./native-switch-contract.mjs";
import { operation, parseOperation } from "./native-operation-contract.mjs";
import {
  decodeGraphArchive,
  MAX_GRAPH_JSON_BYTES,
} from "./native-graph-encoding.mjs";
import {
  hex,
  ordinal,
  valueId,
  operationId,
  edgeId,
  value,
  rowParser,
  requireFact,
  formatFailure,
  readNativeFacet,
} from "./native-contract.mjs";

const edge = z.strictObject({
  id: edgeId,
  target: ordinal,
  index: ordinal,
  polarity: z.enum(["true", "false"]).nullable(),
  condition_value: valueId.nullable(),
  condition_test: z.enum(["eq-zero", "ne-zero"]).nullable(),
});
const factsSchema = z.strictObject({
  schema_version: z.literal(3),
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
  operations: z.array(operation).max(32000),
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
  binary: z.string(),
  count: z.literal(1),
  language: z.string(),
  error: z.null(),
  functions: z
    .array(
      z.object({
        address_hex: hex,
        code: z.string(),
        error: z.null(),
        atomic_facts: z.unknown().optional(),
        atomic_facts_error: z.string().optional(),
        atomic_calls: z.unknown().optional(),
        atomic_calls_error: z.string().optional(),
        atomic_switches: z.unknown().optional(),
        atomic_switches_error: z.string().optional(),
        atomic_projection: z.unknown().optional(),
        atomic_projection_error: z.string().optional(),
      }),
    )
    .length(1),
});

// Parse one row at a time: a bad provider must not expand thousands of malformed
// records into a giant Zod issue list before the caller can reject the source.
const nativeBlock = factsSchema.shape.blocks.element;
const parseBlock = rowParser(nativeBlock, {
  operations: (id) => operationId.parse(id),
  predecessors: (id) => ordinal.parse(id),
  successors: (row) => edge.parse(row),
});
const graphCoverage = factsSchema.shape.coverage;
const parseCoverage = rowParser(graphCoverage, {
  indirect_branch_operations: (row) => operationId.parse(row),
  omitted_definition_ids: (row) => operationId.parse(row),
  issues: (row) => z.string().parse(row),
});
const parseFacts = rowParser(
  factsSchema,
  {
    blocks: parseBlock,
    operations: parseOperation,
    values: (row) => value.parse(row),
  },
  { coverage: parseCoverage },
);

function preflight(facts) {
  requireFact(
    facts && typeof facts === "object",
    "Native atomic facts facet is unavailable; inspect the retained source for its reason and C",
  );
  requireFact(
    facts.schema_version === 3,
    "Unsupported native atomic facts schema version; expected 3",
  );
  requireFact(
    facts.blocks?.length > 0,
    "Native recovered graph is unavailable",
  );
  for (const [key, limit] of [
    ["blocks", 12000],
    ["operations", 32000],
    ["values", 36000],
  ])
    requireFact(
      Array.isArray(facts[key]) && facts[key].length <= limit,
      `Native ${key} exceeds resource capacity or has invalid shape`,
    );
  for (const [rows, limit] of [
    [facts.coverage?.indirect_branch_operations, 32000],
    [facts.coverage?.omitted_definition_ids, 36000],
    [facts.coverage?.issues, 12000],
  ])
    requireFact(
      Array.isArray(rows) && rows.length <= limit,
      "Native graph coverage exceeds capacity or has invalid shape",
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
    inputs <= 100000 && members <= 32000 && edges <= 100000,
    "Native relationships exceed resource capacity",
  );
  const displayBytes =
    facts.operations.reduce(
      (sum, op) =>
        sum +
        (typeof op?.statement === "string"
          ? Buffer.byteLength(op.statement)
          : 0),
      0,
    ) +
    facts.values.reduce(
      (sum, value) =>
        sum +
        (typeof value?.type_name === "string"
          ? Buffer.byteLength(value.type_name)
          : 0),
      0,
    );
  requireFact(
    displayBytes <= 4 * 1024 * 1024,
    "Native graph display exceeds resource capacity",
  );
}
const readGraph = (fn) =>
  readNativeFacet(fn, "atomic_facts", "recovered IR", (raw) => {
    const decoded = decodeGraphArchive(raw);
    const graph = decoded === undefined ? raw : JSON.parse(decoded);
    preflight(graph);
    return parseFacts(graph);
  });

function readSource(text) {
  requireFact(
    Buffer.byteLength(text) <= NATIVE_OUTPUT_BYTES,
    "Native JSON source exceeds transport budget",
  );
  return JSON.parse(text);
}
function readFunction(raw, entry, expectedInput) {
  requireFact(
    Array.isArray(raw?.functions) && raw.functions.length === 1,
    "Native source must describe exactly one function",
  );
  const doc = documentSchema.parse(raw),
    fn = doc.functions[0];
  if (expectedInput !== undefined && doc.binary !== expectedInput)
    throw new FactFailure(
      "subject_mismatch",
      "Native source names a different command input",
      { expected: expectedInput, observed: doc.binary },
    );
  if (entry !== undefined && fn.address_hex !== entry)
    throw new FactFailure(
      "subject_mismatch",
      "Native function entry differs from requested subject",
    );
  return { doc, fn };
}
export function parseNativeFunction(text, entry, expectedInput) {
  try {
    const { doc, fn } = readFunction(readSource(text), entry, expectedInput);
    return {
      code: fn.code,
      language: doc.language,
      facts: readGraph(fn),
      calls: readCallFacet(fn),
      switches: readSwitchFacet(fn),
      projection: readProjectionFacet(fn),
    };
  } catch (error) {
    throw formatFailure(error);
  }
}

export function readNativeGraphEvidence(text) {
  try {
    const raw = readSource(text);
    if (raw?.functions === undefined)
      throw new FactFailure(
        "capability_unavailable",
        "This retained source is not a native function record",
      );
    const { fn } = readFunction(raw);
    if (fn.atomic_facts === undefined)
      throw new FactFailure(
        "capability_unavailable",
        "Recovered graph source was not captured",
        { native_error: fn.atomic_facts_error?.slice(0, 1024) },
      );
    const decoded = decodeGraphArchive(fn.atomic_facts);
    const view = decoded ?? JSON.stringify(fn.atomic_facts);
    requireFact(
      Buffer.byteLength(view) <= MAX_GRAPH_JSON_BYTES,
      "Native graph Evidence view exceeds decoded capacity",
    );
    return {
      text: view,
      encoding: decoded === undefined ? "json" : "gzip-base64",
    };
  } catch (error) {
    throw formatFailure(error);
  }
}
