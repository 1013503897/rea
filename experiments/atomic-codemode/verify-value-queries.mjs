// Real public location/value-use reads; native graph fidelity is not alias proof.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import Ajv2020 from "ajv/dist/2020.js";
import { readNativeGraphEvidence } from "./native-ir-contract.mjs";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output, callerSource, emitterSource] = process.argv.slice(2);
assert.equal(process.versions.node, (await readFile(".nvmrc", "utf8")).trim());
const sources = await Promise.all(
  [callerSource, emitterSource].map((path) => readFile(path, "utf8")),
);
const [callerGolden, emitterGolden] = sources.map(
  (text) => JSON.parse(text).functions[0],
);
const [graph, emitterGraph] = sources.map((text) =>
  JSON.parse(readNativeGraphEvidence(text).text),
);
const location = { space: "ram", offset: "0x1144c8", size_bytes: 4 };
const expectedValues = graph.values.filter((v) =>
  Object.entries(location).every(([key, value]) => v[key] === value),
);
const byValue = new Map(expectedValues.map((v) => [v.id, []]));
const valuesByID = new Map(graph.values.map((v) => [v.id, v]));
for (const op of graph.operations)
  for (const input of op.inputs)
    if (byValue.has(input.value_id))
      byValue
        .get(input.value_id)
        .push({
          operation: op.id,
          ...input,
          definition: valuesByID.get(input.value_id).definition,
        });
assert.equal(expectedValues.length, 250);
assert.equal(
  [...byValue.values()].reduce((n, rows) => n + rows.length, 0),
  369,
);
const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
const client = new Client({
  name: "rea-value-query-verifier",
  version: "0.1.0",
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
const run = createVerifierRun(),
  calls = [],
  phases = [],
  failures = [];
async function call(name, input) {
  const reply = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  const value = JSON.parse(reply.content[0].text);
  calls.push({
    name,
    input,
    value,
    content_bytes: Buffer.byteLength(reply.content[0].text),
  });
  assert.equal(value.ok, true, JSON.stringify(value));
  return value;
}
async function read(name, input) {
  const value = direct
    ? await call(`facts_${name}`, input)
    : (
        await call("execute_javascript", {
          code: `return await rea.${name}(${JSON.stringify(input)});`,
        })
      ).value;
  assert.equal(value.ok, true, JSON.stringify(value));
  return value.data;
}
async function measure(phase, work) {
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
async function pages(name, input) {
  const items = [];
  let offset = 0;
  do {
    const page = await read(name, { ...input, offset, limit: 128 });
    assert.equal(page.coverage.memory_alias_dependencies, "unknown");
    items.push(...page.items);
    offset = page.next_offset;
  } while (offset !== null);
  return items;
}
try {
  await client.connect(transport);
  const catalog = await client.listTools(),
    ajv = new Ajv2020({ strict: false });
  for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
  const opened = await call("open_binary", { path: binary });
  assert.equal(
    opened.context.artifact_sha256,
    "04f2ff5f506a3f332e7adeb1478a4c551ae74acdd328e6fb5c2495664d4064e6",
  );
  const [emitter, caller] = await measure("fresh-two-captures", async () => [
    await read("snapshot", { entry: "0x25cb0" }),
    await read("snapshot", { entry: "0x280c0" }),
  ]);
  assert.equal(caller.coverage.operations, 11534);
  assert.equal(caller.coverage.values, 19504);
  const fields = ["space", "offset", "size_bytes", "definition", "is_input"];
  const selected = await measure("first-indexed-task", async () => {
    const values = await pages("values", {
      snapshot: caller.snapshot,
      locations: [location],
      fields,
    });
    const uses = [];
    for (let i = 0; i < values.length; i += 128)
      uses.push(
        ...(await pages("relations", {
          snapshot: caller.snapshot,
          kind: "value_uses",
          seeds: values.slice(i, i + 128).map((v) => v.id),
        })),
      );
    return { values, uses };
  });
  assert.deepEqual(
    selected.values,
    expectedValues.map((v) =>
      Object.fromEntries(["id", ...fields].map((k) => [k, v[k]])),
    ),
  );
  assert.deepEqual(
    selected.uses,
    expectedValues.flatMap((v) => byValue.get(v.id)),
  );
  await measure("warm-selected-value-use", async () => {
    const value = (
      await read("values", {
        snapshot: caller.snapshot,
        locations: [location],
        fields: [],
        limit: 1,
      })
    ).items[0];
    const uses = await read("relations", {
      snapshot: caller.snapshot,
      kind: "value_uses",
      seeds: [value.id],
    });
    assert.deepEqual(uses.items, byValue.get(value.id).slice(0, 20));
  });
  const inputLocation = { space: "register", offset: "0x38", size_bytes: 8 };
  const inputs = await read("values", {
    snapshot: emitter.snapshot,
    locations: [inputLocation],
    is_input: true,
    fields: [],
  });
  const expectedInputs = emitterGraph.values.filter(
    (v) =>
      v.is_input &&
      Object.entries(inputLocation).every(([k, value]) => v[k] === value),
  );
  assert.deepEqual(
    inputs.items,
    expectedInputs.map((v) => ({ id: v.id })),
  );
  const inputUses = await read("relations", {
    snapshot: emitter.snapshot,
    kind: "value_uses",
    seeds: inputs.items.map((v) => v.id),
  });
  assert.ok(
    inputUses.items.some(
      (r) =>
        r.operation === "0x25cc3:1e" &&
        r.input_index === 1 &&
        r.definition === null,
    ),
  );
  const missing = await read("values", {
    snapshot: caller.snapshot,
    locations: [{ ...location, space: "RAM" }],
    fields: [],
  });
  assert.equal(missing.total, 0);
  assert.deepEqual(missing.unretained_locations, [
    { ...location, space: "RAM" },
  ]);
  assert.equal(
    missing.location_coverage.unknown_space_count,
    graph.values.filter((v) => v.space === null).length,
  );
  for (const [capture, golden] of [
    [caller, callerGolden],
    [emitter, emitterGolden],
  ]) {
    const text = await readFile(
      join(
        process.env.REA_ATOMIC_EVIDENCE_DIR,
        `${capture.source.evidence_id}.txt`,
      ),
      "utf8",
    );
    assert.deepEqual(JSON.parse(text).functions[0], golden);
  }
  await call("close_binary", {});
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  await client.close();
  await transport.close();
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify(
    {
      direct,
      calls,
      phases,
      failures,
      lifecycle,
      scope:
        "Real public MCP and retained native producer fidelity; no runtime/alias or model-token claim.",
    },
    null,
    2,
  ),
);
assert.deepEqual(failures, []);
