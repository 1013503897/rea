import test from "node:test";
import assert from "node:assert/strict";
import { parseNativeIR } from "./native-ir.mjs";

test("malformed compressed graph leaves independent call facts and code readable", () => {
  const doc = fixture();
  const originalCode = doc.functions[0].code;
  doc.functions[0].atomic_facts = {
    schema_version: 4,
    encoding: "gzip-base64",
    raw_bytes: 64,
    data: "AAAA",
  };
  const model = parseNativeIR(JSON.stringify(doc), "0x1000");
  assert.equal(model.code, originalCode);
  assert.equal(model.facets.recovered_ir.availability, "unavailable");
  assert.equal(model.facets.calls.availability, "available");
  assert.equal(model.calls({}).total, 2);
});

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
const fixtureValues = () => [
  value("v0", "fspec", "0x10000", { is_annotation: true }),
  value("v1", "const", "0x2a", { is_constant: true }),
  value("v2", "register", "0x30", { is_input: true }),
];
function fixture() {
  const operations = callOperations(),
    values = fixtureValues();
  const rows = [
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
  ];
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
          schema_version: 3,
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
          values,
          coverage: {
            scope: "native graph",
            machine_semantic_equivalence: "unknown",
            indirect_branch_operations: [],
            omitted_definition_ids: [],
            issues: [],
          },
        },
        atomic_calls: {
          schema_version: 1,
          items: rows.map((row, i) => ({
            ...row,
            origin_address: operations[i].address,
            block: 0,
            opcode: operations[i].opcode,
            is_dead: false,
            target_value_id: operations[i].inputs[0].value_id,
          })),
          values: structuredClone(values),
          coverage: {
            scope: "all recovered block-member CALL/CALLIND operations",
            blocks_examined: 1,
            operations_examined: 2,
            value_scope:
              "call inputs including target and outputs only; definitions may be outside this facet",
            machine_call_equivalence: "unknown",
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
      "is_dead",
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

test("bad call facets preserve valid graph and code; cross-facet conflicts disable call composition", () => {
  const changes = [
    (f) => {
      f.items.pop();
    },
    (f) => {
      f.items.push(f.items[0]);
    },
    (f) => {
      f.items[0].arguments[0].value_id = "v2";
    },
    (f) => {
      f.items[0].arguments[0].input_index = 0;
    },
    (f) => {
      f.items[0].arguments[0].storage_authority = null;
    },
    (f) => {
      f.items[1].target = { space: "ram", offset: "0x2000" };
    },
    (f) => {
      f.values[1].offset = "0x2b";
    },
    (f) => {
      f.schema_version = 2;
    },
  ];
  for (const change of changes) {
    const doc = fixture();
    change(doc.functions[0].atomic_calls);
    const model = parseNativeIR(JSON.stringify(doc), "0x1000");
    assert.equal(model.code, "retained code");
    assert.equal(model.facets.recovered_ir.availability, "available");
    assert.equal(model.facets.calls.availability, "unavailable");
    assert.throws(
      () => model.calls({}),
      (e) => e.code === "invalid_provider_output",
    );
    assert.equal(model.values({ ids: ["v1"] }).items[0].offset, "0x2a");
  }
});

test("graph capacity failure retains calls, boundary values and explicit unreadable definitions", () => {
  const doc = fixture(),
    fn = doc.functions[0];
  delete fn.atomic_facts;
  fn.atomic_facts_error = "atomic operation capacity exceeded";
  const model = parseNativeIR(JSON.stringify(doc), "0x1000");
  assert.equal(model.facets.recovered_ir.availability, "unavailable");
  assert.equal(model.facets.calls.availability, "available");
  assert.equal(model.facets.values.scope, "call-boundary-only");
  assert.equal(model.calls({}).total, 2);
  const values = model.values({ ids: ["v0", "v1", "missing"] });
  assert.equal(values.items[0].space, "fspec");
  assert.equal(values.items[1].offset, "0x2a");
  assert.deepEqual(values.missing, ["missing"]);
  assert.match(values.coverage.value_scope, /only/);
  assert.equal(values.coverage.scope, values.coverage.value_scope);
  assert.throws(
    () => model.select({}),
    (e) => e.code === "capability_unavailable",
  );
  assert.equal(
    model.calls({ ids: ["0x1110:0"], fields: ["target_value_id"] }).items[0]
      .target_value_id,
    "v2",
  );
});

test("malformed graph is isolated from valid calls; call-only malformed identities still fail", () => {
  const doc = fixture();
  doc.functions[0].atomic_facts.operations[0].output = "vbad";
  let model = parseNativeIR(JSON.stringify(doc), "0x1000");
  assert.equal(model.facets.recovered_ir.availability, "unavailable");
  assert.equal(model.facets.calls.availability, "available");
  assert.equal(model.values({ is_input: true }).items[0].id, "v2");
  doc.functions[0].atomic_calls.items[0].target_value_id = "vdead";
  model = parseNativeIR(JSON.stringify(doc), "0x1000");
  assert.equal(model.facets.calls.availability, "unavailable");
  assert.throws(
    () => model.values({}),
    (e) => e.code === "invalid_provider_output",
  );
  assert.equal(model.code, "retained code");
});

test("capture call counts distinguish target knowledge from opcode and include dead rows", () => {
  const doc = fixture(),
    fn = doc.functions[0];
  delete fn.atomic_facts;
  fn.atomic_facts_error = "capacity";
  const [direct, indirect] = fn.atomic_calls.items;
  direct.target = null;
  direct.is_dead = true;
  indirect.target = { space: "ram", offset: "0x3000" };
  indirect.spec_available = true;
  indirect.prototype = direct.prototype;
  const model = parseNativeIR(JSON.stringify(doc), "0x1000");
  assert.deepEqual(model.facets.calls.by_opcode, [
    { opcode: "CPUI_CALL", known_target_count: 0, unknown_target_count: 1 },
    { opcode: "CPUI_CALLIND", known_target_count: 1, unknown_target_count: 0 },
  ]);
  assert.equal(model.facets.calls.count, 2);
  assert.equal(model.facets.calls.coverage.machine_call_equivalence, "unknown");
  assert.equal(model.calls({ ids: [direct.id], fields: [] }).total, 1);
  assert.equal(model.facets.calls.count, 2);
  assert.throws(() => {
    model.facets.calls.by_opcode[0].known_target_count = 99;
  }, TypeError);
});

test("an empty available call facet has zero counts; unavailable counts remain absent", () => {
  const doc = fixture(),
    fn = doc.functions[0];
  delete fn.atomic_facts;
  fn.atomic_facts_error = "capacity";
  fn.atomic_calls.items = [];
  fn.atomic_calls.values = [];
  let model = parseNativeIR(JSON.stringify(doc), "0x1000");
  assert.equal(model.facets.calls.availability, "available");
  assert.equal(model.facets.calls.count, 0);
  assert.ok(
    model.facets.calls.by_opcode.every(
      (r) => r.known_target_count === 0 && r.unknown_target_count === 0,
    ),
  );
  delete fn.atomic_calls;
  fn.atomic_calls_error = "capacity";
  model = parseNativeIR(JSON.stringify(doc), "0x1000");
  assert.equal(model.facets.calls.availability, "unavailable");
  assert.equal(Object.hasOwn(model.facets.calls, "count"), false);
  assert.equal(Object.hasOwn(model.facets.calls, "by_opcode"), false);
});
