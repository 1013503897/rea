import test from "node:test";
import assert from "node:assert/strict";
import { parseNativeIR } from "./native-ir.mjs";

const input = (input_index, value_id) => ({
  input_index,
  value_id,
  phi_predecessor: null,
  phi_predecessor_edge: null,
});
const value = (id, space, offset, flags = {}) => ({
  id,
  space,
  offset,
  size_bytes: 8,
  is_constant: false,
  is_annotation: false,
  is_input: false,
  definition: null,
  type_name: "",
  ...flags,
});
const callOperations = () => [
  {
    id: "0x1100:0",
    address: "0x1100",
    block: 0,
    opcode: "CPUI_CALL",
    statement: "deliberately misleading target 0xbad",
    is_dead: false,
    inputs: [input(0, "v0"), input(1, "v1"), input(2, "v2")],
    output: null,
  },
  {
    id: "0x1110:0",
    address: "0x1110",
    block: 0,
    opcode: "CPUI_CALLIND",
    statement: "not a signature",
    is_dead: false,
    inputs: [input(0, "v2")],
    output: null,
  },
];
function fixture() {
  const operations = callOperations();
  return {
    binary: "/input",
    count: 1,
    language: "c",
    error: null,
    functions: [
      {
        address_hex: "0x1000",
        code: "retained code",
        error: null,
        atomic_facts: {
          schema_version: 2,
          blocks: [
            {
              id: 0,
              start: "0x1000",
              operations: operations.map((o) => o.id),
              predecessors: [],
              successors: [],
            },
          ],
          operations,
          values: [
            value("v0", "fspec", "0x10000", { is_annotation: true }),
            value("v1", "const", "0x2a", { is_constant: true }),
            value("v2", "register", "0x30", { is_input: true }),
          ],
          calls: [
            {
              id: "0x1100:0",
              spec_available: true,
              target: { space: "ram", offset: "0x2000" },
              target_name: "callee",
              arguments: [
                {
                  input_index: 1,
                  value_id: "v1",
                  storage: { space: "register", offset: "0x38", size_bytes: 8 },
                  storage_authority: "final-input-storage",
                },
                {
                  input_index: 2,
                  value_id: "v2",
                  storage: null,
                  storage_authority: null,
                },
              ],
              output: null,
              prototype: {
                model: "__cdecl",
                model_unknown: false,
                inputs_locked: false,
                variadic: false,
                parameter_shift: 0,
              },
              stack_offset: null,
            },
            {
              id: "0x1110:0",
              spec_available: false,
              target: null,
              target_name: null,
              arguments: [],
              output: null,
              prototype: null,
              stack_offset: null,
            },
          ],
          coverage: {
            scope: "native graph",
            machine_semantic_equivalence: "unknown",
            indirect_branch_operations: [],
            omitted_definition_ids: [],
            issues: [],
          },
        },
      },
    ],
  };
}

test("structured calls separate fspec identity, SSA value and passing location; missing targets stay unknown", () => {
  const model = parseNativeIR(JSON.stringify(fixture()), "0x1000");
  const result = model.calls({ limit: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.next_offset, 1);
  const row = result.items[0];
  assert.deepEqual(row.target, { space: "ram", offset: "0x2000" });
  assert.equal(row.arguments[0].value_id, "v1");
  assert.equal(row.arguments[0].storage.offset, "0x38");
  assert.equal(row.arguments[1].storage, null);
  assert.equal(model.values({ ids: ["v1"] }).items[0].offset, "0x2a");
  assert.equal(Object.hasOwn(row, "prototype"), false);
  assert.throws(() => {
    row.arguments[0].storage.offset = "0xbad";
  }, TypeError);
  const unknown = model.calls({ offset: 1 }).items[0];
  assert.equal(unknown.target, null);
  assert.equal(unknown.spec_available, false);
  assert.equal(result.coverage.machine_call_equivalence, "unknown");
  assert.equal(result.coverage.source_parameter_ordinals, "unknown");
});

test("selected call pages and function input values compose without full reports", () => {
  const model = parseNativeIR(JSON.stringify(fixture()), "0x1000");
  const result = model.calls({
    ids: ["0x1100:0", "missing"],
    origin_addresses: ["0x1100"],
    fields: ["prototype"],
  });
  assert.deepEqual(result.missing, ["missing"]);
  assert.deepEqual(
    Object.keys(result.items[0]).sort(),
    [
      "id",
      "origin_address",
      "block",
      "spec_available",
      "opcode",
      "prototype",
    ].sort(),
  );
  assert.equal(
    model.calls({ ids: ["0x1100:0"], origin_addresses: [] }).total,
    0,
  );
  assert.deepEqual(
    model.values({ is_input: true }).items.map((v) => v.id),
    ["v2"],
  );
  assert.equal(model.values({ is_input: true, ids: ["v1"] }).total, 0);
});

test("missing, duplicate or forged call relations reject the graph while retaining code", () => {
  const changes = [
    (facts) => {
      facts.calls.pop();
    },
    (facts) => {
      facts.calls.push(facts.calls[0]);
    },
    (facts) => {
      facts.calls[0].arguments[0].value_id = "v2";
    },
    (facts) => {
      facts.calls[0].arguments[0].input_index = 0;
    },
    (facts) => {
      facts.calls[0].arguments[0].storage_authority = null;
    },
    (facts) => {
      facts.calls[1].target = { space: "ram", offset: "0x2000" };
    },
    (facts) => {
      facts.schema_version = 1;
    },
  ];
  for (const change of changes) {
    const doc = fixture();
    change(doc.functions[0].atomic_facts);
    const model = parseNativeIR(JSON.stringify(doc), "0x1000");
    assert.equal(model.code, "retained code");
    assert.equal(model.facets.recovered_ir.availability, "unavailable");
    assert.throws(
      () => model.calls({}),
      (error) => error.code === "invalid_provider_output",
    );
  }
});
