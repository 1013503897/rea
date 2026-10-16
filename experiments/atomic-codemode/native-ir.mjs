// The native-format boundary owns validation and indexes; consumers never parse
// diagnostic statements to recover value identity, operand indexes or CFG edges.
import { FactFailure } from "./fact-error.mjs";
import { parseNativeFunction } from "./native-ir-contract.mjs";
import { backwardSlice } from "../atomic-re-tools/kuna-ssa.mjs";
import { controlDependencies } from "./control-dependence.mjs";

const freeze = (object) => {
  if (object && typeof object === "object") {
    Object.values(object).forEach(freeze);
    Object.freeze(object);
  }
  return object;
};
const index = (map, key, row) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(row);
};
const unique = (rows) => {
  const map = new Map();
  for (const row of rows) {
    if (map.has(row.id)) throw new Error(`Duplicate native identity ${row.id}`);
    map.set(row.id, row);
  }
  return map;
};
const kind = (opcode) =>
  ({
    CPUI_LOAD: "load",
    CPUI_STORE: "store",
    CPUI_MULTIEQUAL: "phi",
    CPUI_CALL: "call",
    CPUI_CALLIND: "call",
    CPUI_BRANCH: "branch",
    CPUI_CBRANCH: "branch",
    CPUI_BRANCHIND: "switch",
    CPUI_RETURN: "return",
  })[opcode] ?? "value";
const page = (rows, { offset = 0, limit = 20, fields } = {}) => ({
  items: rows
    .slice(offset, offset + limit)
    .map((row) =>
      fields
        ? Object.fromEntries(
            [...new Set(["id", "origin_address", "block", ...fields])]
              .filter((key) => Object.hasOwn(row, key))
              .map((key) => [key, row[key]]),
          )
        : row,
    ),
  total: rows.length,
  next_offset: offset + limit < rows.length ? offset + limit : null,
});
const requireFact = (condition, reason) => {
  if (!condition) throw new FactFailure("invalid_provider_output", reason);
};
const readIdentities = (index, input) => ({
  ...page(
    input.ids
      ? input.ids.flatMap((id) => index.get(id) ?? [])
      : [...index.values()],
    input,
  ),
  missing: input.ids?.filter((id) => !index.has(id)) ?? [],
});

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

