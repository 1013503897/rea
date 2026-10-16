import test from "node:test";
import assert from "node:assert/strict";
import { parseNativeIR } from "./native-ir.mjs";

const value = (id, definition, extra = {}) => ({
  id,
  definition,
  space: "register",
  offset: "0x30",
  size_bytes: 8,
  is_constant: false,
  is_input: false,
  is_annotation: false,
  type_name: "",
  ...extra,
});
const input = (input_index, value_id, predecessor = null, edge = null) => ({
  input_index,
  value_id,
  phi_predecessor: predecessor,
  phi_predecessor_edge: edge,
});
const op = (id, opcode, inputs, output = null) => ({
  id,
  address: id.split(":")[0],
  block: 9,
  opcode,
  inputs,
  output,
  statement: "unparseable display",
  is_dead: false,
});
function fixture() {
  const operations = [
    op("0x1100:1", "CPUI_CALL", [
      input(0, "v0"),
      input(1, "v3"),
      input(2, "v7"),
      input(3, "v9"),
    ]),
    op(
      "0x1080:2",
      "CPUI_MULTIEQUAL",
      [input(0, "v1", 7, "7:1"), input(1, "v2", 8, "8:0")],
      "v3",
    ),
    op("0x1050:3", "CPUI_PTRSUB", [input(0, "v4"), input(1, "v5")], "v1"),
    op("0x1060:4", "CPUI_PTRSUB", [input(0, "v4"), input(1, "v6")], "v2"),
  ];
  const values = [
    value("v0", null, {
      space: "fspec",
      offset: "0x10000",
      is_annotation: true,
    }),
    value("v1", "0x1050:3"),
    value("v2", "0x1060:4"),
    value("v3", "0x1080:2"),
    value("v4", null, { space: "const", offset: "0x0", is_constant: true }),
    value("v5", null, { space: "const", offset: "0x2100", is_constant: true }),
    value("v6", null, { space: "const", offset: "0x2200", is_constant: true }),
    value("v7", null, { is_input: true }),
    value("v9", "0x9000:0"),
  ];
  return {
    binary: "/input",
    count: 1,
    language: "c",
    error: null,
    functions: [
      {
        address_hex: "0x1000",
        code: "retained C",
        error: null,
        atomic_facts_error: "atomic operation capacity exceeded",
        atomic_projection: {
          schema_version: 1,
          roots: ["0x1100:1"],
          operations,
          values,
          coverage: {
            scope: "call-rooted bounded backward SSA definitions",
            operation_budget: 4096,
            frontier: [
              {
                definition: "0x9000:0",
                reason: "outside-recovered-membership",
              },
            ],
            issues: [],
            machine_semantic_equivalence: "unknown",
          },
        },
        atomic_calls: {
          schema_version: 1,
          items: [
            {
              id: "0x1100:1",
              origin_address: "0x1100",
              block: 9,
              opcode: "CPUI_CALL",
              is_dead: false,
              target_value_id: "v0",
              spec_available: false,
              target: null,
              target_name: null,
              arguments: ["v3", "v7", "v9"].map((value_id, i) => ({
                input_index: i + 1,
                value_id,
                storage: null,
                storage_authority: null,
              })),
              output: null,
              prototype: null,
              stack_offset: null,
            },
          ],
          values: structuredClone(
            values.filter((v) => ["v0", "v3", "v7", "v9"].includes(v.id)),
          ),
          coverage: {
            scope: "all recovered block-member CALL/CALLIND operations",
            blocks_examined: 10,
            operations_examined: 100,
            value_scope: "call inputs including target and outputs only",
            machine_call_equivalence: "unknown",
          },
        },
      },
    ],
  };
}

test("operand relations preserve every slot, page across seeds and select exact caller indices", () => {
  const source = fixture();
  source.functions[0].atomic_projection.operations[1].inputs.push(
    input(2, "v5", 2, "2:0"),
    input(3, "v7", 3, "3:0"),
    input(4, null, 4, "4:0"),
  );
  const model = parseNativeIR(JSON.stringify(source), "0x1000");
  const read = (extra = {}) =>
    model.edges({
      kind: "operands",
      seeds: ["0x1080:2"],
      offset: 0,
      limit: 2,
      ...extra,
    });
  const first = read();
  assert.equal(first.total, 5);
  assert.equal(first.next_offset, 2);
  assert.deepEqual(
    first.items.map((r) => r.input_index),
    [0, 1],
  );
  assert.deepEqual(
    read({ offset: 2, limit: 10 }).items.map((r) => r.definition),
    [null, null, null],
  );
  const selected = read({ input_indices: [4, 2, 4, 500], limit: 10 });
  assert.equal(selected.total, 2);
  assert.equal(selected.items[0].value_id, null);
  assert.deepEqual(
    selected.items.map((r) => [r.input_index, r.phi_predecessor_edge]),
    [
      [4, "4:0"],
      [2, "2:0"],
    ],
  );
  assert.equal(read({ input_indices: [] }).total, 0);
  const batch = read({
    seeds: ["0x1080:2", "0x1050:3", "0x1050:3", "0x9000:0"],
    offset: 4,
    limit: 2,
  });
  assert.equal(batch.total, 7);
  assert.equal(batch.next_offset, 6);
  assert.deepEqual(
    batch.items.map((r) => [r.operation, r.input_index]),
    [
      ["0x1080:2", 4],
      ["0x1050:3", 0],
    ],
  );
  assert.deepEqual(batch.unretained_seeds, ["0x9000:0"]);
  assert.equal(
    read({ seeds: ["0x1100:1"], input_indices: [3] }).items[0].definition,
    "0x9000:0",
  );
  const summary = model.select({ ids: ["0x1080:2"] }).items[0];
  assert.equal(summary.input_count, 5);
  assert.equal(summary.definition_count, 2);
  assert.equal(summary.constant_count, 1);
  assert.equal(Object.hasOwn(summary, "inputs"), false);
  const repeatedValues = model.values({ ids: ["v3", "v3", "vbad", "vbad"] });
  assert.deepEqual(
    repeatedValues.items.map((v) => v.id),
    ["v3"],
  );
  assert.deepEqual(repeatedValues.missing, ["vbad"]);
});

