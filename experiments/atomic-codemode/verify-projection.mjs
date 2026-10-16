// Real public selected-definition reads; full diagnostic comparison is separate.
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
const run = createVerifierRun(),
  calls = [],
  failures = [];
const client = new Client({
  name: "rea-projection-verifier",
  version: "0.1.0",
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
const call = async (name, input) => {
  const result = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  assert.equal(result._meta?.provenance?.untrusted_content, true);
  const value = JSON.parse(result.content[0].text);
  calls.push({ name, input, value });
  return value;
};
const read = async (name, input) => {
  const result = direct
    ? await call(`facts_${name}`, input)
    : await call("execute_javascript", {
        code: `return await rea.${name}(${JSON.stringify(input)});`,
      });
  assert.equal(result.ok, true, JSON.stringify(result));
  const response = direct ? result : result.value;
  assert.equal(response.ok, true, JSON.stringify(response));
  return response.data;
};
try {
  await client.connect(transport);
  const catalog = await client.listTools();
  const ajv = new Ajv2020({ strict: false });
  for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
  assert.equal((await call("open_binary", { path: binary })).ok, true);
  const captured = await read("snapshot", { entry: "0xea6d0" });
  assert.equal(captured.facets.recovered_ir.availability, "unavailable");
  assert.equal(
    captured.facets.operations.scope,
    "bounded-call-rooted-definitions",
  );
  assert.equal(captured.facets.operations.count, 4096);
  assert.equal(captured.coverage.control_flow, "not-collected");
  assert.ok(captured.facets.operations.definition_frontier_count > 0);
  const snapshot = captured.snapshot;
  const selected = await read("calls", {
    snapshot,
    origin_addresses: ["0xf115c", "0xf238b"],
    fields: ["arguments", "target", "target_value_id"],
  });
  assert.equal(selected.total, 2);
  const values = await read("values", {
    snapshot,
    ids: [
      ...new Set(
        selected.items.flatMap((r) => r.arguments.map((a) => a.value_id)),
      ),
    ],
  });
  assert.match(values.coverage.value_scope, /retained call-rooted/);
  const definitions = values.items.map((v) => v.definition).filter(Boolean);
  const bodies = await read("operations", {
    snapshot,
    ids: definitions,
    fields: ["opcode", "inputs", "output"],
  });
  assert.equal(bodies.total, definitions.length);
  assert.ok(bodies.items.every((r) => r.opcode === "CPUI_MULTIEQUAL"));
  assert.equal(bodies.evidence_id, captured.source.evidence_id);
  const slices = await read("slice", {
    snapshot,
    seeds: selected.items.map((r) => r.id),
    max_operations: 48,
    stop_kinds: ["load"],
    fields: ["opcode", "inputs", "output", "constants"],
  });
  assert.ok(slices.operations.length > 5);
  assert.equal(slices.coverage.memory_alias_dependencies, "unknown");
  const uses = await read("relations", {
    snapshot,
    kind: "uses",
    seeds: [bodies.items[0].id],
  });
  assert.match(uses.relation_coverage.scope, /selected-operations-only/);
  if (!direct) {
    const unavailable = await call("execute_javascript", {
      code: `return await rea.relations({snapshot:${JSON.stringify(snapshot)},kind:"controllers",seeds:[0]});`,
    });
    assert.equal(unavailable.value.ok, false);
    assert.equal(unavailable.value.error.code, "capability_unavailable");
    assert.equal(
      unavailable.value.error.details.evidence_id,
      captured.source.evidence_id,
    );
  }
  assert.equal(
    (await read("snapshot", { entry: "0xea6d0" })).snapshot,
    snapshot,
  );
  assert.equal((await call("close_binary", {})).ok, true);
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
  JSON.stringify({ direct, calls, failures, lifecycle }),
  {
    flag: "wx",
  },
);
console.log(JSON.stringify({ output, calls: calls.length, failures }));
if (failures.length) process.exitCode = 1;
