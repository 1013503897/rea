import { requireFact } from "./native-contract.mjs";
import { freezeFacts as freeze } from "./fact-reads.mjs";
import {
  indexOperationFacts,
  createOperationViews,
  coverageIssues,
} from "./native-operation-views.mjs";

export function indexProjection(facts) {
  const reasons = new Map();
  for (const row of facts.coverage.frontier) {
    requireFact(!reasons.has(row.definition), "Duplicate projection frontier");
    reasons.set(row.definition, row.reason);
    requireFact(
      row.reason !== "operation-budget" ||
        facts.operations.length === facts.coverage.operation_budget,
      "Projection claims an unexhausted operation budget",
    );
  }
  const index = indexOperationFacts(facts.operations, facts.values, [
    ...reasons.keys(),
  ]);
  const roots = new Set(facts.roots);
  requireFact(roots.size === facts.roots.length, "Duplicate projection root");
  const callIDs = [...index.operations.values()]
    .filter((op) => ["CPUI_CALL", "CPUI_CALLIND"].includes(op.opcode))
    .map((op) => op.id);
  requireFact(
    roots.size === callIDs.length && callIDs.every((id) => roots.has(id)),
    "Projection roots differ from retained call operations",
  );
  const reached = new Set(roots),
    queue = [...roots];
  for (const id of queue)
    for (const edge of index.normalized.get(id).definitions)
      if (
        index.operations.has(edge.definition) &&
        !reached.has(edge.definition)
      ) {
        reached.add(edge.definition);
        queue.push(edge.definition);
      }
  requireFact(
    reached.size === index.operations.size,
    "Projection contains operations unrelated to its roots",
  );
  return { ...index, reasons };
}

export function createProjectionViews(facts, code, indexes, unavailableGraph) {
  freeze(facts);
  const coverage = freeze({
    scope: facts.coverage.scope,
    operations: indexes.operations.size,
    values: indexes.values.size,
    blocks: null,
    root_count: facts.roots.length,
    operation_budget: facts.coverage.operation_budget,
    definition_frontier_count: facts.coverage.frontier.length,
    ...coverageIssues(facts.coverage.issues),
    control_flow: "not-collected",
    definition_scope:
      "retained operand definitions; unexpanded IDs stay unknown",
    uses_scope: "selected-operations-only; no complete-use claim",
    value_scope:
      "operands and outputs of the retained call-rooted operation set",
    machine_semantic_equivalence: "unknown",
    memory_alias_dependencies: "unknown",
    runtime_successors: "unknown",
    representation:
      "optimized recovered IR; origins and block IDs do not prove machine extents or branch targets",
  });
  const core = createOperationViews(indexes, coverage, indexes.reasons);
  return Object.freeze({
    ...core,
    code,
    block: unavailableGraph,
    incoming: unavailableGraph,
    blocks: unavailableGraph,
    edges: (input) =>
      ["definitions", "uses", "operands"].includes(input.kind)
        ? core.operationRelations(input)
        : unavailableGraph(),
  });
}
