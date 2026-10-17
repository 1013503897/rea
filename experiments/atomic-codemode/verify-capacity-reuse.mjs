// Actual immutable-target refusal reuse through SDK and both MCP transports.
import assert from "node:assert/strict";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { AtomicSession } from "./session.mjs";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";
const [output, adapter = "sdk"] = process.argv.slice(2);
assert(
  output &&
    ["sdk", "direct", "codemode"].includes(adapter) &&
    process.env.REA_ATOMIC_EVIDENCE_DIR,
);
const target = "/usr/lib/x86_64-linux-gnu/libLLVM-16.so.1",
  digest = "f62d254b7f2bf42df8c8b07d46ee3bb4c2cafeca436b2e6bc6ccbe4581f58f40";
const sha = (value) => createHash("sha256").update(value).digest("hex");
assert.equal(sha(await readFile(target)), digest);
const run = createVerifierRun(),
  observations = [],
  phases = [],
  failures = [];
const session = adapter === "sdk" ? new AtomicSession() : null;
const client = session
  ? null
  : new Client({ name: "capacity-reuse-verifier", version: "0.1.0" });
const transport = session
  ? null
  : new StdioClientTransport({
      command: process.execPath,
      args: [resolve("experiments/atomic-codemode/server.mjs")],
      env: { ...process.env, REA_ATOMIC_ADAPTER: adapter },
      stderr: "pipe",
    });
const invoke = async (name, input) => {
  const reply = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  assert(!reply.isError);
  return JSON.parse(reply.content[0].text);
};
const read = async (name, input) =>
  session ? session.call(name, input) : invoke("facts_" + name, input);
const query = { query: "undefined symbol", fields: [], limit: 2 };
const measure = async (name, work) => {
  const start = performance.now(),
    before = await familyCounters();
  const result = await work(),
    after = await familyCounters();
  phases.push({
    name,
    elapsed_ms: performance.now() - start,
    cpu_seconds: (after.cpu - before.cpu) / 1e6,
  });
  return result;
};
let source;
try {
  if (session) await session.open(target);
  else {
    await client.connect(transport);
    await invoke("open_binary", { path: target });
  }
  let first, second, evidence;
  if (adapter === "codemode") {
    const program = await measure("in_program_cold_and_reuse", () =>
      invoke("execute_javascript", {
        code: `
   const first=await rea.strings(${JSON.stringify(query)});
   if(first.ok || first.error?.code!=="resource_constraint")
     return {first,second:null,evidence:null,warm_ms:null};
   const started=Date.now();
   const second=await rea.strings(${JSON.stringify(query)});
   const warm_ms=Date.now()-started;
   const id=first.error?.details?.evidence_id;
   const evidence=id?await rea.evidence({evidence_id:id,limit:64}):null;
   return {first,second,warm_ms,evidence};
  `,
      }),
    );
    observations.push({ phase: "code_program", response: program });
    assert(program.ok);
    assert.equal(
      program.execution.host_calls,
      program.value.first.error?.code === "resource_constraint" ? 3 : 1,
    );
    ({ first, second, evidence } = program.value);
    phases.push({
      name: "guest_wall_reuse",
      elapsed_ms: program.value.warm_ms,
      precision: "guest Date.now milliseconds; CPU unmeasured separately",
    });
  } else {
    first = await measure("cold_refusal", () => read("strings", query));
    observations.push({ phase: "first_refusal", response: first });
    assert.equal(
      first.error?.code,
      "resource_constraint",
      "cache-hit verification requires confirmed cleanup of the first refusal",
    );
    second = await measure("warm_refusal", () => read("strings", query));
    evidence = await read("evidence", {
      evidence_id: first.error?.details?.evidence_id,
      limit: 64,
    });
  }
  observations.push({ first, second, evidence });
  assert.equal(first.ok, false);
  assert.equal(
    first.error.code,
    "resource_constraint",
    "cleanup uncertainty is not proof of a cacheable refusal",
  );
  assert.equal(second.ok, false);
  assert.equal(second.error.code, first.error.code);
  assert.equal(second.context.lease, first.context.lease);
  assert(!Object.hasOwn(first, "data") && !Object.hasOwn(second, "data"));
  assert.equal(first.error.details.cached_observation, undefined);
  assert.deepEqual(second.error.details.cached_observation, {
    kind: "source_budget_refusal",
    scope: "target_lease",
  });
  const { cached_observation: _cachedObservation, ...original } =
    second.error.details;
  assert.deepEqual(original, first.error.details);
  assert(evidence?.ok);
  source = evidence.data.source;
  assert.equal(source.evidence_id, first.error.details.evidence_id);
  assert.equal(source.capture_complete, false);
  const files = (await readdir(process.env.REA_ATOMIC_EVIDENCE_DIR)).filter(
    (name) => name.endsWith(".json"),
  );
  assert.equal(files.length, 1, "reuse must not capture another source prefix");
  const raw = await readFile(
    join(process.env.REA_ATOMIC_EVIDENCE_DIR, source.evidence_id + ".txt"),
  );
  assert.equal(raw.length, source.bytes);
  assert.equal(sha(raw), source.sha256);
  assert.equal(evidence.data.text, raw.toString().slice(0, 64));
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  if (session) {
    session.abort();
    await session.close();
  } else {
    try {
      await invoke("close_binary", {});
    } finally {
      await client.close();
      await transport.close();
    }
  }
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
assert.equal(sha(await readFile(target)), digest);
await writeFile(
  output,
  JSON.stringify(
    {
      adapter,
      target,
      digest,
      phases,
      source,
      observations,
      failures,
      lifecycle,
    },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(JSON.stringify({ adapter, phases, failures }));
assert.deepEqual(failures, []);
