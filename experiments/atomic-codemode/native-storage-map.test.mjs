import test from "node:test";
import assert from "node:assert/strict";
import { parseNativeStorageMap } from "./native-storage-map.mjs";
import { NativeCatalogReads } from "./native-catalog-reads.mjs";
import { FactFailure } from "./fact-error.mjs";
import { methods } from "./api.mjs";
import { NATIVE_OUTPUT_BYTES } from "./limits.mjs";

// Deliberately sparse spaces, duplicate names, one unknown space and raw bytes.
const fixture = () => ({
  schema_version: 1,
  binary: "/selected/input",
  architecture: { native_id: "test:model", default_code_space: "ram" },
  space_index_capacity: 9,
  register_count: 6,
  spaces: [
    {
      native_index: 3,
      name: "ram",
      kind: "IPTR_PROCESSOR",
      address_size_bytes: 8,
      addressable_unit_bytes: 1,
      endianness: "big",
      highest_offset: "0xffffffffffffffff",
    },
    {
      native_index: 4,
      name: "register",
      kind: "IPTR_PROCESSOR",
      address_size_bytes: 4,
      addressable_unit_bytes: 1,
      endianness: "little",
      highest_offset: "0xffffffff",
    },
    {
      native_index: 8,
      name: "stack",
      kind: "IPTR_SPACEBASE",
      address_size_bytes: 8,
      addressable_unit_bytes: 2,
      endianness: "big",
      highest_offset: "0xffffffffffffffff",
    },
  ],
  registers: [
    {
      native_row: 0,
      space: "register",
      offset: "0x8",
      size_bytes: 8,
      name: "RCX",
      name_bytes_hex: null,
    },
    {
      native_row: 1,
      space: "register",
      offset: "0x8",
      size_bytes: 2,
      name: "CX",
      name_bytes_hex: null,
    },
    {
      native_row: 2,
      space: "register",
      offset: "0x10",
      size_bytes: 2,
      name: "CX",
      name_bytes_hex: null,
    },
    {
      native_row: 3,
      space: null,
      offset: "0xffffffffffffffff",
      size_bytes: 1,
      name: "",
      name_bytes_hex: null,
    },
    {
      native_row: 4,
      space: "register",
      offset: "0x0",
      size_bytes: 1,
      name: null,
      name_bytes_hex: "ff00",
    },
    {
      native_row: 5,
      space: "register",
      offset: "0x1",
      size_bytes: 1,
      name: "x.y",
      name_bytes_hex: null,
    },
  ],
  coverage: {
    scope: "test exact map",
    native_exact_register_map: "complete",
    alias_relationships: "unknown",
    dynamic_join_records: "not-collected",
    memory_values: "not-returned",
    listing_discovery: false,
    functions_decompiled: 0,
  },
});
const parse = (doc = fixture()) =>
  parseNativeStorageMap(JSON.stringify(doc), "/selected/input");
const select = (view, method, input = {}) =>
  view[method](methods[method].input.parse(input));

test("space identity, sparse indices, caller order, projection and absence before paging", () => {
  const view = parse();
  const reply = select(view, "spaces", {
    indices: [8, 3, 8, 7],
    names: ["stack", "ram", "missing"],
    fields: ["addressable_unit_bytes"],
    limit: 1,
  });
  assert.deepEqual(reply.items, [
    { native_index: 8, name: "stack", addressable_unit_bytes: 2 },
  ]);
  assert.deepEqual(reply.missing_names, ["missing"]);
  assert.deepEqual(reply.missing_indices, [7]);
  assert.equal(reply.total, 2);
  assert.equal(reply.next_offset, 1);
  assert.equal(reply.totals.space_index_capacity, 9);
  assert.equal(reply.totals.spaces, 3);
  assert.deepEqual(
    select(view, "spaces", { names: ["stack", "ram"], fields: [] }).items,
    [
      { native_index: 8, name: "stack" },
      { native_index: 3, name: "ram" },
    ],
  );
  for (const input of [{ names: [] }, { indices: [] }])
    assert.equal(select(view, "spaces", input).total, 0);
});

test("register lookup uses exact space/offset/width, keeps misses before filtering and does not substitute containing registers", () => {
  const view = parse(),
    locations = [
      { space: "register", offset: "0x8", size_bytes: 2 },
      { space: "register", offset: "0x8", size_bytes: 8 },
      { space: "register", offset: "0x8", size_bytes: 3 },
      { space: "unknown", offset: "0x8", size_bytes: 8 },
      { space: "stack", offset: "0x8", size_bytes: 8 },
    ];
  const reply = select(view, "registers", {
    locations: [...locations, locations[0]],
    fields: ["name"],
    limit: 1,
  });
  assert.deepEqual(reply.items, [
    { native_row: 1, ...locations[0], name: "CX" },
  ]);
  assert.equal(reply.total, 2);
  assert.deepEqual(reply.unretained_locations, locations.slice(2));
  assert.deepEqual(reply.unretained_space_names, ["unknown"]);
  const intersect = select(view, "registers", {
    locations,
    names: ["RCX", "rcx"],
    query: "cx",
  });
  assert.equal(intersect.total, 1);
  assert.deepEqual(intersect.unretained_names, ["rcx"]);
  assert.deepEqual(intersect.unretained_locations, locations.slice(2));
  assert.equal(select(view, "registers", { locations: [] }).total, 0);
});

