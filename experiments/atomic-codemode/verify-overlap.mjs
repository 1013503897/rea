// Matched public MCP reads, without a model or changes to the native engine.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { familyCounters } from "./family-counters.mjs";
import { readNativeGraphEvidence } from "./native-ir-contract.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output, route, ordering, goldenPath] = process.argv.slice(2);
assert.ok(["direct", "code"].includes(route));
assert.ok(["sequential", "overlap"].includes(ordering));
assert.equal(
  process.versions.node,
  (await readFile(resolve(".nvmrc"), "utf8")).trim(),
);
assert.ok(
  process.env.REA_ATOMIC_EVIDENCE_DIR,
  "Retain exact source for fidelity checks",
);
const golden = JSON.parse(await readFile(goldenPath, "utf8")).functions[0];
const windows = [
  { address: "0xf2360", count: 18 },
  { address: "0xf2410", count: 22 },
  { address: "0x288f0", count: 3 },
];
const run = createVerifierRun();
const client = new Client({ name: "rea-overlap-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: {
    ...process.env,
    REA_ATOMIC_ADAPTER: route === "direct" ? "direct" : "code",
  },
  stderr: "pipe",
});
const failures = [],
  phases = [],
  requests = [];
const epoch = performance.now();
async function tool(name, input) {
  const reply = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  const value = JSON.parse(reply.content[0].text);
  assert.equal(value.ok, true, JSON.stringify(value));
  return value;
}
async function read(name, input) {
  const record = { method: name, started_ms: performance.now() - epoch };
  requests.push(record);
  const response =
    route === "direct"
      ? await tool(`facts_${name}`, input)
      : (
          await tool("execute_javascript", {
            code: `return await rea.${name}(${JSON.stringify(input)});`,
          })
        ).value;
  record.finished_ms = performance.now() - epoch;
  record.elapsed_ms = record.finished_ms - record.started_ms;
  assert.equal(response.ok, true, JSON.stringify(response));
  return response.data;
}
async function measured(phase, work) {
  const before = await familyCounters(),
    started = performance.now();
  const value = await work();
  const elapsed_ms = performance.now() - started,
    after = await familyCounters();
  phases.push({
    phase,
    elapsed_ms,
    family_cpu_seconds: (after.cpu - before.cpu) / 1e6,
    cumulative_family_memory_peak_bytes: after.peak,
  });
  return value;
}
let observations;
try {
  await client.connect(transport);
  const opened = await tool("open_binary", { path: binary });
  assert.equal(
    opened.context.artifact_sha256,
    "2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8",
  );
  const [snapshot, instructions] = await measured("fresh-lease", async () => {
    if (ordering === "sequential")
      return [
        await read("snapshot", { entry: "0xea6d0" }),
        await read("instructions", { windows }),
      ];
    const pending = read("snapshot", { entry: "0xea6d0" });
    // Deliberately overlap requests, not native processes: the session owns admission.
    // Attach rejection handling immediately even if the second request fails.
    const pair = Promise.all([
      pending,
      (async () => {
        await delay(100);
        return read("instructions", { windows });
      })(),
    ]);
    return pair;
  });
  assert.equal(snapshot.facets.recovered_ir.availability, "available");
  assert.equal(snapshot.coverage.operations, 21349);
  assert.equal(snapshot.coverage.omitted_definition_count, 0);
  assert.equal(instructions.results.length, windows.length);
  for (const item of instructions.results) assert.equal(item.ok, true);
  const warm = await measured("same-lease-reuse", async () => [
    await read("snapshot", { entry: "0xea6d0" }),
    await read("instructions", { windows }),
  ]);
  assert.deepEqual(warm, [snapshot, instructions]);
  const source = await readFile(
    join(
      process.env.REA_ATOMIC_EVIDENCE_DIR,
      `${snapshot.source.evidence_id}.txt`,
    ),
    "utf8",
  );
  const { atomic_facts: _archive, ...ordinary } =
    JSON.parse(source).functions[0];
  const { atomic_facts: expectedGraph, ...expectedOrdinary } = golden;
  assert.deepEqual(
    JSON.parse(readNativeGraphEvidence(source).text),
    expectedGraph,
  );
  assert.deepEqual(ordinary, expectedOrdinary);
  const first = requests[0],
    second = requests[1];
  assert.equal(second.started_ms < first.finished_ms, ordering === "overlap");
  observations = {
    snapshot,
    instructions,
    source_fidelity: "full-graph-and-ordinary-fields-match-golden",
  };
  await tool("close_binary", {});
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  try {
    await client.close();
  } catch (error) {
    failures.push(String(error));
  }
  try {
    await transport.close();
  } catch (error) {
    failures.push(String(error));
  }
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({
    route,
    ordering,
    phases,
    requests,
    observations,
    failures,
    lifecycle,
    scope:
      "Real MCP, same pinned engine and fresh lease/cache per run; no model/token measurement. Request overlap is observed at the client; AtomicSession serializes provider admission. Source elapsed includes command supervision/retention, not isolated native execution. CPU deltas cover each whole phase, not overlapping per-request attribution. Peak includes file cache and is cumulative; warm peak is an upper bound. OS caches and host contention are uncontrolled.",
  }),
  { flag: "wx" },
);
console.log(JSON.stringify({ output, route, ordering, phases, failures }));
if (failures.length) process.exitCode = 1;
