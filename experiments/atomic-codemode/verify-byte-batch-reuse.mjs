// Same completed SDK task with either native acquisition profile; exact file oracle.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AtomicSession } from "./session.mjs";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [machinePath, output] = process.argv.slice(2);
assert(machinePath && output && process.env.REA_ATOMIC_EVIDENCE_DIR);
const machine = JSON.parse(await readFile(machinePath, "utf8")),
  windows = machine.objects.flatMap((row) => row.windows),
  session = new AtomicSession(),
  run = createVerifierRun(),
  phases = [],
  observations = [],
  sources = new Set();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const batch = process.env.REA_ATOMIC_NATIVE_BYTE_BATCH === "1";
assert.equal(sha(await readFile(machine.target)), machine.target_sha256);
async function read(name, selected) {
  const before = await familyCounters(),
    start = performance.now();
  const reply = await session.call("bytes", {
    windows: selected.map(({ address, length }) => ({ address, length })),
  });
  const after = await familyCounters();
  phases.push({
    name,
    elapsed_ms: performance.now() - start,
    cpu_seconds: (after.cpu - before.cpu) / 1e6,
  });
  observations.push(reply);
  assert(reply.ok);
  for (const [index, row] of reply.data.results.entries()) {
    assert(row.ok);
    assert.equal(row.address, selected[index].address);
    assert.equal(row.hex, selected[index].hex);
    assert.equal(row.returned_bytes, selected[index].length);
    assert.equal(row.coverage.status, "complete-for-requested-range");
    assert.equal(row.coverage.runtime_memory, "not-observed");
    assert.equal(row.coverage.original_file_mapping, "unknown");
    sources.add(row.source.evidence_id);
  }
  return reply;
}
let failure,
  checked = 0;
try {
  await session.open(machine.target);
  assert.equal(
    session.context.byte_acquisition,
    batch ? "native-batch-v1" : "native-single-window",
  );
  const cold = await read("cold_ten_windows", windows);
  assert.equal(
    new Set(cold.data.results.map((r) => r.source.evidence_id)).size,
    batch ? 1 : 10,
  );
  const reordered = [windows[9], windows[0], windows[0]];
  const warm = await read("warm_reordered_duplicates", reordered);
  for (const [index, original] of [9, 0, 0].entries())
    assert.deepEqual(warm.data.results[index], cold.data.results[original]);
  const extra = { ...windows[0], length: 1, hex: windows[0].hex.slice(0, 2) };
  const mixed = await read("mixed_cached_and_new_window", [windows[0], extra]);
  assert.deepEqual(mixed.data.results[0], cold.data.results[0]);
  assert.notEqual(
    mixed.data.results[1].source.evidence_id,
    cold.data.results[0].source.evidence_id,
  );
  for (const filename of await readdir(process.env.REA_ATOMIC_EVIDENCE_DIR)) {
    if (!filename.endsWith(".json")) continue;
    const meta = JSON.parse(
        await readFile(
          join(process.env.REA_ATOMIC_EVIDENCE_DIR, filename),
          "utf8",
        ),
      ),
      raw = await readFile(
        join(
          process.env.REA_ATOMIC_EVIDENCE_DIR,
          filename.replace(/\.json$/u, ".txt"),
        ),
      );
    assert.equal(meta.context.artifact_sha256, machine.target_sha256);
    assert.equal(
      meta.context.engine_sha256,
      process.env.REA_ATOMIC_NATIVE_IR_ENGINE_SHA256,
    );
    assert.equal(meta.source.bytes, raw.length);
    assert.equal(meta.source.sha256, sha(raw));
    assert(meta.source.capture_complete);
    assert(sources.has(meta.source.evidence_id));
    checked++;
  }
  assert.equal(checked, batch ? 2 : 11);
  const old = cold.data.results[0].source.evidence_id;
  await session.close();
  await session.open(machine.target);
  const stale = await session.call("evidence", {
    evidence_id: old,
    offset: 0,
    limit: 32,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, "unknown_evidence");
} catch (error) {
  failure = error.stack ?? String(error);
} finally {
  session.abort();
  await session.close();
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
assert.equal(sha(await readFile(machine.target)), machine.target_sha256);
const report = {
  batch,
  phases,
  raw_sources_verified: checked,
  observations,
  failure: failure ?? null,
  lifecycle,
};
await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" });
console.log(
  JSON.stringify({ batch, phases, checked, failure: failure ?? null }),
);
assert.equal(failure, undefined);