test("partial definition facts compose through phi operands without implying a CFG or full uses", () => {
  const model = parseNativeIR(JSON.stringify(fixture()), "0x1000");
  assert.equal(model.facets.recovered_ir.availability, "unavailable");
  assert.equal(
    model.facets.operations.scope,
    "bounded-call-rooted-definitions",
  );
  assert.equal(model.facets.values.scope, "call-rooted-definitions");
  assert.equal(model.coverage.definition_frontier_count, 1);
  assert.equal(JSON.stringify(model.coverage).includes("0x9000:0"), false);
  const phi = model.select({
    ids: ["0x1080:2"],
    fields: ["inputs", "output"],
    limit: 1,
  }).items[0];
  assert.equal(phi.output, "v3");
  assert.equal(phi.inputs[0].phi_predecessor_edge, "7:1");
  assert.throws(() => {
    phi.inputs[0].value_id = "vdead";
  }, TypeError);
  const sliced = model.slice({
    seeds: ["0x1100:1"],
    max_operations: 10,
    stop_kinds: [],
  });
  assert.equal(sliced.operations.length, 4);
  assert.equal(sliced.coverage.status, "partial");
  assert.deepEqual(sliced.coverage.missing_reasons, [
    { definition: "0x9000:0", reason: "outside-recovered-membership" },
  ]);
  assert.deepEqual(sliced.value_frontier, [
    { value_id: "v7", reason: "function-input" },
  ]);
  assert.deepEqual(model.findConstant("0x2100"), ["0x1050:3"]);
  const uses = model.edges({
    kind: "uses",
    seeds: ["0x9000:0"],
    offset: 0,
    limit: 10,
  });
  assert.equal(uses.items.length, 1);
  assert.deepEqual(uses.unretained_seeds, ["0x9000:0"]);
  assert.match(uses.relation_coverage.scope, /selected-operations-only/);
  const inputUses = model.edges({ kind: "value_uses", seeds: ["v7"] });
  assert.ok(
    inputUses.items.some(
      (row) =>
        row.operation === "0x1100:1" &&
        row.input_index === 2 &&
        row.definition === null,
    ),
  );
  assert.match(inputUses.relation_coverage.scope, /selected-operations-only/);
  const inputValue = model.values({ ids: ["v7"] }).items[0];
  const located = model.values({
    ids: ["v7"],
    locations: [
      {
        space: inputValue.space,
        offset: inputValue.offset,
        size_bytes: inputValue.size_bytes,
      },
    ],
  });
  assert.deepEqual(located.items, [inputValue]);
  assert.equal(located.coverage.value_scope, model.coverage.value_scope);
  for (const read of [
    () => model.blocks({}),
    () => model.path({ from: 9, target: { kind: "exit" } }),
    () => model.edges({ kind: "controllers", seeds: [9] }),
  ])
    assert.throws(read, (e) => e.code === "capability_unavailable");
});

test("bad or contradictory projections preserve independently valid call facts and code", () => {
  const changes = [
    (p) => {
      p.operations[1].inputs[0].value_id = "vdead";
    },
    (p) => {
      p.coverage.frontier = [];
    },
    (p) => {
      p.coverage.frontier[0].reason = "operation-budget";
    },
    (p) => {
      p.roots = ["0x1050:3"];
    },
    (p) => {
      p.roots.push("0x1100:1");
    },
    (p) => {
      p.operations.push(op("0x1070:5", "CPUI_COPY", [input(0, "v7")]));
    },
    (p) => {
      p.values[3].offset = "0xbad";
    },
    (p) => {
      p.coverage.frontier = Array(12289).fill(null);
    },
  ];
  for (const change of changes) {
    const doc = fixture();
    change(doc.functions[0].atomic_projection);
    const model = parseNativeIR(JSON.stringify(doc), "0x1000");
    assert.equal(model.code, "retained C");
    assert.equal(model.facets.operations.availability, "unavailable");
    assert.equal(model.facets.calls.availability, "available");
    assert.equal(model.facets.values.scope, "call-boundary-only");
    assert.ok(JSON.stringify(model.facets.operations.error).length < 4096);
  }
});

test("bad call facets do not erase valid projection definitions", () => {
  const doc = fixture();
  doc.functions[0].atomic_calls.items[0].arguments[0].value_id = "vdead";
  const model = parseNativeIR(JSON.stringify(doc), "0x1000");
  assert.equal(model.facets.calls.availability, "unavailable");
  assert.equal(model.facets.operations.availability, "available");
  assert.equal(model.values({ ids: ["v5"] }).items[0].offset, "0x2100");
});

test("compact coverage bounds issue text while slices retain the actual issue count", () => {
  const doc = fixture();
  doc.functions[0].atomic_projection.coverage.issues = Array(10).fill(
    "x".repeat(10000),
  );
  const model = parseNativeIR(JSON.stringify(doc), "0x1000");
  assert.equal(model.coverage.issue_count, 10);
  assert.equal(model.coverage.issues.length, 8);
  assert.equal(model.coverage.issues_omitted, 2);
  assert.equal(model.coverage.issue_messages_truncated, true);
  assert.ok(JSON.stringify(model.coverage).length < 4096);
  assert.equal(
    model.slice({ seeds: ["0x1100:1"], max_operations: 10 }).coverage
      .source_issues,
    10,
  );
});
