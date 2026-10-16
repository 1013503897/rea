// The native-format boundary owns validation and indexes; consumers never parse
// diagnostic statements to recover value identity, operand indexes or CFG edges.
import { FactFailure } from "./fact-error.mjs";
import {
  indexSwitchFacet,
  validateSwitchGraph,
  validateSwitchValues,
  createSwitchViews,
} from "./native-switch-views.mjs";
import { parseNativeFunction } from "./native-ir-contract.mjs";
import { createControlDependenceIndex } from "./control-dependence.mjs";
import { createGraphPathReader } from "./cfg-path.mjs";
import { freezeFacts as freeze } from "./fact-reads.mjs";
import {
  indexCallFacet,
  validateCallGraph,
  createCallViews,
} from "./native-call-views.mjs";
import { requireFact } from "./native-contract.mjs";
import {
  indexOperationFacts,
  createOperationViews,
  coverageIssues,
  isNativeOperationRelation,
} from "./native-operation-views.mjs";
import {
  indexProjection,
  createProjectionViews,
} from "./native-projection-views.mjs";
import {
  uniqueNative as unique,
  nativePage as page,
  readNativeIdentities as readIdentities,
} from "./native-reads.mjs";
function validateBlocks(operations, values, blocks) {
  const membership = new Set();
  for (const block of blocks.values()) {
    for (const id of block.operations) {
      requireFact(
        operations.get(id)?.block === block.id && !membership.has(id),
        "Native operation/block ownership mismatch",
      );
      membership.add(id);
    }
    for (const [index, edge] of block.successors.entries()) {
      requireFact(
        edge.index === index &&
          edge.id === `${block.id}:${index}` &&
          blocks.get(edge.target)?.predecessors.includes(block.id),
        "Native CFG successor/predecessor mismatch",
      );
      requireFact(
        edge.condition_value === null || values.has(edge.condition_value),
        "Dangling native branch condition",
      );
    }
    for (const from of block.predecessors)
      requireFact(
        blocks.get(from)?.successors.some((edge) => edge.target === block.id),
        "Dangling native predecessor",
      );
  }
  requireFact(
    membership.size === operations.size,
    "Native operation omitted from block membership",
  );
}

function validatePhiBindings(operations, blocks) {
  for (const op of operations.values())
    for (const [position, input] of op.inputs.entries()) {
      if (input.phi_predecessor !== null)
        requireFact(
          blocks.get(op.block).predecessors[position] === input.phi_predecessor,
          "Native phi/predecessor mismatch",
        );
      if (input.phi_predecessor_edge !== null)
        requireFact(
          blocks
            .get(input.phi_predecessor)
            ?.successors.some(
              (edge) =>
                edge.id === input.phi_predecessor_edge &&
                edge.target === op.block,
            ),
          "Native phi incoming-edge identity mismatch",
        );
    }
}

function indexNative(facts) {
  const core = indexOperationFacts(
    facts.operations,
    facts.values,
    facts.coverage.omitted_definition_ids,
  );
  const blocks = unique(
    facts.blocks.map(({ start, ...block }) =>
      freeze({ ...block, origin_start: start }),
    ),
  );
  validateBlocks(core.operations, core.values, blocks);
  validatePhiBindings(core.operations, blocks);
  const incoming = new Map(),
    outgoing = new Map();
  for (const block of blocks.values())
    for (const edge of block.successors) {
      const row = freeze({
        ...edge,
        from: block.id,
        to: edge.target,
        operation: block.operations.at(-1) ?? null,
        kind: edge.polarity ? "conditional" : "recovered",
      });
      for (const [map, key] of [
        [incoming, edge.target],
        [outgoing, block.id],
      ]) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
      }
    }
  return { ...core, blocks, incoming, outgoing };
}

function createViews(facts, code, indexes) {
  const { blocks, incoming, outgoing, normalized } = indexes;
  const {
    issues,
    indirect_branch_operations,
    omitted_definition_ids,
    ...metadata
  } = facts.coverage;
  const coverage = freeze({
    ...metadata,
    ...coverageIssues(issues),
    indirect_branch_operation_count: indirect_branch_operations.length,
    omitted_definition_count: omitted_definition_ids.length,
    operations: normalized.size,
    values: indexes.values.size,
    blocks: blocks.size,
    control_flow: "complete-for-recovered-graph",
    representation:
      "optimized recovered IR; origins do not establish machine branch targets or block extents",
    runtime_successors: "unknown",
    memory_alias_dependencies: "unknown",
  });
  const core = createOperationViews(indexes, coverage);
  let controls;
  return Object.freeze({
    ...core,
    code,
    block: (id) => blocks.get(id) ?? null,
    incoming: (id) => incoming.get(id) ?? [],
    blocks: (input) => readIdentities(blocks, input),
    path: createGraphPathReader(blocks, outgoing),
    edges: (input) => {
      if (isNativeOperationRelation(input.kind))
        return core.operationRelations(input);
      const seeds = [...new Set(input.seeds)],
        unretained_seeds = seeds.filter((id) => !blocks.has(id));
      if (input.kind === "controllers") {
        controls ??= createControlDependenceIndex(facts.blocks);
        return {
          ...controls.read({ ...input, seeds }),
          unretained_seeds,
        };
      }
      return {
        ...page(
          seeds.flatMap(
            (seed) =>
              (input.kind === "incoming" ? incoming : outgoing).get(seed) ?? [],
          ),
          input,
        ),
        unretained_seeds,
      };
    },
  });
}

