// Real SDK/provider lifecycle with an injected tagged cleanup failure.
// The failure is simulated; native reads and the successful retry use real owners.
import assert from "node:assert/strict";
import { stat, writeFile } from "node:fs/promises";
import { AtomicSession } from "./session.mjs";
import { KunaFactOwner } from "./provider.mjs";
import { KunaTargetCommands } from "../../dist/kuna/KunaTargetCommands.js";
import { ProviderCleanupError } from "../../dist/domain/providerCleanupError.js";
import { err } from "../../dist/domain/result.js";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output] = process.argv.slice(2);
assert.ok(binary && output, "Usage: verify-cleanup.mjs BINARY OUTPUT");
const run = createVerifierRun(),
  originalClose = KunaTargetCommands.prototype.close,
  observations = [],
  failures = [];
const owners = [];
try {
  for (const action of ["close", "replace"]) {
    const session = new AtomicSession(async (path, options) => {
      const owner = await KunaFactOwner.open(path, options);
      owners.push(owner);
      return owner;
    });
    await session.open(binary);
    const lease = session.context.lease;
    const inventory = await session.call("functions", { limit: 1, fields: [] });
    assert.equal(inventory.ok, true);
    const evidence = await session.call("evidence", {
      evidence_id: inventory.data.source.evidence_id,
      limit: 1,
    });
    assert.equal(evidence.ok, true);
    const staged = evidence.data.source.arguments[1],
      identity = await stat(staged);
    let injected = false;
    KunaTargetCommands.prototype.close = async function () {
      if (!injected) {
        injected = true;
        return err(
          new ProviderCleanupError("kuna", [staged], {
            reason: "Verifier-injected tagged cleanup failure before retry",
          }),
        );
      }
      return originalClose.call(this);
    };
    const attempt = () =>
      action === "close" ? session.close() : session.open(binary);
    await assert.rejects(
      attempt(),
      (error) =>
        error.code === "cleanup_incomplete" &&
        error.details.failure.details.resources.includes(staged),
      `${action} must surface tagged cleanup failure`,
    );
    assert.equal(injected, true);
    assert.equal(
      session.context.lease,
      lease,
      "Failed cleanup retains its owner",
    );
    assert.equal((await stat(staged)).ino, identity.ino);
    const retried = await attempt();
    assert.equal(retried.ok, true);
    if (action === "close") assert.equal(session.context, null);
    else assert.notEqual(session.context.lease, lease);
    await assert.rejects(stat(staged), { code: "ENOENT" });
    await session.close();
    observations.push({
      action,
      tagged_failure_reported: true,
      owner_and_staged_file_retained: true,
      retry_succeeded: true,
      staged_file_removed_after_retry: true,
    });
    KunaTargetCommands.prototype.close = originalClose;
  }
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  KunaTargetCommands.prototype.close = originalClose;
  for (const owner of owners) {
    try {
      await owner.close();
    } catch (error) {
      failures.push(`Final cleanup: ${String(error)}`);
    }
  }
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(output, JSON.stringify({ observations, failures, lifecycle }), {
  flag: "wx",
});
console.log(JSON.stringify({ output, observations, failures }));
if (failures.length) process.exitCode = 1;
