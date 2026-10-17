import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  NativeByteBatchReads,
  parseNativeByteBatch,
} from "./native-byte-batch.mjs";
import { FactFailure } from "./fact-error.mjs";

const a = { address: "0x1000", length: 2 },
  b = { address: "0x2000", length: 2 };
const result = (request) => ({
  binary: "/input",
  kind: "data",
  start: Number(BigInt(request.address)),
  start_hex: request.address,
  end: Number(BigInt(request.address) + 2n),
  end_hex: "0x" + (BigInt(request.address) + 2n).toString(16),
  count: 1,
  bytes: 2,
  hex: "0041",
  truncated: false,
  notes: [],
  rows: [
    {
      address: Number(BigInt(request.address)),
      address_hex: request.address,
      size: 2,
      bytes: "0041",
    },
  ],
});
const report = (requests) => ({
  schema_version: 1,
  binary: "/input",
  window_count: requests.length,
  program_loads: 1,
  output_bytes: 4096,
  windows: requests.map((request, index) => ({
    source_row: index,
    request_address_hex: request.address,
    requested_bytes: request.length,
    ok: true,
    result: result(request),
  })),
});
const captured = (doc) => {
  const text = typeof doc === "string" ? doc : JSON.stringify(doc);
  return {
    text,
    capture: {
      input: "/input",
      output_bytes: 4096,
      source: {
        evidence_id: "ev_test",
        sha256: createHash("sha256").update(text).digest("hex"),
        bytes: Buffer.byteLength(text),
        capture_complete: true,
      },
    },
  };
};
const decode = (doc, requests = [a, b]) => {
  const { text, capture } = captured(doc);
  return parseNativeByteBatch(text, capture, requests);
};

test("one report keeps exact windows, shared source identity and per-window partial facts", () => {
  const doc = report([a, { ...b, length: 3 }]),
    rows = decode(doc, [a, { ...b, length: 3 }]);
  assert.equal(rows[0].source.evidence_id, rows[1].source.evidence_id);
  assert.deepEqual(
    rows.map((r) => r.source_row),
    [0, 1],
  );
  assert.equal(rows[0].coverage.status, "complete-for-requested-range");
  assert.equal(rows[1].coverage.status, "partial");
  assert.equal(rows[1].coverage.requested_bytes, 3);
  assert.equal(rows[1].returned_bytes, 2);
  assert.equal(rows[1].coverage.runtime_memory, "not-observed");
  assert.equal(rows[1].coverage.original_file_mapping, "unknown");
});
test("native window errors and malformed individual data preserve valid sibling facts and Evidence", () => {
  for (const mutate of [
    (row) => {
      row.ok = false;
      delete row.result;
      row.error = { code: "window_unavailable", message: "unmapped address" };
    },
    (row) => {
      row.result.hex = "0000";
    },
    (row) => {
      row.result.rows[0].address = 0x1000;
    },
    (row) => {
      row.source_row = 0;
    },
    (row) => {
      row.request_address_hex = a.address;
    },
  ]) {
    const doc = report([a, b]);
    mutate(doc.windows[1]);
    const rows = decode(doc);
    assert(rows[0].ok);
    assert.equal(rows[1].ok, false);
    assert.equal(rows[1].error.details.evidence_id, "ev_test");
    assert.equal(rows[1].error.details.source_row, 1);
    assert.equal(rows[1].error.details.source_retained, true);
  }
});
test("wrong envelope identity, count, format or rounded integer cannot publish invented empty success", () => {
  for (const patch of [
    { binary: "/other" },
    { window_count: 1 },
    { program_loads: 2 },
    { output_bytes: 4095 },
    { schema_version: 2 },
    { windows: [] },
  ])
    assert.throws(
      () => decode({ ...report([a, b]), ...patch }),
      (e) =>
        e.code === "invalid_provider_output" &&
        e.details.evidence_id === "ev_test",
    );
  const raw = JSON.stringify(report([a, b])).replace(
    '"window_count":2',
    '"window_count":2.00000000000000001',
  );
  assert.throws(() => decode(raw), { code: "invalid_provider_output" });
});

function owner() {
  const captures = [],
    sources = new Map();
  let rejected;
  const reads = new NativeByteBatchReads(
    async (name, args) => {
      if (rejected) {
        const error = rejected;
        rejected = undefined;
        throw error;
      }
      const argv = args("/input", 4096);
      assert.equal(argv[0], "read");
      assert.equal(argv[1], "/input");
      assert.equal(argv[2], "--atomic-windows");
      assert.deepEqual(argv.slice(4), [
        "--json",
        "--atomic-output-bytes",
        "4096",
      ]);
      const requests = argv[3].split(",").map((part) => {
        const [address, length] = part.split(":");
        return { address, length: Number(length) };
      });
      const { text, capture } = captured(report(requests));
      capture.source.evidence_id = "ev_" + (captures.length + 1);
      captures.push({ name, requests });
      sources.set(capture.source.evidence_id, text);
      return capture;
    },
    (id) => sources.get(id),
  );
  return {
    reads,
    captures,
    reject(error) {
      rejected = error;
    },
  };
}
test("reordering, duplicate windows, mixed cached/new batches and caller mutation reuse exact facts", async () => {
  const { reads, captures } = owner();
  const first = await reads.read({ windows: [a, a, b] });
  assert.equal(captures.length, 1);
  assert.equal(captures[0].requests.length, 2);
  assert.deepEqual(
    first.results.map((r) => r.source_row),
    [0, 0, 1],
  );
  first.results[0].hex = "ffff";
  const reverse = await reads.read({ windows: [b, a] });
  assert.equal(captures.length, 1);
  assert.equal(reverse.results[1].hex, "0041");
  const c = { address: "0x3000", length: 2 };
  const mixed = await reads.read({ windows: [b, c, a] });
  assert.equal(captures.length, 2);
  assert.deepEqual(captures[1].requests, [c]);
  assert.equal(
    mixed.results[0].source.evidence_id,
    first.results[2].source.evidence_id,
  );
  assert.notEqual(
    mixed.results[1].source.evidence_id,
    mixed.results[0].source.evidence_id,
  );
  reads.clear();
  await reads.read({ windows: [a] });
  assert.equal(captures.length, 3);
});
test("global capture failure retains cached successes and leaves transient failures retryable", async () => {
  const { reads, captures, reject } = owner();
  await reads.read({ windows: [a] });
  reject(
    new FactFailure("cancelled", "stopped", {
      evidence_id: "ev_prefix",
      source_retained: true,
      source_complete: false,
    }),
  );
  const partial = await reads.read({ windows: [a, b] });
  assert(partial.results[0].ok);
  assert.equal(partial.results[1].error.code, "cancelled");
  assert.equal(partial.results[1].error.details.evidence_id, "ev_prefix");
  const retry = await reads.read({ windows: [b] });
  assert(retry.results[0].ok);
  assert.equal(captures.length, 2);
});
