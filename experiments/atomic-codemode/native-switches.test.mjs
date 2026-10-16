import assert from "node:assert/strict";
import test from "node:test";
import { parseNativeIR } from "./native-ir.mjs";

const switchID = "0x1000:1";
const edge = (index, target) => ({ id: `0:${index}`, index, target });
function tableFixture() {
  return {
    partial: true,
    labelled: true,
    consumed_mask: "0xff",
    signed_render_hint: true,
    default_raw_index: 1,
    default_edge: edge(1, 2),
    default_is_folded: true,
    rows: [
      {
        index: 0,
        label: { status: "value", raw_bits: "0x42" },
        recovered_target: { space: "ram", offset: "0xabc" },
        edges: [edge(0, 1)],
      },
      {
        index: 1,
        label: { status: "value", raw_bits: "0x7" },
        recovered_target: { space: "ram", offset: "0xdef" },
        edges: [edge(0, 1)],
      },
      {
        index: 2,
        label: { status: "no-label", raw_bits: "0xbad1abe1bad1abe1" },
        recovered_target: { space: "ram", offset: "0xf00" },
        edges: [edge(1, 2)],
      },
      { index: 3, label: null, recovered_target: null, edges: [] },
    ],
  };
}
function graphFixture(selector) {
  const operation = (address, block, opcode, inputs = []) => ({
    id: `${address}:1`,
    address,
    block,
    opcode,
    inputs,
    output: null,
    statement: "uninterpreted display",
    is_dead: false,
  });
  return {
    schema_version: 3,
    blocks: [
      {
        id: 0,
        start: "0x1000",
        operations: [switchID],
        predecessors: [],
        successors: [edge(0, 1), edge(1, 2)].map((e) => ({
          ...e,
          polarity: null,
          condition_value: null,
          condition_test: null,
        })),
      },
      {
        id: 1,
        start: "0x1010",
        operations: ["0x1010:1"],
        predecessors: [0],
        successors: [],
      },
      {
        id: 2,
        start: "0x1020",
        operations: ["0x1020:1"],
        predecessors: [0],
        successors: [],
      },
    ],
    operations: [
      operation("0x1000", 0, "CPUI_BRANCHIND", [
        {
          input_index: 0,
          value_id: "v1",
          phi_predecessor: null,
          phi_predecessor_edge: null,
        },
      ]),
      operation("0x1010", 1, "CPUI_RETURN"),
      operation("0x1020", 2, "CPUI_RETURN"),
    ],
    values: [{ ...selector }],
    coverage: {
      scope: "fixture recovered graph",
      machine_semantic_equivalence: "unknown",
      indirect_branch_operations: [switchID],
      omitted_definition_ids: [],
      issues: [],
    },
  };
}
function fixture() {
  const selector = {
    id: "v1",
    space: "register",
    offset: "0x10",
    size_bytes: 8,
    is_constant: false,
    is_input: true,
    is_annotation: false,
    definition: null,
    type_name: "uint64",
  };
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
        atomic_facts: graphFixture(selector),
        atomic_switches: {
          schema_version: 1,
          items: [
            {
              id: switchID,
              origin_address: "0x1000",
              block: 0,
              selector,
              table: tableFixture(),
            },
          ],
          coverage: {
            scope: "captured native tables",
            blocks_examined: 3,
            operations_examined: 3,
            machine_semantic_equivalence: "unknown",
          },
        },
      },
    ],
  };
}
const load = (doc) => parseNativeIR(JSON.stringify(doc), "0x1000");
const cases = (model, extra = {}) =>
  model.edges({ kind: "cases", seeds: [switchID], ...extra });