function validateOperations(operations, values, blocks) {
  for (const op of operations.values()) {
    for (const [index, input] of op.inputs.entries()) {
      requireFact(
        input.input_index === index &&
          (input.value_id === null || values.has(input.value_id)),
        "Dangling or misindexed native operand",
      );
      requireFact(
        input.phi_predecessor === null ||
          (op.opcode === "CPUI_MULTIEQUAL" &&
            blocks.get(op.block).predecessors[index] === input.phi_predecessor),
        "Native phi/predecessor mismatch",
      );
      if (input.phi_predecessor_edge !== null)
        requireFact(
          input.phi_predecessor !== null &&
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
    requireFact(
      op.output === null || values.get(op.output)?.definition === op.id,
      "Native output/definition mismatch",
    );
  }
}

function validateValues(facts, operations, values) {
  const omitted = new Set(facts.coverage.omitted_definition_ids);
  for (const value of values.values())
    if (value.definition !== null)
      requireFact(
        operations.get(value.definition)?.output === value.id ||
          (!operations.has(value.definition) && omitted.has(value.definition)),
        "Native value/definition mismatch",
      );
}

function indexNative(facts) {
  const operations = unique(facts.operations),
    values = unique(facts.values),
    blocks = unique(
      facts.blocks.map(({ start, ...block }) =>
        freeze({ ...block, origin_start: start }),
      ),
    );
  validateBlocks(operations, values, blocks);
  validateOperations(operations, values, blocks);
  validateValues(facts, operations, values);
  const users = new Map(),
    incoming = new Map(),
    outgoing = new Map(),
    constants = new Map();
  const normalized = new Map();
  for (const op of operations.values()) {
    const definitions = [],
      literals = [];
    for (const input of op.inputs) {
      const value = values.get(input.value_id);
      if (value?.definition) {
        const relation = freeze({
          definition: value.definition,
          use: op.id,
          input_index: input.input_index,
          value_id: value.id,
          phi_predecessor: input.phi_predecessor,
          phi_predecessor_edge: input.phi_predecessor_edge,
        });
        definitions.push(relation);
        index(users, value.definition, relation);
      }
      if (value?.is_constant) {
        literals.push({
          value: value.offset,
          printed_size_bytes: value.size_bytes,
          is_annotation: value.is_annotation,
        });
        index(constants, value.offset, op.id);
      }
    }
    const { address: origin_address, ...payload } = op;
    normalized.set(
      op.id,
      freeze({
        ...payload,
        origin_address,
        kind: kind(op.opcode),
        source_line: null,
        definitions,
        constants: literals,
      }),
    );
  }
  for (const block of blocks.values())
    for (const edge of block.successors) {
      const row = freeze({
        ...edge,
        from: block.id,
        to: edge.target,
        operation: block.operations.at(-1) ?? null,
        kind: edge.polarity ? "conditional" : "recovered",
      });
      index(incoming, edge.target, row);
      index(outgoing, block.id, row);
    }
  return {
    operations,
    values,
    blocks,
    users,
    incoming,
    outgoing,
    constants,
    normalized,
  };
}

function createViews(facts, code, indexes) {
  const { values, blocks, users, incoming, outgoing, constants, normalized } =
    indexes;
  const coverage = freeze({
    ...facts.coverage,
    operations: normalized.size,
    blocks: blocks.size,
    control_flow: "complete-for-recovered-graph",
    representation:
      "optimized recovered IR; origins do not establish machine branch targets or block extents",
    runtime_successors: "unknown",
    memory_alias_dependencies: "unknown",
    issues: facts.coverage.issues,
  });
  const model = {
    code,
    coverage,
    operation: (id) => normalized.get(id) ?? null,
    block: (id) => blocks.get(id) ?? null,
    findConstant: (value) => [...new Set(constants.get(value) ?? [])],
    uses: (id) => users.get(id) ?? [],
    incoming: (id) => incoming.get(id) ?? [],
    select: (input) =>
      selectOperations(normalized, constants, {
        fields: ["kind", "statement", "definitions", "constants"],
        ...input,
      }),
    values: (input) => readIdentities(values, input),
    blocks: (input) => readIdentities(blocks, input),
    edges: (input) => {
      if (input.kind === "controllers") {
        const controls = controlDependencies(facts.blocks, {
          dependents: new Set(input.seeds),
        });
        return {
          ...page(controls.relations, input),
          relation_coverage: controls.coverage,
        };
      }
      return page(
        input.seeds.flatMap((seed) =>
          input.kind === "definitions"
            ? (normalized.get(seed)?.definitions ?? [])
            : ((input.kind === "uses"
                ? users
                : input.kind === "incoming"
                  ? incoming
                  : outgoing
              ).get(seed) ?? []),
        ),
        input,
      );
    },
    slice: (input) => sliceValues(model, values, input),
  };
  return Object.freeze(model);
}

function selectOperations(normalized, constants, input = {}) {
  const ids = input.ids && new Set(input.ids),
    addresses = input.origin_addresses && new Set(input.origin_addresses),
    blockIds = input.block_ids && new Set(input.block_ids);
  const candidates = ids
    ? [...ids].flatMap((id) => normalized.get(id) ?? [])
    : input.constant
      ? [...new Set(constants.get(input.constant) ?? [])].map((id) =>
          normalized.get(id),
        )
      : normalized.values();
  return page(
    [...candidates].filter(
      (op) =>
        (!addresses || addresses.has(op.origin_address)) &&
        (!blockIds || blockIds.has(op.block)) &&
        (!input.constant ||
          op.constants.some((literal) => literal.value === input.constant)) &&
        (!input.kind || op.kind === input.kind),
    ),
    input,
  );
}

function sliceValues(model, values, input) {
  const result = backwardSlice(model, input.seeds, {
    maxOperations: input.max_operations,
    stopAt: input.stop_at,
    stopKinds: input.stop_kinds,
  });
  const frontier = new Map();
  for (const op of result.operations)
    for (const input of op.inputs) {
      const value = values.get(input.value_id);
      if (!value)
        frontier.set(`${op.id}:${input.input_index}`, {
          operation: op.id,
          input_index: input.input_index,
          reason: "native-null-input",
        });
      else if (!value.definition && !value.is_constant && !value.is_annotation)
        frontier.set(value.id, {
          value_id: value.id,
          reason: value.is_input ? "function-input" : "definition-unavailable",
        });
    }
  return {
    ...result,
    value_frontier: [...frontier.values()],
    coverage: {
      ...result.coverage,
      status:
        result.coverage.status === "complete-for-printed-definitions"
          ? "complete-for-retained-value-definitions"
          : result.coverage.status,
      relation_authority: "native SSA value identities and operand indexes",
    },
  };
}

const projectedFailure = (error) => ({
  code: error.code ?? "invalid_provider_output",
  message: error.message,
  details: error.details ?? {},
});

export function parseNativeIR(text, entry, expectedInput) {
  const capture = parseNativeFunction(text, entry, expectedInput);
  let graph = capture.facts;
  if (graph.ok) {
    try {
      freeze(graph.value);
      const model = createViews(
        graph.value,
        capture.code,
        indexNative(graph.value),
      );
      return Object.freeze({
        ...model,
        language: capture.language,
        facets: freeze({
          code: { availability: "available" },
          recovered_ir: { availability: "available" },
        }),
      });
    } catch (error) {
      graph = { ok: false, error };
    }
  }
  const error = projectedFailure(graph.error);
  const unavailable = () => {
    throw new FactFailure(error.code, error.message, {
      ...error.details,
      facet: "recovered_ir",
    });
  };
  return Object.freeze({
    code: capture.code,
    language: capture.language,
    facets: freeze({
      code: { availability: "available" },
      recovered_ir: { availability: "unavailable", error },
    }),
    coverage: freeze({
      scope: "native reconstructed code; recovered IR facet unavailable",
      operations: null,
      blocks: null,
      control_flow: "unknown",
      machine_semantic_equivalence: "unknown",
      issues: [error.message],
    }),
    ...Object.fromEntries(
      [
        "operation",
        "block",
        "findConstant",
        "uses",
        "incoming",
        "select",
        "values",
        "blocks",
        "edges",
        "slice",
      ].map((name) => [name, unavailable]),
    ),
  });
}
