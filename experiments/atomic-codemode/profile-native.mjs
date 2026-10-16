// Diagnostic native timings, using REA's target, environment and process owners.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseBinaryTarget } from "../../dist/application/BinaryTargetResolver.js";
import { inspectKunaInstallation } from "../../dist/kuna/KunaInstallation.js";
import { KunaTargetCommands } from "../../dist/kuna/KunaTargetCommands.js";
import { PrivateRuntimeRoot } from "../../dist/process/PrivateRuntimeRoot.js";
import { spawnOwnedProviderProcess } from "../../dist/process/ProviderProcess.js";
import { requireResult } from "./fact-error.mjs";
import { parseNativeIR } from "./native-ir.mjs";
import { NATIVE_OUTPUT_BYTES } from "./limits.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "without-timing": { type: "boolean", default: false },
    "output-bytes": { type: "string", default: String(NATIVE_OUTPUT_BYTES) },
  },
});
const [engine, binary, entry, output, goldenPath] = positionals;
const timingEnabled = !options["without-timing"];
assert.ok(engine && binary && entry && output);
const outputBytes = Number(options["output-bytes"]);
assert.ok(
  Number.isSafeInteger(outputBytes) &&
    outputBytes > 0 &&
    outputBytes <= NATIVE_OUTPUT_BYTES,
  "Choose a positive native output budget within the supervisor's 8 MiB capture capacity",
);
const sha = (s) => createHash("sha256").update(s).digest("hex");
const expectedPhases = [
  "decompile_drive",
  "pre_render_metadata",
  "render_c",
  "metadata_extract",
  "membership",
  "calls",
  "full_graph",
  "projection",
  "metadata_tail",
];
const verifier = createVerifierRun(),
  runs = [],
  failures = [];
const root = await PrivateRuntimeRoot.create({ prefix: "rea-atomic-profile-" });
let commands, installation, target;
try {
  target = requireResult(await parseBinaryTarget(binary));
  installation = requireResult(
    await inspectKunaInstallation({
      ...process.env,
      REA_KUNA_COMMAND: engine,
      REA_KUNA_CACHE_DIR: join(root.path, "engine-cache"),
    }),
  );
  commands = new KunaTargetCommands(target, {
    signal: new AbortController().signal,
    launcher: (options) =>
      spawnOwnedProviderProcess({
        ...options,
        env: {
          ...options.env,
          ...(timingEnabled ? { KUNA_EXPERIMENT_ATOMIC_TIMING: "1" } : {}),
        },
      }),
  });
  let firstFunction;
  for (const phase of [
    "fresh-private-native-cache",
    "same-private-native-cache-new-process",
  ]) {
    const before = performance.now();
    const captured = requireResult(
      await commands.run({
        installation,
        operation: "experiment:atomic-phase-profile",
        arguments: (input) => [
          "decompile",
          input,
          entry,
          "--addr",
          "--json",
          "--atomic-facts",
          "--atomic-output-bytes",
          String(outputBytes),
          "--max-fn-memory",
          "1024",
        ],
        outputBytes: NATIVE_OUTPUT_BYTES,
        timeoutMs: 120000,
        signal: new AbortController().signal,
      }),
    );
    const wallMs = performance.now() - before;
    const stdout = captured.stdout.text,
      stderr = captured.stderr.text;
    const stdoutPath = `${output}.run-${runs.length}.stdout.json`,
      stderrPath = `${output}.run-${runs.length}.stderr.jsonl`;
    await writeFile(stdoutPath, stdout, { flag: "wx" });
    await writeFile(stderrPath, stderr, { flag: "wx" });
    const record = {
      phase,
      wall_ms: wallMs,
      status: "unverified",
      source: {
        stdout_path: stdoutPath,
        stdout_sha256: sha(stdout),
        stdout_bytes: Buffer.byteLength(stdout),
        stderr_path: stderrPath,
        stderr_sha256: sha(stderr),
      },
    };
    runs.push(record);
    assert.notEqual(captured.diagnosticTruncated, true);
    const timings = stderr
      .split("\n")
      .filter((line) => line.startsWith('{"kind":"rea_atomic_phase",'))
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      timings.map((row) => row.phase),
      timingEnabled ? expectedPhases : [],
    );
    assert.ok(
      timings.every(
        (row) =>
          row.address === entry &&
          Number.isSafeInteger(row.wall_ns) &&
          row.wall_ns >= 0,
      ),
    );
    const model = parseNativeIR(stdout, entry, captured.input);
    const functionRecord = JSON.parse(stdout).functions[0];
    if (firstFunction) assert.deepEqual(functionRecord, firstFunction);
    firstFunction ??= functionRecord;
    if (goldenPath)
      assert.deepEqual(
        functionRecord,
        JSON.parse(await readFile(goldenPath, "utf8")).functions[0],
      );
    const accountedMs = timingEnabled
      ? timings.reduce((n, row) => n + row.wall_ns / 1e6, 0)
      : null;
    if (accountedMs !== null) assert.ok(accountedMs <= wallMs);
    Object.assign(record, {
      status: "verified",
      accounted_wall_ms: accountedMs,
      unprofiled_wall_ms: accountedMs === null ? null : wallMs - accountedMs,
      timings,
      code_bytes: Buffer.byteLength(functionRecord.code),
      facets: model.facets,
      function_record_matches_prior_run: runs.length > 1,
      function_record_matches_golden: goldenPath ? true : null,
    });
  }
} catch (error) {
  failures.push({
    code: error.code ?? "verification_failed",
    message: error.message,
    details: error.details ?? {},
    stack: error.stack,
  });
} finally {
  let closed = true;
  if (commands) {
    const result = await commands.close();
    closed = result.ok;
    if (!closed)
      failures.push({
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
      });
  }
  if (closed) {
    try {
      await root.close();
    } catch (error) {
      failures.push({
        code: "cleanup_incomplete",
        message: error.message,
        resources: [root.path],
      });
    }
  }
}
const lifecycle = await completeVerifierRun(verifier);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify(
    {
      engine: installation && {
        path: installation.executable,
        sha256: installation.sha256,
      },
      target: target && { path: target.path, sha256: target.sha256 },
      entry,
      timing_enabled: timingEnabled,
      output_budget_bytes: outputBytes,
      supervisor_capture_budget_bytes: NATIVE_OUTPUT_BYTES,
      runs,
      failures,
      lifecycle,
      scope:
        "Diagnostic native processes through production owners with an explicit timing-only launcher environment. Phase walls only, not phase CPU. Whole-run CPU/peak memory are separate resource-run receipts; OS cache uncontrolled. Not a model or public MCP measurement.",
    },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(JSON.stringify({ output, runs: runs.length, failures }));
if (failures.length) process.exitCode = 1;
