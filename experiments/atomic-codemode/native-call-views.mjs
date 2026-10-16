import { callCoverage } from "./native-calls.mjs";
import { requireFact, requireSameNativeValue } from "./native-contract.mjs";
import { uniqueNative, readNativeIdentities } from "./native-reads.mjs";
import { freezeFacts } from "./fact-reads.mjs";

export function indexCallFacet(facts) {
  const calls = uniqueNative(facts.items),
    values = uniqueNative(facts.values),
    used = new Set();
  requireFact(
    calls.size <= facts.coverage.operations_examined,
    "Native call count exceeds examined operation coverage",
  );
  const reference = (id) => {
    requireFact(
      id === null || values.has(id),
      "Dangling native call-boundary value",
    );
    if (id !== null) used.add(id);
  };
  for (const row of calls.values()) {
    requireFact(
      row.id.split(":")[0] === row.origin_address,
      "Native call origin/identity mismatch",
    );
    reference(row.target_value_id);
    reference(row.output);
    requireFact(
      row.output === null || values.get(row.output).definition === row.id,
      "Native call output/definition mismatch",
    );
    for (const [i, a] of row.arguments.entries()) {
      reference(a.value_id);
      requireFact(
        a.input_index === i + 1 &&
          (a.storage === null) === (a.storage_authority === null),
        "Native call input/storage binding mismatch",
      );
    }
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
  }
  requireFact(
    used.size === values.size,
    "Native call boundary contains unrelated values",
  );
  for (const value of values.values())
    if (value.definition !== null && calls.has(value.definition))
      requireFact(
        calls.get(value.definition).output === value.id,
        "Native boundary value/known-call definition mismatch",
      );
  return { calls, values };
}
export function validateCallGraph(callIndex, graphIndex) {
  const { calls, values } = callIndex,
    { operations } = graphIndex;
  for (const row of calls.values()) {
    const op = operations.get(row.id);
    requireFact(
      op &&
        op.address === row.origin_address &&
        op.block === row.block &&
        op.opcode === row.opcode &&
        op.is_dead === row.is_dead &&
        op.output === row.output,
      "Native call/graph ownership mismatch",
    );
    requireFact(
      row.target_value_id === (op.inputs[0]?.value_id ?? null) &&
        row.arguments.length === Math.max(0, op.inputs.length - 1) &&
        row.arguments.every((a, i) => a.value_id === op.inputs[i + 1].value_id),
      "Native call/graph operand mismatch",
    );
  }
  for (const value of values.values())
    requireSameNativeValue(
      value,
      graphIndex.values.get(value.id),
      "Native call/graph value mismatch",
    );
  for (const op of operations.values())
    requireFact(
      !["CPUI_CALL", "CPUI_CALLIND"].includes(op.opcode) || calls.has(op.id),
      "Native call operation omitted from call coverage",
    );
}
const summarizeCalls = (calls, coverage) => {
  const counts = {
    CPUI_CALL: { known_target_count: 0, unknown_target_count: 0 },
    CPUI_CALLIND: { known_target_count: 0, unknown_target_count: 0 },
  };
  for (const row of calls.values())
    counts[row.opcode][
      row.target === null ? "unknown_target_count" : "known_target_count"
    ]++;
  return freezeFacts({
    count: calls.size,
    by_opcode: Object.entries(counts).map(([opcode, row]) => ({
      opcode,
      ...row,
    })),
    coverage,
  });
};
export function createCallViews(facts, indexes) {
  const { calls, values } = indexes;
  freezeFacts(facts);
  const coverage = freezeFacts({
    ...callCoverage,
    ...facts.coverage,
    definition_operations: "not collected in call-boundary facet",
  });
  const valueCoverage = freezeFacts({
    ...coverage,
    scope: facts.coverage.value_scope,
  });
  return {
    calls: (input) => ({
      ...readNativeIdentities(
        calls,
        {
          fields: [
            "spec_available",
            "opcode",
            "is_dead",
            "target",
            "target_name",
            "arguments",
            "output",
          ],
          ...input,
          ...(input.fields && {
            fields: ["spec_available", "opcode", "is_dead", ...input.fields],
          }),
        },
        (r) =>
          !input.origin_addresses ||
          input.origin_addresses.includes(r.origin_address),
      ),
      coverage,
    }),
    values: (input) => ({
      ...readNativeIdentities(
        values,
        input,
        (r) => input.is_input === undefined || r.is_input === input.is_input,
      ),
      coverage: valueCoverage,
    }),
    summary: summarizeCalls(calls, coverage),
    value_count: values.size,
  };
}
