// Selected real SQLite wide-PHI facts through either public MCP adapter.
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

const [binary, output, goldenPath] = process.argv.slice(2);
const golden = JSON.parse(await readFile(goldenPath, "utf8")).functions[0];
const id = "0xea998:14649",
  indices = [0, 1, 77, 154, 155];
const expected = golden.atomic_projection.operations.find((op) => op.id === id);
assert.equal(expected.inputs.length, 156);
const values = new Map(golden.atomic_projection.values.map((v) => [v.id, v]));
const run = createVerifierRun(),
  calls = [],
  failures = [];
const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
const client = new Client({ name: "rea-operands-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
const call = async (name, input) => {
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
};
const read = async (name, input) => {
  const value = direct
    ? await call(`facts_${name}`, input)
    : (
        await call("execute_javascript", {
          code: `return await rea.${name}(${JSON.stringify(input)});`,
        })
      ).value;
  assert.equal(value.ok, true, JSON.stringify(value));
  return value.data;
};
try {
  await client.connect(transport);
  await call("open_binary", { path: binary });
  const capture = await read("snapshot", { entry: "0xea6d0" });
  const snapshot = capture.snapshot;
  const summary = await read("operations", { snapshot, ids: [id] });
  assert.equal(summary.items[0].input_count, 156);
  assert.equal(summary.items[0].definition_count, 156);
  assert.equal(Object.hasOwn(summary.items[0], "inputs"), false);
  const slice = await read("slice", {
    snapshot,
    seeds: [id],
    max_operations: 1,
  });
  assert.equal(slice.operations[0].input_count, 156);
  assert.ok(Buffer.byteLength(JSON.stringify(slice)) < 32768);
  const legacy = await read("operations", {
    snapshot,
    ids: [id],
    fields: ["inputs"],
  });
  assert.deepEqual(legacy.items[0].inputs, expected.inputs);
  const page = await read("relations", {
    snapshot,
    kind: "operands",
    seeds: [id],
    offset: 154,
    limit: 10,
  });
  assert.equal(page.total, 156);
  assert.equal(page.next_offset, null);
  assert.deepEqual(
    page.items.map((r) => r.input_index),
    [154, 155],
  );
  const selected = await read("relations", {
    snapshot,
    kind: "operands",
    seeds: [id, id, "0xffff:0"],
    input_indices: [...indices, 0, 156],
  });
  assert.deepEqual(selected.unretained_seeds, ["0xffff:0"]);
  assert.deepEqual(
    selected.items,
    indices.map((i) => ({
      operation: id,
      ...expected.inputs[i],
      definition: values.get(expected.inputs[i].value_id).definition,
    })),
  );
  assert.equal(selected.total, indices.length);
  assert.equal(selected.next_offset, null);
  assert.equal(selected.evidence_id, capture.source.evidence_id);
  const operandValues = await read("values", {
    snapshot,
    ids: selected.items.map((r) => r.value_id),
  });
  assert.deepEqual(
    operandValues.items,
    [...new Set(selected.items.map((r) => r.value_id))].map((id) =>
      values.get(id),
    ),
  );
  assert.equal(
    (await read("snapshot", { entry: "0xea6d0" })).snapshot,
    snapshot,
  );
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
  JSON.stringify({
    direct,
    calls,
    failures,
    lifecycle,
    scope:
      "Real public MCP facts versus retained native producer gold; no runtime or model-token claim.",
  }),
  { flag: "wx" },
);
console.log(JSON.stringify({ output, calls: calls.length, failures }));
if (failures.length) process.exitCode = 1;
