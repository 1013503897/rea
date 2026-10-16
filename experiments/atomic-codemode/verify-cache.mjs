// A real MCP cold/warm read benchmark. No model runs in this verifier.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output, entry = "0xc1e0"] = process.argv.slice(2);
const group = (await readFile("/proc/self/cgroup", "utf8"))
  .trim()
  .split("\n")
  .find((row) => row.startsWith("0::"))
  ?.slice(3);
assert.ok(group?.includes("rea-efficiency-"), "Run under resource-run.py");
const counters = async () => ({
  cpu: Number(
    (await readFile(`/sys/fs/cgroup${group}/cpu.stat`, "utf8")).match(
      /usage_usec (\d+)/u,
    )[1],
  ),
  peak: Number(
    (await readFile(`/sys/fs/cgroup${group}/memory.peak`, "utf8")).trim(),
  ),
});
const verifier = createVerifierRun();
const client = new Client({ name: "rea-cache-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
const phases = [],
  failures = [];
const call = async (name, args = {}) => {
  const reply = await client.callTool(
    { name, arguments: args },
    { timeout: 180000 },
  );
  const value = JSON.parse(reply.content[0].text);
  assert.equal(value.ok, true, JSON.stringify(value));
  return value;
};
try {
  await client.connect(transport);
  await call("open_binary", { path: binary });
  for (const phase of ["cold_snapshot", "warm_snapshot"]) {
    const before = await counters(),
      start = performance.now();
    const result = await call("execute_javascript", {
      code: `const r=await rea.snapshot({entry:${JSON.stringify(entry)}});if(!r.ok)throw new Error(JSON.stringify(r));return r.data;`,
    });
    const elapsed = performance.now() - start,
      after = await counters();
    phases.push({
      phase,
      elapsed_ms: elapsed,
      family_cpu_seconds: (after.cpu - before.cpu) / 1e6,
      cumulative_family_memory_peak_bytes: after.peak,
      snapshot: result.value.snapshot,
      source: result.value.source,
      facets: result.value.facets,
    });
  }
  assert.equal(phases[0].snapshot, phases[1].snapshot);
  assert.equal(phases[0].source.evidence_id, phases[1].source.evidence_id);
  await call("close_binary");
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
const lifecycle = await completeVerifierRun(verifier);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({
    phases,
    failures,
    lifecycle,
    scope:
      "Real MCP, no model/token measurement. CPU deltas cover the owned cgroup. Memory peaks are cumulative; the warm value is an upper bound on its isolated phase peak. Both reads share one immutable captured artifact/lease; this is not a cross-session cache benchmark.",
  }),
);
console.log(
  JSON.stringify({
    output,
    phases: phases.map(({ phase, elapsed_ms, family_cpu_seconds }) => ({
      phase,
      elapsed_ms,
      family_cpu_seconds,
    })),
  }),
);
if (failures.length) process.exitCode = 1;
