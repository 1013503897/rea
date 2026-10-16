// Native diagnostic probes; these text dumps are not a typed provider contract.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseBinaryTarget } from "../../dist/application/BinaryTargetResolver.js";
import { inspectKunaInstallation } from "../../dist/kuna/KunaInstallation.js";
import { KunaTargetCommands } from "../../dist/kuna/KunaTargetCommands.js";
import { AnalysisError } from "../../dist/domain/analysisErrorBase.js";
import { projectAnalysisError } from "../../dist/domain/analysisErrorProjection.js";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, procedure, view, prefix] = process.argv.slice(2);
assert.ok(binary && /^0x[0-9a-f]+$/u.test(procedure) && prefix);
assert.ok(["raw", "regions", "assembly"].includes(view));
await mkdir(dirname(prefix), { recursive: true });
const verifier = createVerifierRun();
const lifetime = new AbortController();
const target = await parseBinaryTarget(binary);
assert.ok(target.ok);
const installed = await inspectKunaInstallation({
  ...process.env,
  REA_KUNA_CACHE_DIR: resolve(`${prefix}.cache`),
});
assert.ok(installed.ok);
const commands = new KunaTargetCommands(target.value, {
  signal: lifetime.signal,
});
const failures = [],
  calls = [];
try {
  const arguments_ = (input) =>
    view === "assembly"
      ? ["disassemble", input, procedure, "--addr", "--json"]
      : [
          "decompile",
          input,
          procedure,
          "--addr",
          `--${view}`,
          "--max-fn-memory",
          "1024",
        ];
  const start = performance.now();
  const outcome = await commands.run({
    installation: installed.value,
    operation: "experiment:structure",
    arguments: arguments_,
    outputBytes: 16 * 1024 * 1024,
    timeoutMs: 120000,
    signal: lifetime.signal,
  });
  if (!outcome.ok) throw outcome.error;
  const snapshot = outcome.value;
  const file = `${prefix}.native.txt`;
  await writeFile(file, snapshot.stdout.text, { flag: "wx" });
  calls.push({
    arguments: arguments_(snapshot.input),
    elapsed_ms: performance.now() - start,
    file,
    bytes: Buffer.byteLength(snapshot.stdout.text),
    sha256: createHash("sha256").update(snapshot.stdout.text).digest("hex"),
  });
} catch (error) {
  failures.push(
    error instanceof AnalysisError
      ? projectAnalysisError(error)
      : String(error.stack ?? error),
  );
} finally {
  lifetime.abort();
  await commands.close();
}
const lifecycle = await completeVerifierRun(verifier);
let cleanupVerified = false;
try {
  assertVerifierCleanupComplete(lifecycle.process_lineage);
  cleanupVerified = true;
} catch (error) {
  failures.push(String(error));
}
const report = {
  binary: resolve(binary),
  procedure,
  view,
  calls,
  failures,
  lifecycle,
  engine: { version: installed.value.version, sha256: installed.value.sha256 },
  target_sha256: createHash("sha256")
    .update(await readFile(binary))
    .digest("hex"),
};
await writeFile(`${prefix}.report.json`, JSON.stringify(report, null, 2), {
  flag: "wx",
});
console.log(
  JSON.stringify({
    view,
    calls,
    failures,
    cleanup_verified: cleanupVerified,
  }),
);
if (failures.length) process.exitCode = 1;