test("case-to-edge paging bounds a single case with several mappings and keeps a stable case identity", () => {
  const doc = fixture();
  doc.functions[0].atomic_switches.items[0].table.rows[0].edges.push(
    edge(1, 2),
  );
  const model = load(doc),
    first = cases(model, { case_values: ["0x42"], limit: 1 }),
    second = cases(model, { case_values: ["0x42"], offset: 1, limit: 1 });
  assert.equal(model.switches({}).items[0].table.case_count, 4);
  assert.equal(model.switches({}).items[0].table.relation_count, 5);
  assert.equal(first.total, 2);
  assert.equal(first.items.length, 1);
  assert.equal(first.next_offset, 1);
  assert.equal(first.items[0].case_id, second.items[0].case_id);
  assert.notEqual(first.items[0].id, second.items[0].id);
  assert.equal(first.items[0].edge.index, 0);
  assert.equal(second.items[0].edge.index, 1);
  assert.equal(second.next_offset, null);
});

test("a late two-edge page does not materialize thousands of unrequested mappings", () => {
  const doc = fixture(),
    fn = doc.functions[0];
  delete fn.atomic_facts;
  const table = fn.atomic_switches.items[0].table;
  table.rows = table.rows.slice(0, 1);
  table.rows[0].edges = Array.from({ length: 4096 }, (_, i) => edge(i, i + 1));
  fn.atomic_switches.coverage.blocks_examined = 4097;
  fn.atomic_switches.coverage.operations_examined = 4097;
  const model = load(doc);
  const page = cases(model, { case_values: ["0x42"], offset: 4090, limit: 2 });
  assert.equal(page.total, 4096);
  assert.equal(page.next_offset, 4092);
  assert.deepEqual(
    page.items.map((r) => r.edge.index),
    [4090, 4091],
  );
  assert.equal(page.items[0].case_id, page.items[1].case_id);
  assert.ok(Buffer.byteLength(JSON.stringify(page.items)) < 1024);
});