test("register names preserve multiplicity, exact-case names, substring semantics and explicit unknowns", () => {
  const view = parse();
  assert.deepEqual(
    select(view, "registers", {
      names: ["CX", "RCX", "CX"],
      fields: [],
    }).items.map((r) => r.native_row),
    [1, 2, 0],
  );
  assert.equal(select(view, "registers", { query: "cx" }).total, 3);
  assert.equal(
    select(view, "registers", { query: "cx", case_sensitive: true }).total,
    0,
  );
  assert.equal(select(view, "registers", { query: "." }).total, 1);
  assert.equal(select(view, "registers", { names: [] }).total, 0);
  const reply = select(view, "registers", { offset: 3 });
  assert.deepEqual(reply.items[0], fixture().registers[3]);
  assert.deepEqual(reply.items[1], fixture().registers[4]);
  assert.equal(reply.coverage.unknown_space_register_count, 1);
  assert.equal(reply.coverage.undecodable_name_count, 1);
  assert.equal(select(view, "registers", { names: [""] }).items[0].space, null);
});

test("SDK views cannot change retained storage metadata or subsequent queries", () => {
  const view = parse(),
    reply = select(view, "registers");
  for (const change of [
    () => {
      reply.items[0].name = "foreign";
    },
    () => {
      reply.architecture.native_id = "foreign";
    },
    () => {
      reply.totals.registers = 0;
    },
    () => {
      reply.coverage.functions_decompiled = 1;
    },
  ])
    assert.throws(change, TypeError);
  reply.items.length = 0;
  assert.equal(select(view, "registers").items.length, 6);
});

test("malformed source fails closed at identity, reference and knowledge boundaries", () => {
  const mutations = [
    (d) => {
      d.binary = "/other";
    },
    (d) => {
      d.schema_version = 2;
    },
    (d) => {
      d.register_count++;
    },
    (d) => {
      d.registers[1].native_row = 0;
    },
    (d) => {
      d.spaces[1].native_index = 3;
    },
    (d) => {
      d.spaces[1].name = "ram";
    },
    (d) => {
      d.spaces[0].native_index = 9;
    },
    (d) => {
      d.architecture.default_code_space = "missing";
    },
    (d) => {
      d.registers[1].space = "missing";
    },
    (d) => {
      d.registers[1].size_bytes = 8;
    },
    (d) => {
      d.registers[4].name_bytes_hex = null;
    },
    (d) => {
      d.registers[0].name_bytes_hex = "ff";
    },
    (d) => {
      d.registers[0].offset = "0x08";
    },
    (d) => {
      d.registers[0].size_bytes = 0;
    },
    (d) => {
      d.registers[4].name_bytes_hex = "f";
    },
    (d) => {
      d.coverage.functions_decompiled = 1;
    },
    (d) => {
      d.spaces = null;
    },
    (d) => {
      d.registers = [];
    },
  ];
  for (const mutate of mutations) {
    const doc = fixture();
    mutate(doc);
    assert.throws(
      () => parse(doc),
      (e) => e.code === "invalid_provider_output",
    );
  }
  assert.throws(
    () =>
      parseNativeStorageMap(
        " ".repeat(NATIVE_OUTPUT_BYTES + 1),
        "/selected/input",
      ),
    /wire budget/,
  );
  const doc = fixture();
  doc.registers = Array(100000).fill(null);
  assert.throws(() => parse(doc), /format-derived row capacity/);
});

test("one immutable storage capture powers both catalog views; clear creates a new lease cache", async () => {
  const captures = [],
    source = {
      evidence_id: "ev_source",
      sha256: "digest",
      bytes: 10,
      elapsed_ms: 1,
    };
  let guards = 0;
  const reader = new NativeCatalogReads(
    async (name, args, signal) => {
      captures.push({ name, args: args("/selected/input"), signal });
      return { input: "/selected/input", source };
    },
    async (id) => {
      assert.equal(id, source.evidence_id);
      return JSON.stringify(fixture());
    },
    () => {
      guards++;
    },
  );
  const signal = new AbortController().signal;
  const first = await reader.spaces({}, signal);
  assert.throws(() => {
    first.source.sha256 = "foreign";
  }, TypeError);
  await reader.registers({ names: ["CX"] }, signal);
  await reader.spaces({ names: [] }, signal);
  assert.equal(captures.length, 1);
  assert.deepEqual(captures[0], {
    name: "storage",
    args: ["storage-map", "/selected/input", "--json"],
    signal,
  });
  assert.equal(guards, 3);
  reader.clear();
  await reader.registers({}, signal);
  assert.equal(captures.length, 2);
});

test("catalog errors retain source and typed execution failures, never caching a failed parse", async () => {
  let text = "invalid",
    reads = 0,
    captures = 0;
  const reader = new NativeCatalogReads(
    async () => {
      captures++;
      return {
        input: "/selected/input",
        source: { evidence_id: "ev_bad", sha256: "digest" },
      };
    },
    async () => {
      reads++;
      return text;
    },
    () => {},
  );
  await assert.rejects(
    reader.spaces({}),
    (e) =>
      e.code === "invalid_provider_output" &&
      e.details.evidence_id === "ev_bad" &&
      e.details.source_retained,
  );
  text = JSON.stringify(fixture());
  await reader.registers({});
  await reader.spaces({});
  assert.equal(reads, 2);
  assert.equal(captures, 2);
  for (const code of [
    "cancelled",
    "cleanup_incomplete",
    "capacity",
    "command_failed",
  ]) {
    const expected = new FactFailure(code, "native failed", {
      reason: "actual",
    });
    const failing = new NativeCatalogReads(
      async () => {
        throw expected;
      },
      () => assert.fail("must not read"),
      () => {},
    );
    await assert.rejects(failing.spaces({}), (e) => e === expected);
  }
  const unavailable = new NativeCatalogReads(
    () => assert.fail("must not launch"),
    () => assert.fail("must not read"),
    () => {
      throw new FactFailure("capability_unavailable", "not configured");
    },
  );
  await assert.rejects(
    unavailable.registers({}),
    (e) => e.code === "capability_unavailable",
  );
});
