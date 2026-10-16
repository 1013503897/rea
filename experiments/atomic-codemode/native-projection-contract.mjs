// Sparse facts retain their own resource, root and frontier contract.
import { z } from "zod";
import {
  operationId,
  value,
  rowParser,
  requireFact,
  readNativeFacet,
} from "./native-contract.mjs";
import { operation, parseOperation } from "./native-operation-contract.mjs";

const frontier = z.strictObject({
  definition: operationId,
  reason: z.enum(["operation-budget", "outside-recovered-membership"]),
});
const coverage = z.strictObject({
  scope: z.string(),
  operation_budget: z.literal(4096),
  frontier: z.array(frontier).max(12288),
  issues: z.array(z.string()).max(4096),
  machine_semantic_equivalence: z.literal("unknown"),
});
const schema = z.strictObject({
  schema_version: z.literal(1),
  roots: z.array(operationId).max(4096),
  operations: z.array(operation).max(4096),
  values: z.array(value).max(12288),
  coverage,
});
const parseCoverage = rowParser(coverage, {
  frontier: (row) => frontier.parse(row),
  issues: (row) => z.string().parse(row),
});
const parseProjection = rowParser(
  schema,
  {
    roots: (row) => operationId.parse(row),
    operations: parseOperation,
    values: (row) => value.parse(row),
  },
  { coverage: parseCoverage },
);
export const readProjectionFacet = (fn) =>
  readNativeFacet(fn, "atomic_projection", "operation projection", (raw) => {
    requireFact(
      raw?.schema_version === 1,
      "Unsupported native projection schema",
    );
    for (const [rows, limit] of [
      [raw.roots, 4096],
      [raw.operations, 4096],
      [raw.values, 12288],
      [raw.coverage?.frontier, 12288],
      [raw.coverage?.issues, 4096],
    ])
      requireFact(
        Array.isArray(rows) && rows.length <= limit,
        "Native projection exceeds capacity or has invalid shape",
      );
    requireFact(
      raw.operations.reduce(
        (n, op) => n + (Array.isArray(op?.inputs) ? op.inputs.length : 0),
        0,
      ) <= 16384,
      "Native projection input capacity exceeded",
    );
    return parseProjection(raw);
  });