test("case ordinals, labels, original targets and optimized edges remain distinct and paged", () => {
  const model = load(fixture());
  assert.equal(model.facets.switches.availability, "available");
  const sw = model.switches({ fields: ["table"] }).items[0];
  assert.equal(sw.selector, undefined);
  assert.equal(sw.table.case_count, 4);
  assert.equal(sw.table.known_label_count, 2);
  assert.equal(sw.table.missing_label_count, 1);
  assert.equal(sw.table.no_label_count, 1);
  assert.equal(sw.table.unmapped_row_count, 1);
  assert.equal(sw.table.default_edge.id, "0:1");
  const page = cases(model, {
    seeds: [switchID, switchID, "unknown"],
    case_values: ["0x7", "0x42", "0xbad1abe1bad1abe1"],
    limit: 1,
  });
  assert.equal(page.total, 2);
  assert.equal(page.next_offset, 1);
  assert.deepEqual(page.unretained_seeds, ["unknown"]);
  assert.equal(page.items[0].case_index, 0);
  assert.equal(page.items[0].label.raw_bits, "0x42");
  assert.equal(page.items[0].recovered_target.offset, "0xabc");
  assert.equal(page.items[0].edge.target, 1);
  assert.throws(() => {
    page.items[0].edge.target = 2;
  }, TypeError);
  assert.equal(cases(model, { case_indices: [0] }).items[0].edge.target, 1);
  assert.equal(model.block(1).origin_start, "0x1010");
  const second = cases(model, {
    case_values: ["0x42", "0x7"],
    offset: 1,
    limit: 1,
  });
  assert.equal(second.items[0].case_index, 1);
  assert.equal(second.next_offset, null);
  assert.deepEqual(
    cases(model, { case_indices: [2, 0, 1], case_values: ["0x7"] }).items.map(
      (r) => r.case_index,
    ),
    [1],
  );
  assert.equal(cases(model, { case_values: [] }).total, 0);
});
test("unlabelled/unmapped and partial or unavailable tables do not become absent runtime cases", () => {
  const doc = fixture(),
    model = load(doc);
  assert.equal(cases(model, { case_values: ["0xbad1abe1bad1abe1"] }).total, 0);
  const source = cases(model, { case_indices: [2, 3] });
  assert.equal(source.items[0].label.status, "no-label");
  assert.equal(source.items[1].label, null);
  assert.deepEqual(source.items[1].edge, null);
  assert.equal(source.relation_coverage.switches[0].partial, true);
  assert.equal(source.coverage.runtime_feasibility, "unknown");
  doc.functions[0].atomic_switches.items[0].table = null;
  const unknown = cases(load(doc));
  assert.equal(unknown.relation_coverage.switches[0].table_available, false);
  assert.equal(unknown.relation_coverage.switches[0].case_count, null);
});
test("switch rows survive graph failure and missing old-engine capture remains unavailable", () => {
  const doc = fixture();
  delete doc.functions[0].atomic_facts;
  doc.functions[0].atomic_facts_error = "graph capacity";
  const model = load(doc);
  assert.equal(model.facets.recovered_ir.availability, "unavailable");
  assert.equal(model.switches({}).items[0].selector.size_bytes, 8);
  assert.equal(cases(model).total, 4);
  delete doc.functions[0].atomic_switches;
  const legacy = load(doc);
  assert.equal(legacy.facets.switches.availability, "unavailable");
  assert.throws(() => cases(legacy));
  assert.equal(legacy.code, "retained C");
  doc.functions[0].atomic_switches = {
    schema_version: 1,
    items: [],
    coverage: {
      scope: "all recovered switches",
      blocks_examined: 3,
      operations_examined: 3,
      machine_semantic_equivalence: "unknown",
    },
  };
  const empty = load(doc);
  assert.equal(empty.facets.switches.availability, "available");
  assert.equal(empty.facets.switches.count, 0);
});
test("contradictory switch ownership or values fail only that independent facet", () => {
  for (const change of [
    (sw) => (sw.table.rows[0].edges[0].target = 2),
    (sw) => (sw.table.rows[0].index = 1),
    (sw) => (sw.selector.size_bytes = 4),
    (sw) => (sw.table.default_raw_index = 0),
    (sw) => sw.table.rows[0].edges.push(edge(0, 1)),
  ]) {
    const doc = fixture();
    change(doc.functions[0].atomic_switches.items[0]);
    const model = load(doc);
    assert.equal(model.facets.switches.availability, "unavailable");
    assert.equal(model.facets.recovered_ir.availability, "available");
    assert.equal(model.code, "retained C");
  }
});
test("partial facets cannot disagree about a shared value identity when the graph is unavailable", () => {
  const doc = fixture(),
    fn = doc.functions[0];
  delete fn.atomic_facts;
  fn.atomic_calls = {
    schema_version: 1,
    items: [
      {
        id: "0x1100:0",
        origin_address: "0x1100",
        block: 0,
        opcode: "CPUI_CALL",
        is_dead: false,
        target_value_id: null,
        spec_available: false,
        target: null,
        target_name: null,
        arguments: [
          {
            input_index: 1,
            value_id: "v1",
            storage: null,
            storage_authority: null,
          },
        ],
        output: null,
        prototype: null,
        stack_offset: null,
      },
    ],
    values: [{ ...fn.atomic_switches.items[0].selector }],
    coverage: {
      scope: "all recovered calls",
      blocks_examined: 3,
      operations_examined: 3,
      value_scope: "call inputs and outputs",
      machine_call_equivalence: "unknown",
    },
  };
  assert.equal(load(doc).facets.switches.availability, "available");
  fn.atomic_switches.items[0].selector.size_bytes = 4;
  const invalid = load(doc);
  assert.equal(invalid.facets.switches.availability, "unavailable");
  assert.equal(invalid.facets.calls.availability, "available");
  assert.equal(invalid.calls({}).total, 1);
});
test("switch capacity rejection precedes row validation and preserves the valid graph", () => {
  for (const oversized of [
    (table) => (table.rows = Array(100001).fill({})),
    (table) => (table.rows[0].edges = Array(100001).fill({})),
  ]) {
    const doc = fixture();
    oversized(doc.functions[0].atomic_switches.items[0].table);
    const model = load(doc);
    assert.equal(model.facets.switches.availability, "unavailable");
    assert.match(model.facets.switches.error.message, /capacity/);
    assert.equal(model.facets.recovered_ir.availability, "available");
  }
});
