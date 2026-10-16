import test from "node:test";
import assert from "node:assert/strict";
import { methods } from "./api.mjs";
import { freezeFacts } from "./fact-reads.mjs";
import {
  indexOperationFacts,
  createOperationViews,
} from "./native-operation-views.mjs";

const location = (space, offset = "0x38", size_bytes = 8) => ({
  space,
  offset,
  size_bytes,
});
const value = (id, definition, extra = {}) => ({
  id,
  definition,
  ...location("register"),
  is_constant: false,
  is_input: definition === null,
  is_annotation: false,
  type_name: "",
  ...extra,
});
const slot = (input_index, value_id, predecessor = null) => ({
  input_index,
  value_id,
  phi_predecessor: predecessor,
  phi_predecessor_edge: predecessor === null ? null : `${predecessor}:0`,
});
function model(
  coverage = { scope: "retained graph", memory_alias_dependencies: "unknown" },
) {
  const values = [
    value("v1", null),
    value("v2", null, { space: "const", is_input: false, is_constant: true }),
    value("v3", "0x10:0"),
    value("v4", "0x11:0", location("unique", "0x9")),
    value("v5", null, { space: null }),
    value("v6", null, { size_bytes: 4 }),
  ];
  const op = (id, opcode, inputs, output = null) => ({
    id,
    address: id.split(":")[0],
    block: 0,
    opcode,
    inputs,
    output,
    statement: "unparseable display",
    is_dead: false,
  });
  const operations = [
    op("0x10:0", "CPUI_INT_ADD", [slot(0, "v1"), slot(1, "v1")], "v3"),
    op(
      "0x11:0",
      "CPUI_MULTIEQUAL",
      [slot(0, "v3", 8), slot(1, "v3", 9), slot(2, "v2", 10)],
      "v4",
    ),
    op("0x12:0", "CPUI_CALLOTHER", [
      slot(0, "v5"),
      slot(1, "v6"),
      slot(2, "v2"),
      slot(3, "v4"),
      slot(4, null),
    ]),
  ];
  freezeFacts({ values, operations });
  return createOperationViews(
    indexOperationFacts(operations, values, []),
    coverage,
  );
}

test("exact location batches preserve width, space, value versions and paging order", () => {
  const m = model();
  const locations = [
    location("register", "0x38", 4),
    location("register"),
    location("register"),
  ];
  const result = m.values({ locations });
  assert.deepEqual(
    result.items.map((v) => v.id),
    ["v6", "v1", "v3"],
  );
  assert.equal(result.total, 3);
  assert.equal(result.location_coverage.unknown_space_count, 1);
  assert.deepEqual(result.unretained_locations, []);
  const page = m.values({ locations, offset: 1, limit: 1, fields: [] });
  assert.deepEqual(page.items, [{ id: "v1" }]);
  assert.equal(page.total, 3);
  assert.equal(page.next_offset, 2);
  assert.deepEqual(
    m.values({ locations: [location("const")] }).items.map((v) => v.id),
    ["v2"],
  );
});

test("location filters intersect IDs/input flags; unknown spaces are not known absent locations", () => {
  const m = model();
  const unknown = location("ram");
  const result = m.values({
    ids: ["v3", "v1", "vdead", "v6"],
    locations: [location("register"), unknown],
    is_input: true,
  });
  assert.deepEqual(
    result.items.map((v) => v.id),
    ["v1"],
  );
  assert.deepEqual(result.missing, ["vdead"]);
  assert.deepEqual(result.unretained_locations, [unknown]);
  assert.equal(result.location_coverage.unknown_space_count, 1);
  assert.equal(m.values({ ids: ["v5"] }).items[0].space, null);
  const empty = () => m.values({ locations: [], ids: ["v1"] });
  assert.equal(empty().total, 0);
  assert.equal(empty().location_coverage.unknown_space_count, null);
  assert.equal(
    m.values({ locations: [location("register")], ids: [] }).total,
    0,
  );
});

test("value uses include repeated function-input/constant occurrences and exact PHI slots", () => {
  const m = model();
  const inputs = m.operationRelations({
    kind: "value_uses",
    seeds: ["v1", "vdead", "v1"],
  });
  assert.deepEqual(
    inputs.items,
    [0, 1].map((input_index) => ({
      operation: "0x10:0",
      input_index,
      value_id: "v1",
      definition: null,
      phi_predecessor: null,
      phi_predecessor_edge: null,
    })),
  );
  assert.deepEqual(inputs.unretained_seeds, ["vdead"]);
  assert.deepEqual(
    m
      .operationRelations({ kind: "value_uses", seeds: ["v2"] })
      .items.map((r) => [r.operation, r.input_index]),
    [
      ["0x11:0", 2],
      ["0x12:0", 2],
    ],
  );
  const uses = m.operationRelations({
    kind: "value_uses",
    seeds: ["v3", "v1"],
    offset: 1,
    limit: 2,
  });
  assert.equal(uses.total, 4);
  assert.equal(uses.next_offset, 3);
  assert.equal(uses.items[0].phi_predecessor_edge, "9:0");
  assert.equal(uses.items[0].input_index, 1);
  assert.equal(uses.items[1].definition, null);
  assert.equal(uses.items[1].value_id, "v1");
  assert.deepEqual(
    uses.items[0],
    m.operationRelations({
      kind: "operands",
      seeds: ["0x11:0"],
      input_indices: [1],
    }).items[0],
  );
});

test("reverse indexes preserve partial-use coverage and immutable source facts", () => {
  const m = model({
    scope: "bounded projection",
    uses_scope: "selected-operations-only",
    memory_alias_dependencies: "unknown",
  });
  const result = m.operationRelations({ kind: "value_uses", seeds: ["v3"] });
  assert.equal(result.relation_coverage.scope, "selected-operations-only");
  assert.throws(() => {
    result.items[0].value_id = "vdead";
  }, TypeError);
  assert.throws(() => {
    m.values({ locations: [location("register")] }).items[0].offset = "0x99";
  }, TypeError);
  assert.equal(
    m.operationRelations({ kind: "value_uses", seeds: ["v3"] }).total,
    2,
  );
});

test("named contracts distinguish location coordinates, value seeds and operand slot filters", () => {
  const good = { snapshot: "snap_test", locations: [location("ram")] };
  assert.equal(methods.values.input.safeParse(good).success, true);
  for (const coordinate of [
    location(null),
    location("ram", "0x00"),
    location("ram", "0x38", 0),
  ])
    assert.equal(
      methods.values.input.safeParse({ ...good, locations: [coordinate] })
        .success,
      false,
    );
  assert.equal(
    methods.values.input.safeParse({ ...good, locations: [] }).success,
    true,
  );
  assert.equal(
    methods.relations.input.safeParse({
      snapshot: "snap_test",
      kind: "value_uses",
      seeds: ["v1"],
    }).success,
    true,
  );
  assert.equal(
    methods.relations.input.safeParse({
      snapshot: "snap_test",
      kind: "value_uses",
      seeds: [1],
    }).success,
    false,
  );
  assert.equal(
    methods.relations.input.safeParse({
      snapshot: "snap_test",
      kind: "value_uses",
      seeds: ["v1"],
      input_indices: [0],
    }).success,
    false,
  );
});
