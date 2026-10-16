// Real public MCP checks; script assertions are not real-model performance data.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import Ajv2020 from "ajv/dist/2020.js";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output] = process.argv.slice(2);
const verifier = createVerifierRun();
const client = new Client({ name: "rea-call-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
const calls = [],
  failures = [];
const call = async (name, input) => {
  const result = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  assert.equal(result._meta?.provenance?.untrusted_content, true);
  const value = JSON.parse(result.content[0].text);
  calls.push({ name, input, value });
  assert.equal(value.ok, true, JSON.stringify(value));
  return value;
};
const read = async (name, input) => {
  const value = direct
    ? await call(`facts_${name}`, input)
    : await call("execute_javascript", {
        code: `const r=await rea.${name}(${JSON.stringify(input)});if(!r.ok)throw new Error(JSON.stringify(r));return r.data;`,
      });
  return direct ? value.data : value.value;
};
const home = (row, space, offset, width) =>
  row.space === space && row.offset === offset && row.size_bytes === width;

try {
  await client.connect(transport);
  const catalog = await client.listTools();
  const ajv = new Ajv2020({ strict: false });
  for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
  assert.equal(catalog.tools.length, direct ? 17 : 4);
  const opened = await call("open_binary", { path: binary });
  assert.equal(
    opened.context.artifact_sha256,
    "2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8",
  );
  assert.equal(opened.context.analysis_model, "experimental-native-ir-v2");
  const wrapper = await read("snapshot", { entry: "0x65180" });
  const selected = await read("calls", {
    snapshot: wrapper.snapshot,
    origin_addresses: ["0x65211"],
  });
  assert.equal(selected.total, 1);
  const parserCall = selected.items[0];
  assert.deepEqual(parserCall.target, { space: "ram", offset: "0x64060" });
  const arg = parserCall.arguments.find(
    (a) => a.storage && home(a.storage, "register", "0x38", 8),
  );
  assert.ok(arg, "recovered RDI passing storage");
  const callerValue = await read("values", {
    snapshot: wrapper.snapshot,
    ids: [arg.value_id],
  });
  assert.equal(callerValue.items[0].is_input, false);
  assert.ok(callerValue.items[0].definition);
  const parser = await read("snapshot", { entry: parserCall.target.offset });
  const inputs = await read("values", {
    snapshot: parser.snapshot,
    is_input: true,
    fields: ["space", "offset", "size_bytes", "is_input"],
    limit: 128,
  });
  assert.equal(inputs.next_offset, null);
  const candidates = inputs.items.filter((v) =>
    home(v, arg.storage.space, arg.storage.offset, arg.storage.size_bytes),
  );
  assert.equal(candidates.length, 1);
  const updates = await read("operations", {
    snapshot: parser.snapshot,
    origin_addresses: ["0x64699", "0x64c92"],
    kind: "store",
    fields: ["inputs", "definitions"],
    limit: 8,
  });
  assert.equal(updates.total, 2);
  const dependencies = await read("slice", {
    snapshot: parser.snapshot,
    seeds: updates.items.map((o) => o.id),
    max_operations: 32,
    fields: ["opcode", "inputs", "constants"],
  });
  assert.ok(
    dependencies.value_frontier.some((v) => v.value_id === candidates[0].id),
  );
  const indirect = await read("calls", {
    snapshot: parser.snapshot,
    origin_addresses: ["0x644eb", "0x6450c", "0x64af3", "0x647d1", "0x64807"],
    fields: ["target", "arguments"],
  });
  assert.equal(indirect.total, 5);
  assert.ok(
    indirect.items.every(
      (c) =>
        c.opcode === "CPUI_CALLIND" && c.target === null && c.spec_available,
    ),
  );
  const machine = await read("instructions", {
    windows: [{ address: "0x644eb", count: 1 }],
    fields: ["bytes", "mnemonic"],
  });
  assert.equal(machine.results[0].items[0].bytes, "ff5328");
  assert.equal(machine.results[0].items[0].mnemonic, "CALL");
  const formatter = await read("snapshot", { entry: "0x5efc0" });
  const formatCalls = await read("calls", {
    snapshot: formatter.snapshot,
    origin_addresses: ["0x5f031", "0x5f062"],
  });
  assert.deepEqual(
    formatCalls.items.map((c) => c.target?.offset),
    ["0x2adc0", "0x27e50"],
  );
  const ops = await read("operations", {
    snapshot: formatter.snapshot,
    ids: formatCalls.items.map((c) => c.id),
    fields: ["inputs"],
  });
  const annotations = await read("values", {
    snapshot: formatter.snapshot,
    ids: ops.items.map((o) => o.inputs[0].value_id),
  });
  assert.ok(
    annotations.items.every((v) => v.space === "fspec" && v.is_annotation),
  );
  assert.deepEqual(
    annotations.items.map((v) => v.offset),
    ["0x10000", "0x10001"],
  );
  const projected = await read("calls", {
    snapshot: formatter.snapshot,
    ids: [formatCalls.items[0].id, "missing"],
    fields: ["target"],
    limit: 1,
  });
  assert.deepEqual(projected.missing, ["missing"]);
  assert.equal(Object.hasOwn(projected.items[0], "arguments"), false);
  const cached = await read("snapshot", { entry: "0x65180" });
  assert.equal(cached.snapshot, wrapper.snapshot);
  assert.equal(cached.source.evidence_id, wrapper.source.evidence_id);
  if (!direct) {
    const composed = await call("execute_javascript", {
      code: `const s=await rea.snapshot({entry:"0x65180"});const c=await rea.calls({snapshot:s.data.snapshot,origin_addresses:["0x65211"]});const a=c.data.items[0].arguments.find(a=>a.storage?.space==="register"&&a.storage.offset==="0x38");const t=await rea.snapshot({entry:c.data.items[0].target.offset});const v=await rea.values({snapshot:t.data.snapshot,is_input:true,limit:128});return {candidate_inputs:v.data.items.filter(v=>v.space===a.storage.space&&v.offset===a.storage.offset&&v.size_bytes===a.storage.size_bytes).map(v=>v.id)};`,
    });
    assert.deepEqual(
      composed.value.candidate_inputs,
      candidates.map((v) => v.id),
    );
    assert.ok(composed.evidence_ids.length >= 2);
  }
  await call("close_binary", {});
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  try {
    await client.close();
    await transport.close();
  } catch (error) {
    failures.push(String(error));
  }
}
const lifecycle = await completeVerifierRun(verifier);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({ direct, calls, failures, lifecycle }),
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    output,
    direct,
    calls: calls.length,
    failures,
    cleanup_verified: true,
  }),
);
if (failures.length) process.exitCode = 1;