const projectedFailure = (error) => ({
  code: error.code ?? "invalid_provider_output",
  message: error.message,
  details: error.details ?? {},
});

const operationFailure = (projectionError, graphError) =>
  projectionError?.details?.availability === "not-captured"
    ? graphError
    : (projectionError ?? graphError);

const captureFacets = ({
  graph,
  projection,
  calls,
  graphError,
  operationError,
  callError,
  switches,
  switchError,
}) =>
  freeze({
    code: { availability: "available" },
    recovered_ir: graph
      ? { availability: "available" }
      : { availability: "unavailable", error: graphError },
    operations: graph
      ? {
          availability: "available",
          scope: "complete-for-recovered-graph",
          count: graph.coverage.operations,
        }
      : projection
        ? {
            availability: "available",
            scope: "bounded-call-rooted-definitions",
            count: projection.coverage.operations,
            root_count: projection.coverage.root_count,
            definition_frontier_count:
              projection.coverage.definition_frontier_count,
          }
        : {
            availability: "unavailable",
            error: operationError,
          },
    calls: calls
      ? { availability: "available", ...calls.summary }
      : { availability: "unavailable", error: callError },
    switches: switches
      ? { availability: "available", ...switches.summary }
      : { availability: "unavailable", error: switchError },
    values: graph
      ? {
          availability: "available",
          scope: "complete-for-recovered-graph",
          count: graph.coverage.values,
        }
      : projection
        ? {
            availability: "available",
            scope: "call-rooted-definitions",
            count: projection.coverage.values,
          }
        : calls
          ? {
              availability: "available",
              scope: "call-boundary-only",
              count: calls.value_count,
            }
          : { availability: "unavailable", error: callError },
  });

const loadFacet = (result, build) => {
  if (!result.ok) return { error: projectedFailure(result.error) };
  try {
    return build(result.value);
  } catch (error) {
    return { error: projectedFailure(error) };
  }
};
const unavailable =
  (facet, error = {}) =>
  () => {
    throw new FactFailure(error.code, error.message, {
      ...error.details,
      facet,
    });
  };
export function parseNativeIR(text, entry, expectedInput) {
  const capture = parseNativeFunction(text, entry, expectedInput);
  const graph = loadFacet(capture.facts, (facts) => {
    freeze(facts);
    const index = indexNative(facts);
    return { index, view: createViews(facts, capture.code, index) };
  });
  const calls = loadFacet(capture.calls, (facts) => {
    const index = indexCallFacet(facts);
    if (graph.view) validateCallGraph(index, graph.index);
    return { index, view: createCallViews(facts, index) };
  });
  const unavailableGraph = unavailable("recovered_ir", graph.error);
  const projection = graph.view
    ? {}
    : loadFacet(capture.projection, (facts) => {
        const index = indexProjection(facts);
        // Without a full graph, the independent call owner validates the projection.
        if (calls.view) validateCallGraph(calls.index, index);
        return {
          index,
          view: createProjectionViews(
            facts,
            capture.code,
            index,
            unavailableGraph,
          ),
        };
      });
  const unavailableCalls = unavailable("calls", calls.error);
  const switches = loadFacet(capture.switches, (facts) => {
    const index = indexSwitchFacet(facts);
    if (graph.view) validateSwitchGraph(index, graph.index);
    else {
      validateSwitchValues(index, calls.index?.values);
      validateSwitchValues(index, projection.index?.values);
    }
    return { view: createSwitchViews(facts, index) };
  });
  const unavailableSwitches = unavailable("switches", switches.error);
  const operationError = operationFailure(projection.error, graph.error);
  const unavailableOperations = unavailable("operations", operationError);
  const fallback = {
    code: capture.code,
    coverage: freeze({
      scope: "native reconstructed code; recovered IR facet unavailable",
      operations: null,
      blocks: null,
      control_flow: "unknown",
      machine_semantic_equivalence: "unknown",
      issues: [graph.error?.message],
    }),
    ...Object.fromEntries(
      ["operation", "findConstant", "uses", "select", "slice"].map((name) => [
        name,
        unavailableOperations,
      ]),
    ),
    ...Object.fromEntries(
      ["block", "incoming", "blocks"].map((name) => [name, unavailableGraph]),
    ),
    edges: (input) =>
      isNativeOperationRelation(input.kind)
        ? unavailableOperations()
        : unavailableGraph(),
  };
  return Object.freeze({
    ...(graph.view ?? projection.view ?? fallback),
    path: graph.view?.path ?? unavailableGraph,
    edges: (input) =>
      input.kind === "cases"
        ? (switches.view?.cases ?? unavailableSwitches)(input)
        : (graph.view ?? projection.view ?? fallback).edges(input),
    language: capture.language,
    calls: calls.view?.calls ?? unavailableCalls,
    switches: switches.view?.switches ?? unavailableSwitches,
    values:
      graph.view?.values ??
      projection.view?.values ??
      calls.view?.values ??
      unavailableCalls,
    facets: captureFacets({
      graph: graph.view,
      projection: projection.view,
      calls: calls.view,
      graphError: graph.error,
      operationError,
      callError: calls.error,
      switches: switches.view,
      switchError: switches.error,
    }),
  });
}
