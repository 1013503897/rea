// Equivalent complete span occurrences through the existing exact-address API.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { AtomicSession } from "./session.mjs";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";
const [binary, output] = process.argv.slice(2);
assert(
  binary && output,
  "Usage: node measure-reference-spans.mjs BINARY NEW_OUTPUT_JSON",
);
const session = new AtomicSession(),
  verifier = createVerifierRun(),
  failures = [];
const observations = [],
  phases = [],
  sources = new Map();
const call = async (method, input) => {
  const r = await session.call(method, input);
  assert.equal(r.ok, true, JSON.stringify(r));
  for (const d of r.data.results ?? [r.data]) {
    if (Object.hasOwn(d, "ok")) assert.equal(d.ok, true, JSON.stringify(d));
    if (d.source) sources.set(d.source.evidence_id, d.source);
  }
  observations.push({ method, input, data: r.data });
  return r.data;
};
const measure = async (phase, work) => {
  const a = await familyCounters(),
    start = performance.now();
  const result = await work(),
    b = await familyCounters();
  phases.push({
    phase,
    elapsed_ms: performance.now() - start,
    family_cpu_seconds: (b.cpu - a.cpu) / 1e6,
    peak_bytes: b.peak,
  });
  return result;
};
let context, spans;
try {
  await session.open(binary);
  context = session.context;
  assert.equal(
    context.artifact_sha256,
    "2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8",
  );
  spans = [];
  for (const text of ["no such table", "sqlite_schema"]) {
    const inventory = await call("strings", { query: text, limit: 128 });
    const selected = inventory.items.filter((s) => s.value === text);
    assert.equal(selected.length, 1);
    const row = selected[0];
    assert.equal(row.string.encoding, "ascii");
    assert.equal(row.string.byte_length, 14);
    const addresses = Array.from(
      { length: row.string.byte_length },
      (_, i) => "0x" + (BigInt(row.address) + BigInt(i)).toString(16),
    );
    const input = {
      addresses,
      kinds: ["data"],
      fields: ["fromFunction", "instruction"],
      limit: 128,
    };
    const cold = await measure("cold-enumeration:" + text, () =>
      call("references", input),
    );
    assert(cold.results.every((r) => r.next_offset === null));
    const warm = await measure("warm-enumeration:" + text, () =>
      call("references", input),
    );
    assert.deepEqual(warm, cold);
    spans.push({
      text,
      start: row.address,
      end_inclusive: addresses.at(-1),
      rows: cold.results.flatMap((r) => r.items),
      counts: cold.results.map((r) => [r.address, r.total]),
    });
  }
  for (const source of sources.values()) {
    let text = "",
      offset = 0;
    do {
      const p = await session.call("evidence", {
        evidence_id: source.evidence_id,
        offset,
        limit: 16384,
      });
      assert.equal(p.ok, true);
      text += p.data.text;
      offset = p.data.next_offset;
    } while (offset !== null);
    assert.equal(Buffer.byteLength(text), source.bytes);
    assert.equal(
      createHash("sha256").update(text).digest("hex"),
      source.sha256,
    );
  }
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  session.abort();
  try {
    await session.close();
  } catch (error) {
    failures.push(error.stack ?? String(error));
  }
}
const lifecycle = await completeVerifierRun(verifier);
assertVerifierCleanupComplete(lifecycle.process_lineage);
assert.deepEqual(failures, []);
await writeFile(
  output,
  JSON.stringify({
    context,
    spans,
    phases,
    observations,
    source_count: sources.size,
    lifecycle,
  }),
  { flag: "wx" },
);
console.log(JSON.stringify({ spans, phases, source_count: sources.size }));
