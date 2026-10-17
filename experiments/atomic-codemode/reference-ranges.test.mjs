import assert from "node:assert/strict";
import test from "node:test";
import { referencesMethod } from "./reference-contracts.mjs";
import { methods } from "./api.mjs";
import { NativeReferenceReads } from "./reference-reads.mjs";

test("range selectors preserve old inputs and reject ambiguous/directional/malformed choices", () => {
  assert.equal(methods.references, referencesMethod);
  const schema = methods.references.input;
  assert.deepEqual(schema.parse({ addresses: ["0x1"] }).addresses, ["0x1"]);
  assert.equal(
    schema.parse({
      addresses: ["0x1"],
      direction: "outgoing",
      scope: "function",
    }).scope,
    "function",
  );
  const ranges = [{ start: "0x0", end_inclusive: "0xffffffffffffffff" }];
  assert.equal(schema.parse({ ranges }).scope, "range");
  for (const input of [
    { ranges, addresses: ["0x0"] },
    { addresses: ["0x1"], scope: "function", direction: "incoming" },
    { addresses: ["0x1"], scope: "function" },
    { ranges, scope: "function" },
    { ranges, direction: "outgoing" },
    { ranges: [] },
    { ranges: [{ start: "0x2", end_inclusive: "0x1" }] },
    { ranges: [{ start: "0xg", end_inclusive: "0x1" }] },
    { ranges: [{ start: "0x0", end_inclusive: "0x10000000000000000" }] },
    { ranges, limit: 129 },
    { ranges, offset: -1 },
  ])
    assert.equal(schema.safeParse(input).success, false, JSON.stringify(input));
});

const range = { start: "0x100", end_inclusive: "0x10d" };
const wire = JSON.stringify({
  schema_version: 1,
  binary: "/input",
  direction: "to",
  count: 1,
  ranges: [
    {
      ...range,
      index: 0,
      offset: 0,
      limit: 20,
      total: 1,
      count: 1,
      next_offset: null,
    },
  ],
  xrefs: [
    {
      range_index: 0,
      address: 8,
      address_hex: "0x8",
      kind: "data",
      from_address: 8,
      from_address_hex: "0x8",
      to_address: 264,
      to_address_hex: "0x108",
      from_function: null,
      to_function: null,
      instruction: "LEA pointer",
    },
  ],
});
const source = {
  evidence_id: "ev_page",
  sha256: "owned-sha",
  bytes: Buffer.byteLength(wire),
  elapsed_ms: 1,
};
test("range pages reuse one immutable parsed source across fields and expire on clear", async () => {
  let reads = 0;
  const invocations = [];
  const reader = new NativeReferenceReads(
    async (key, args) => {
      invocations.push({ key, args: args("/input") });
      return { input: "/input", source };
    },
    async () => {
      reads++;
      return wire;
    },
    () => {},
  );
  const input = referencesMethod.input.parse({ ranges: [range] });
  const first = await reader.read(input);
  const selected = await reader.read({ ...input, fields: [] });
  assert.equal(reads, 1);
  assert.equal(invocations[0].key, invocations[1].key);
  assert.deepEqual(Object.keys(selected.results[0].items[0]), [
    "source_row",
    "from",
    "to",
    "kind",
  ]);
  assert.throws(() => {
    first.results[0].items[0].instruction = "corrupt";
  }, TypeError);
  first.results[0].items.length = 0;
  assert.equal((await reader.read(input)).results[0].items.length, 1);
  assert.equal(
    selected.results[0].coverage.whole_string_use,
    "not-established",
  );
  reader.clear();
  await reader.read(input);
  assert.equal(reads, 2);
});
test("unavailable and malformed ranges cannot masquerade as empty observations", async () => {
  const input = referencesMethod.input.parse({ ranges: [range] });
  const unavailable = new NativeReferenceReads(
    () => {
      throw Error("must not launch");
    },
    () => {},
    () => {
      throw Object.assign(Error("requires native"), {
        code: "capability_unavailable",
      });
    },
  );
  await assert.rejects(
    unavailable.read(input),
    (e) => e.code === "capability_unavailable",
  );
  const malformed = new NativeReferenceReads(
    async () => ({ input: "/input", source }),
    async () => "{}",
    () => {},
  );
  await assert.rejects(
    malformed.read(input),
    (e) =>
      e.code === "invalid_provider_output" &&
      e.details.evidence_id === source.evidence_id &&
      e.details.source_retained === true,
  );
});
