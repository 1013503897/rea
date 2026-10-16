// Real MCP failure delivery, including source access after an oversized error.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output] = process.argv.slice(2);
const verifier = createVerifierRun();
const client = new Client({ name: "rea-executor-verifier", version: "0.1" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
const observations = [],
  failures = [];
const call = async (name, input = {}) => {
  const result = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  assert.equal(result._meta?.provenance?.untrusted_content, true);
  const value = JSON.parse(result.content[0].text);
  observations.push({
    name,
    input,
    value,
    encoded_utf8_bytes: Buffer.byteLength(result.content[0].text),
  });
  return value;
};
try {
  await client.connect(transport);
  for (const code of [
    'throw new Error("x".repeat(40000))',
    'throw new Error("\\0".repeat(6000))',
  ]) {
    const result = await call("execute_javascript", { code });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "output_budget");
    assert.equal(result.error.details.original_message_omitted, true);
    assert.ok(observations.at(-1).encoded_utf8_bytes < 32768);
  }
  const ordinary = await call("execute_javascript", {
    code: 'throw new Error("x".repeat(10000))',
  });
  assert.equal(ordinary.error.code, "javascript_error");
  assert.ok(ordinary.error.message.includes("x".repeat(10000)));
  const opened = await call("open_binary", { path: binary });
  assert.equal(opened.ok, true);
  const result = await call("execute_javascript", {
    code: 'const r=await rea.strings({query:"incorrect header check"});if(!r.ok)throw new Error(JSON.stringify(r));throw new Error("x".repeat(40000));',
  });
  assert.equal(result.error.code, "output_budget");
  assert.equal(result.context.lease, opened.context.lease);
  assert.equal(result.evidence_ids.length, 1);
  const source = await call("execute_javascript", {
    code: `const r=await rea.evidence({evidence_id:${JSON.stringify(result.evidence_ids[0])},limit:64});if(!r.ok)throw new Error(JSON.stringify(r));return r.data;`,
  });
  assert.equal(source.ok, true);
  assert.equal(source.value.source.evidence_id, result.evidence_ids[0]);
  assert.ok(source.value.source.bytes > 0);
  assert.ok(source.value.text.length > 0);
  assert.equal((await call("close_binary")).ok, true);
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
await writeFile(output, JSON.stringify({ observations, failures, lifecycle }), {
  flag: "wx",
});
console.log(JSON.stringify({ output, failures, cleanup_verified: true }));
if (failures.length) process.exitCode = 1;
