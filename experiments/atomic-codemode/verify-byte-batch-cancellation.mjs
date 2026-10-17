// Actual producer cancellation preserves earlier facts and permits a fresh retry.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { AtomicSession } from "./session.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";
const [machinePath, output] = process.argv.slice(2),
  machine = JSON.parse(await readFile(machinePath, "utf8")),
  s = new AtomicSession(),
  run = createVerifierRun();
const [first, second] = machine.objects[0].windows;
const call = (windows, signal) =>
  s.call(
    "bytes",
    { windows: windows.map(({ address, length }) => ({ address, length })) },
    signal,
  );
const observations = [];
let failure;
assert.equal(process.env.REA_ATOMIC_NATIVE_BYTE_BATCH, "1");
try {
  await s.open(machine.target);
  const initial = await call([first]);
  observations.push(initial);
  assert(initial.ok && initial.data.results[0].ok);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("byte batch verifier cancellation")),
    250,
  );
  let cancelled;
  try {
    cancelled = await call([first, second], controller.signal);
  } finally {
    clearTimeout(timer);
  }
  observations.push(cancelled);
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.error.code, "cancelled");
  const partial = cancelled.error.details.partial_observation;
  assert(partial);
  assert.deepEqual(partial.results[0], initial.data.results[0]);
  assert.equal(partial.results[1].error.code, "cancelled");
  const retry = await call([first, second]);
  observations.push(retry);
  assert(retry.ok);
  assert.equal(retry.data.results[1].hex, second.hex);
  assert.deepEqual(retry.data.results[0], initial.data.results[0]);
} catch (error) {
  failure = error.stack ?? String(error);
} finally {
  s.abort();
  await s.close();
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
assert.equal(
  createHash("sha256")
    .update(await readFile(machine.target))
    .digest("hex"),
  machine.target_sha256,
);
await writeFile(
  output,
  JSON.stringify(
    { observations, failure: failure ?? null, lifecycle },
    null,
    2,
  ),
  { flag: "wx" },
);
assert.equal(failure, undefined);
