// Shared immutable SSA operands and queries; no CFG completeness is inferred.
import { backwardSlice } from "../atomic-re-tools/kuna-ssa.mjs";
import { freezeFacts as freeze } from "./fact-reads.mjs";
import { requireFact } from "./native-contract.mjs";
import {
  uniqueNative as unique,
  nativePage as page,
  createNativeValueReader,
} from "./native-reads.mjs";
export const DEFAULT_NATIVE_OPERATION_FIELDS = Object.freeze([
  "kind",
  "opcode",
  "output",
  "input_count",
  "definition_count",
  "constant_count",
]);
export const isNativeOperationRelation = (kind) =>
  ["definitions", "uses", "operands", "value_uses"].includes(kind);
export const coverageIssues = (issues) => ({
  issues: issues.slice(0, 8).map((message) => message.slice(0, 160)),
  issue_count: issues.length,
  issues_omitted: Math.max(0, issues.length - 8),
  issue_messages_truncated: issues.slice(0, 8).some((s) => s.length > 160),
});
const index = (map, key, row) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(row);
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

function validateOperands(operations, values) {
  const referenced = new Set();
  for (const op of operations.values()) {
    requireFact(
      op.id.split(":")[0] === op.address,
      "Native operation origin/identity mismatch",
    );
    for (const [position, input] of op.inputs.entries()) {
      requireFact(
        input.input_index === position &&
          (input.value_id === null || values.has(input.value_id)),
        "Dangling or misindexed native operand",
      );
      requireFact(
        (input.phi_predecessor === null) ===
          (input.phi_predecessor_edge === null) &&
          (input.phi_predecessor === null ||
            (op.opcode === "CPUI_MULTIEQUAL" &&
              input.phi_predecessor_edge.startsWith(
                `${input.phi_predecessor}:`,
              ))),
        "Native phi binding is inconsistent",
      );
      if (input.value_id !== null) referenced.add(input.value_id);
    }
    requireFact(
      op.output === null || values.get(op.output)?.definition === op.id,
      "Native output/definition mismatch",
    );
    if (op.output !== null) referenced.add(op.output);
  }
  requireFact(
    referenced.size === values.size,
    "Native operation set contains unrelated values",
  );
}
function validateDefinitions(operations, values, omittedIDs) {
  const omitted = new Set(omittedIDs),
    missing = new Set();
  requireFact(
    omitted.size === omittedIDs.length,
    "Duplicate native definition frontier",
  );
  for (const value of values.values())
    if (value.definition !== null) {
      if (!operations.has(value.definition)) missing.add(value.definition);
      requireFact(
        operations.get(value.definition)?.output === value.id ||
          (!operations.has(value.definition) && omitted.has(value.definition)),
        "Native value/definition mismatch",
      );
    }
  requireFact(
    missing.size === omitted.size,
    "Native definition frontier contains unrelated identities",
  );
}

export function indexOperationFacts(rows, valueRows, omittedIDs) {
  const operations = unique(rows),
    values = unique(valueRows);
  validateOperands(operations, values);
  validateDefinitions(operations, values, omittedIDs);
  const users = new Map(),
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
          value_id: value.id,
          input_index: input.input_index,
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
        input_count: op.inputs.length,
        definition_count: definitions.length,
        constant_count: literals.length,
      }),
    );
  }
  return { operations, values, users, constants, normalized };
}

export function createOperationViews(
  indexes,
  coverage,
  frontierReasons = new Map(),
) {
  const { values, users, constants, normalized } = indexes;
  let valueUses;
  const model = {
    coverage,
    operation: (id) => normalized.get(id) ?? null,
    findConstant: (value) => [...new Set(constants.get(value) ?? [])],
    uses: (id) => users.get(id) ?? [],
    select: (input = {}) =>
      selectOperations(normalized, constants, {
        ...input,
        fields: input.fields ?? DEFAULT_NATIVE_OPERATION_FIELDS,
      }),
    values: createNativeValueReader(values, coverage),
    operationRelations: (input) => {
      if (input.kind === "value_uses" && !valueUses) {
        valueUses = new Map();
        for (const op of normalized.values())
          for (const row of op.inputs)
            if (row.value_id !== null)
              index(
                valueUses,
                row.value_id,
                freeze(operandRow(op.id, row, values)),
              );
      }
      return readOperationRelations(indexes, coverage, input, valueUses);
    },
    slice: (input) => sliceValues(model, values, input, frontierReasons),
  };
  return Object.freeze(model);
}

const operandRow = (operation, row, values) => ({
  operation,
  ...row,
  definition: values.get(row.value_id)?.definition ?? null,
});

function readOperationRelations(indexes, coverage, input, valueUses) {
  const { normalized, values, users } = indexes;
  const seeds = [...new Set(input.seeds)];
  const operands = input.kind === "operands";
  const byValue = input.kind === "value_uses";
  const indices = input.input_indices && [...new Set(input.input_indices)];
  const groups = seeds.map((seed) => {
    const op = normalized.get(seed);
    const rows = operands
      ? indices
        ? indices.flatMap((index) => op?.inputs[index] ?? [])
        : (op?.inputs ?? [])
      : byValue
        ? (valueUses.get(seed) ?? [])
        : input.kind === "definitions"
          ? (op?.definitions ?? [])
          : (users.get(seed) ?? []);
    return { seed, rows };
  });
  const offset = input.offset ?? 0,
    limit = input.limit ?? 20;
  let total = 0;
  const items = [];
  // Count groups without flattening every relation or copying unselected rows.
  for (const { seed, rows } of groups) {
    const start = Math.max(0, offset - total);
    const end = Math.min(rows.length, offset + limit - total);
    for (let i = start; i < end; i++) {
      const row = rows[i];
      items.push(operands ? operandRow(seed, row, values) : row);
    }
    total += rows.length;
  }
  return {
    items,
    total,
    next_offset: offset + limit < total ? offset + limit : null,
    unretained_seeds: seeds.filter(
      (id) => !(byValue ? values : normalized).has(id),
    ),
    relation_coverage: {
      scope: operands
        ? "all selected native input slots of retained operations; null values remain explicit"
        : input.kind === "uses" || byValue
          ? (coverage.uses_scope ??
            "complete-for-retained-recovered-operations")
          : "definitions of retained operands; missing defining bodies remain unknown",
      ...(operands
        ? {
            slot_presence:
              "out-of-range slots of retained seeds are absent; unretained seeds remain unknown",
            order:
              "distinct caller seed order, then distinct requested input-index order or native slot order",
          }
        : {}),
    },
  };
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
    ["id", "origin_address", "block", "is_dead"],
  );
}

function sliceValues(model, values, input, frontierReasons) {
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
      source_scope: model.coverage.scope,
      missing_reasons: result.coverage.missing.map((definition) => ({
        definition,
        reason: frontierReasons.get(definition) ?? "not-retained",
      })),
      relation_authority: "native SSA value identities and operand indexes",
    },
  };
}
