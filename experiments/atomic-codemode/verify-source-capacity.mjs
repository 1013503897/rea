// Real LLVM capacity and native-command cancellation; never execute the target.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { AtomicSession } from "./session.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [target, output] = process.argv.slice(2);
assert(target && output && process.env.REA_ATOMIC_EVIDENCE_DIR);
const hash = (b) => createHash("sha256").update(b).digest("hex");
const digest = hash(await readFile(target));
assert.equal(
  digest,
  "f62d254b7f2bf42df8c8b07d46ee3bb4c2cafeca436b2e6bc6ccbe4581f58f40",
);
const run = createVerifierRun(),
  session = new AtomicSession(),
  observations = [],
  failures = [];
try {
  await session.open(target);
  const start = performance.now(),
    response = await session.call("strings", {
      query: "undefined symbol",
      fields: [],
      limit: 2,
    });
  assert.equal(response.ok, false);
  assert(!Object.hasOwn(response, "data"));
  assert(
    ["resource_constraint", "cleanup_incomplete"].includes(response.error.code),
  );
  const details = response.error.details,
    capacity =
      response.error.code === "resource_constraint"
        ? details
        : details.source_capture_failure?.details;
  assert.equal(capacity.scope, "native_source");
  assert.equal(capacity.limit_bytes, 64 * 1024 * 1024);
  assert(capacity.observed_bytes_at_least > capacity.limit_bytes);
  assert.equal(details.source_retained, true);
  assert.equal(details.source_complete, false);
  observations.push({
    phase: "capacity",
    elapsed_ms: performance.now() - start,
    response,
  });
  const evidence = await session.call("evidence", {
    evidence_id: details.evidence_id,
    offset: 0,
    limit: 128,
  });
  assert(evidence.ok);
  assert.equal(evidence.data.source.capture_complete, false);
  assert.equal(evidence.data.text.length, 128);
  const raw = await readFile(
    join(process.env.REA_ATOMIC_EVIDENCE_DIR, details.evidence_id + ".txt"),
  );
  assert.equal(hash(raw), evidence.data.source.sha256);
  assert.equal(raw.length, evidence.data.source.bytes);
  assert(raw.length <= capacity.limit_bytes);
  assert.equal(evidence.data.text, raw.toString().slice(0, 128));
  observations.push({ phase: "partial_evidence", response: evidence });
  await session.close();
  await session.open(target);
  const cancellation = new AbortController(),
    timer = setTimeout(
      () => cancellation.abort("source verifier cancellation"),
      500,
    );
  let cancelled;
  try {
    cancelled = await session.call(
      "strings",
      { query: "undefined symbol", fields: [], limit: 2 },
      cancellation.signal,
    );
  } finally {
    clearTimeout(timer);
  }
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.error.code, "cancelled");
  observations.push({ phase: "cancellation", response: cancelled });
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  session.abort();
  await session.close();
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
assert.equal(hash(await readFile(target)), digest);
await writeFile(
  output,
  JSON.stringify(
    { target, digest, observations, failures, lifecycle },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    phases: observations.map(({ phase, response, ...rest }) => ({
      phase,
      ok: response.ok,
      code: response.error?.code ?? null,
      ...rest,
    })),
    failures,
  }),
);
assert.deepEqual(failures, []);
