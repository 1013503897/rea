import test from "node:test";
import assert from "node:assert/strict";
import { parseByteFacts } from "./byte-facts.mjs";
import { AtomicSession } from "./session.mjs";

const make = () => ({
  binary: "/input",
  kind: "data",
  start_hex: "0x20000000000001",
  end_hex: "0x20000000000005",
  count: 1,
  bytes: 4,
  hex: "00417fff",
  truncated: false,
  notes: [],
  rows: [
    {
      address_hex: "0x20000000000001",
      size: 4,
      bytes: "00417fff",
    },
  ],
});
const request = { address: "0x20000000000001", length: 4 };
test("byte facts keep exact u64 extents, null/nontext bytes and loaded-image authority", () => {
  const facts = parseByteFacts(JSON.stringify(make()), "/input", request);
  assert.equal(facts.hex, "00417fff");
  assert.equal(facts.end_address, "0x20000000000005");
  assert.equal(facts.coverage.status, "complete-for-requested-range");
  assert.equal(facts.coverage.original_file_mapping, "unknown");
  assert.equal(facts.coverage.runtime_memory, "not-observed");
  const clipped = parseByteFacts(JSON.stringify(make()), "/input", {
    ...request,
    length: 5,
  });
  assert.equal(clipped.coverage.status, "partial");
  const flagged = make();
  flagged.truncated = true;
  assert.equal(
    parseByteFacts(JSON.stringify(flagged), "/input", request).coverage.status,
    "complete-for-requested-range",
  );
});

test("wrong byte subject, contradictory duplicated payload, gaps and counts fail before publishing facts", () => {
  for (const mutate of [
    (d) => (d.binary = "/other"),
    (d) => (d.kind = "code"),
    (d) => (d.hex = "00417f00"),
    (d) => (d.rows[0].address_hex = "0x20000000000000"),
    (d) => (d.rows[0].size = 3),
    (d) => (d.end_hex = "0x20000000000006"),
    (d) => (d.count = 2),
    (d) => (d.rows = Array(4097).fill(null)),
  ]) {
    const document = make();
    mutate(document);
    assert.throws(
      () => parseByteFacts(JSON.stringify(document), "/input", request),
      { code: "invalid_provider_output" },
    );
  }
  const empty = make();
  Object.assign(empty, {
    hex: "",
    rows: [],
    count: 0,
    bytes: 0,
    end_hex: request.address,
  });
  assert.equal(
    parseByteFacts(JSON.stringify(empty), "/input", request).coverage.status,
    "partial",
  );
});

test("byte input capacity, malformed addresses and u64 end overflow reject before native admission", async () => {
  let reads = 0;
  const session = new AtomicSession(async () => ({
    context: { lease: "bytes" },
    bytes: () => {
      reads += 1;
    },
    close: () => {},
  }));
  await session.open("/input");
  try {
    for (const windows of [
      [{ address: "invalid", length: 1 }],
      [{ address: "0xffffffffffffffff", length: 1 }],
      [
        { address: "0x1000", length: 65536 },
        { address: "0x2000", length: 1 },
      ],
      [{ address: "0x1000", length: 0 }],
    ]) {
      const result = await session.call("bytes", { windows });
      assert.equal(result.error.code, "invalid_input", JSON.stringify(result));
    }
    assert.equal(reads, 0);
  } finally {
    await session.close();
  }
});

test("byte aliases and kept counters are validated from exact numeric source tokens", () => {
  const raw = JSON.stringify({
    ...make(),
    start: "9007199254740993",
    end: "9007199254740997",
    target: { address: "9007199254740993", address_hex: request.address },
    rows: [{ ...make().rows[0], address: "9007199254740993" }],
  })
    .replaceAll('"9007199254740993"', "9007199254740993")
    .replaceAll('"9007199254740997"', "9007199254740997");
  assert.equal(parseByteFacts(raw, "/input", request).returned_bytes, 4);
  for (const invalid of [
    raw.replace('"count":1', '"count":1.0000000000000000001'),
    raw.replace('"bytes":4', '"bytes":4e0'),
    raw.replace('"size":4', '"size":4.0000000000000000001'),
    raw.replace('"start":9007199254740993', '"start":9007199254740992'),
    raw.replace('"end":9007199254740997', '"end":9007199254740996'),
    raw.replace('"address":9007199254740993', '"address":9007199254740992'),
  ])
    assert.throws(() => parseByteFacts(invalid, "/input", request), {
      code: "invalid_provider_output",
    });
});
