import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { parseNativeIR } from "./native-ir.mjs";
import { readNativeGraphEvidence } from "./native-ir-contract.mjs";
import { controlDependencies } from "./control-dependence.mjs";

const id = (n) => `0x${n}:0`;
const val = (n, definition = null) => ({
  id: `v${n}`,
  space: "register",
  offset: "0x0",
  size_bytes: 8,
  is_constant: false,
  is_input: definition === null,
  is_annotation: false,
  definition,
  type_name: "uint64",
});
const input = (n, value_id, phi_predecessor = null) => ({
  input_index: n,
  value_id,
  phi_predecessor,
  phi_predecessor_edge:
    phi_predecessor === null ? null : `${phi_predecessor}:0`,
});
const edge = (from, target, index, polarity = null) => ({
  id: `${from}:${index}`,
  target,
  index,
  polarity,
  condition_value: polarity ? "v0" : null,
  condition_test: polarity ? "ne-zero" : null,
});
const op = (block, opcode, inputs, output = null) => ({
  id: id(block),
  address: `0x${block}`,
  block,
  opcode,
  inputs,
  output,
  statement: "display is deliberately unparseable",
  is_dead: false,
});

function diamond() {
  return {
    binary: "/private/input",
    count: 1,
    language: "c",
    error: null,
    functions: [
      {
        address_hex: "0x1000",
        error: null,
        code: "reconstructed C",
        atomic_facts: {
          schema_version: 3,
          blocks: [
            {
              id: 0,
              start: "0x1000",
              operations: [id(0)],
              predecessors: [],
              successors: [edge(0, 1, 0, "false"), edge(0, 2, 1, "true")],
            },
            {
              id: 1,
              start: "0x1001",
              operations: [id(1)],
              predecessors: [0],
              successors: [edge(1, 3, 0)],
            },
            {
              id: 2,
              start: "0x1002",
              operations: [id(2)],
              predecessors: [0],
              successors: [edge(2, 3, 0)],
            },
            {
              id: 3,
              start: "0x1003",
              operations: [id(3)],
              predecessors: [1, 2],
              successors: [],
            },
          ],
          operations: [
            op(0, "CPUI_CBRANCH", [input(0, "v0")]),
            op(1, "CPUI_COPY", [input(0, "v4")], "v1"),
            op(2, "CPUI_COPY", [input(0, "v4")], "v2"),
            op(
              3,
              "CPUI_MULTIEQUAL",
              [input(0, "v1", 1), input(1, "v2", 2)],
              "v3",
            ),
          ],
          values: [
            val(0),
            val(1, id(1)),
            val(2, id(2)),
            val(3, id(3)),
            {
              ...val(4),
              is_constant: true,
              is_input: false,
              space: "const",
              offset: "0xffffffffffffffff",
            },
          ],
          coverage: {
            scope: "native recovered graph",
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

test("compressed and ordinary graphs have identical parsed facts and malformed archives preserve code", () => {
  const doc = diamond(),
    raw = Buffer.from(JSON.stringify(doc.functions[0].atomic_facts));
  const ordinary = parseNativeIR(JSON.stringify(doc), "0x1000");
  doc.functions[0].atomic_facts = {
    schema_version: 4,
    encoding: "gzip-base64",
    raw_bytes: raw.length,
    data: gzipSync(raw).toString("base64"),
  };
  const encoded = parseNativeIR(JSON.stringify(doc), "0x1000");
  assert.deepEqual(encoded.coverage, ordinary.coverage);
  assert.deepEqual(
    encoded.select({ fields: ["inputs", "output", "definitions"] }),
    ordinary.select({ fields: ["inputs", "output", "definitions"] }),
  );
  assert.deepEqual(encoded.blocks({}), ordinary.blocks({}));
  assert.deepEqual(readNativeGraphEvidence(JSON.stringify(doc)), {
    text: raw.toString(),
    encoding: "gzip-base64",
  });
  for (const change of [
    { raw_bytes: 2 },
    { data: "broken" },
    { raw_bytes: 32 * 1024 * 1024 + 1 },
  ]) {
    const bad = structuredClone(doc);
    Object.assign(bad.functions[0].atomic_facts, change);
    const model = parseNativeIR(JSON.stringify(bad), "0x1000");
    assert.equal(model.code, "reconstructed C");
    assert.equal(model.facets.recovered_ir.availability, "unavailable");
    assert.throws(() => model.select({}));
  }
  for (const text of [
    "{malformed logical JSON",
    JSON.stringify({ schema_version: 4, data: "nested" }),
  ]) {
    const bad = structuredClone(doc),
      bytes = Buffer.from(text);
    bad.functions[0].atomic_facts = {
      schema_version: 4,
      encoding: "gzip-base64",
      raw_bytes: bytes.length,
      data: gzipSync(bytes).toString("base64"),
    };
    const source = JSON.stringify(bad);
    assert.equal(
      parseNativeIR(source, "0x1000").facets.recovered_ir.availability,
      "unavailable",
    );
    assert.equal(
      readNativeGraphEvidence(source).text,
      text,
      "Malformed logical facts remain inspectable through owned decoded source",
    );
  }
  assert.throws(
    () => readNativeGraphEvidence('{"hex":"0102"}'),
    (error) => error.code === "capability_unavailable",
  );
});

test("native identity, implicit CFG and operand/phi bindings do not depend on display text", () => {
  const model = parseNativeIR(JSON.stringify(diamond()), "0x1000");
  assert.equal(model.operation("0x3:0").origin_address, "0x3");
  assert.equal(Object.hasOwn(model.operation("0x3:0"), "address"), false);
  assert.equal(model.block(1).origin_start, "0x1001");
  const operand = model.edges({
    kind: "operands",
    seeds: ["0x3:0"],
    input_indices: [1],
  }).items[0];
  assert.deepEqual(operand, {
    operation: "0x3:0",
    input_index: 1,
    value_id: "v2",
    definition: "0x2:0",
    phi_predecessor: 2,
    phi_predecessor_edge: "2:0",
  });
  assert.equal(Object.hasOwn(model.block(1), "start"), false);
  assert.equal(model.select({ origin_addresses: ["0x3"] }).total, 1);
  assert.deepEqual(model.findConstant("0xffffffffffffffff"), [
    "0x1:0",
    "0x2:0",
  ]);
  assert.equal(model.edges({ kind: "outgoing", seeds: [1] }).items[0].to, 3);
  assert.deepEqual(
    model
      .operation("0x3:0")
      .definitions.map(({ input_index, phi_predecessor }) => [
        input_index,
        phi_predecessor,
      ]),
    [
      [0, 1],
      [1, 2],
    ],
  );
  assert.equal(
    model.values({ ids: ["v4"] }).items[0].offset,
    "0xffffffffffffffff",
  );
  const batch = model.values({ ids: ["v4", "vdead"] });
  assert.equal(batch.items.length, 1);
  assert.deepEqual(batch.missing, ["vdead"]);
  assert.throws(() => {
    model.operation("0x3:0").inputs[0].value_id = "foreign";
  });
  assert.deepEqual(
    model
      .edges({ kind: "controllers", seeds: [1] })
      .items.map((row) => [row.controller, row.edge.polarity]),
    [[0, "false"]],
  );
  assert.equal(model.edges({ kind: "controllers", seeds: [3] }).total, 0);
});

test("malformed identities, dangling relationships, foreign entry and phi reorder fail at the producer boundary", () => {
  for (const mutate of [
    (facts) => {
      facts.values.push(facts.values[0]);
    },
    (facts) => {
      facts.operations[0].inputs[0].value_id = "vdead";
    },
    (facts) => {
      facts.blocks[1].predecessors = [];
    },
    (facts) => {
      facts.operations[3].inputs[0].phi_predecessor = 2;
    },
    (facts) => {
      facts.values[1].definition = "0xf:0";
    },
  ]) {
    const doc = diamond();
    mutate(doc.functions[0].atomic_facts);
    const model = parseNativeIR(JSON.stringify(doc), "0x1000");
    assert.equal(model.facets.recovered_ir.availability, "unavailable");
    assert.equal(model.code, "reconstructed C");
    assert.throws(() => model.select({}));
  }
  assert.throws(
    () => parseNativeIR(JSON.stringify(diamond()), "0x2000"),
    /subject/u,
  );
});

test("typed slices retain symbolic input frontiers and precise definition bindings", () => {
  const model = parseNativeIR(JSON.stringify(diamond()), "0x1000");
  const result = model.slice({
    seeds: ["0x3:0", "0x0:0"],
    max_operations: 10,
    stop_at: [],
    stop_kinds: [],
  });
  assert.equal(result.operations.length, 4);
  assert.deepEqual(result.value_frontier, [
    { value_id: "v0", reason: "function-input" },
  ]);
  assert.equal(result.coverage.runtime_reachability, "unknown");
});

test("native facet failure preserves C without fabricating an empty graph; source identity still gates both", () => {
  const doc = diamond();
  delete doc.functions[0].atomic_facts;
  doc.functions[0].atomic_facts_error = "atomic operation capacity exceeded";
  const model = parseNativeIR(JSON.stringify(doc), "0x1000", "/private/input");
  assert.equal(model.code, "reconstructed C");
  assert.equal(model.language, "c");
  assert.equal(model.coverage.operations, null);
  assert.equal(model.facets.code.availability, "available");
  assert.equal(model.facets.recovered_ir.availability, "unavailable");
  assert.throws(
    () => model.select({}),
    (error) =>
      error.code === "capability_unavailable" &&
      error.details.native_error === doc.functions[0].atomic_facts_error,
  );
  assert.throws(
    () => parseNativeIR(JSON.stringify(doc), "0x1000", "/other/input"),
    (error) => error.code === "subject_mismatch",
  );
});

test("oversized or malformed native arrays fail before diagnostic expansion", () => {
  const capacity = diamond();
  capacity.functions[0].atomic_facts.operations = Array.from(
    { length: 32001 },
    () => ({}),
  );
  assert.throws(
    () => parseNativeIR(JSON.stringify(capacity), "0x1000").select({}),
    /capacity/u,
  );
  const malformed = diamond();
  malformed.functions[0].atomic_facts.operations = Array.from(
    { length: 12000 },
    () => ({}),
  );
  assert.throws(
    () => parseNativeIR(JSON.stringify(malformed), "0x1000").select({}),
    (error) =>
      error.code === "invalid_provider_output" &&
      error.details.issues.length <= 8 &&
      JSON.stringify(error.details).length < 2048,
  );
});

test("control dependence handles multiple exits, loops, unreachable exits and bounded work", () => {
  const blocks = [
    { id: 0, successors: [{ target: 1 }, { target: 2 }] },
    { id: 1, successors: [] },
    { id: 2, successors: [] },
    { id: 3, successors: [{ target: 3 }] },
  ];
  const result = controlDependencies(blocks);
  assert.deepEqual(
    result.relations.map((r) => [r.controller, r.dependent]),
    [
      [0, 1],
      [0, 2],
    ],
  );
  assert.deepEqual(result.coverage.exit_unreachable_blocks, [3]);
  assert.throws(() => controlDependencies(blocks, { workLimit: 1 }), /budget/u);
  const linear = Array.from({ length: 12000 }, (_, id) => ({
    id,
    successors: id < 11999 ? [{ target: id + 1 }] : [],
  }));
  assert.equal(controlDependencies(linear).relations.length, 0);
});

test("postdominator control dependence agrees with independently enumerated paths for every four-node DAG", () => {
  const possible = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ];
  for (let mask = 0; mask < 64; mask++) {
    const blocks = Array.from({ length: 4 }, (_, id) => ({
      id,
      successors: possible
        .filter(([from], i) => from === id && mask & (1 << i))
        .map(([, target]) => ({ target })),
    }));
    const paths = (node) =>
      blocks[node].successors.length
        ? blocks[node].successors.flatMap(({ target }) =>
            paths(target).map((path) => [node, ...path]),
          )
        : [[node]];
    const postdominators = blocks.map(({ id }) =>
      paths(id).reduce(
        (shared, path) =>
          new Set([...shared].filter((node) => path.includes(node))),
        new Set([0, 1, 2, 3]),
      ),
    );
    const expected = blocks.flatMap((block) =>
      block.successors.flatMap((edge) =>
        [...postdominators[edge.target]]
          .filter((dependent) => !postdominators[block.id].has(dependent))
          .map((dependent) => `${block.id}:${edge.target}:${dependent}`),
      ),
    );
    const actual = controlDependencies(blocks).relations.map(
      (row) => `${row.controller}:${row.edge.target}:${row.dependent}`,
    );
    assert.deepEqual(actual.sort(), expected.sort(), `DAG mask ${mask}`);
  }
});
