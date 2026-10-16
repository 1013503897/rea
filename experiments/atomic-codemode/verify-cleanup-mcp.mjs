// Real public MCP lifecycle, with one explicit test-only tagged failure.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { PrivateRuntimeRoot } from "../../dist/process/PrivateRuntimeRoot.js";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output] = process.argv.slice(2);
assert.ok(binary && output, "Usage: verify-cleanup-mcp.mjs BINARY OUTPUT");
const run = createVerifierRun(),
  calls = [],
  failures = [],
  root = await PrivateRuntimeRoot.create({
    prefix: "rea-cleanup-mcp-verifier-",
  });
const url = (path) => JSON.stringify(pathToFileURL(resolve(path)).href);
const bootstrap = join(root.path, "injected-cleanup.mjs");
await writeFile(
  bootstrap,
  `import {KunaTargetCommands} from ${url("dist/kuna/KunaTargetCommands.js")};
import {ProviderCleanupError} from ${url("dist/domain/providerCleanupError.js")};
import {err} from ${url("dist/domain/result.js")};
const close=KunaTargetCommands.prototype.close;let injected=false;
KunaTargetCommands.prototype.close=async function(){
 if(!injected){injected=true;return err(new ProviderCleanupError("kuna",["verifier-injected-cleanup-resource"],{reason:"Explicit verifier fault; not a real engine cleanup failure"}));}
 return close.call(this);
};`,
  { flag: "wx" },
);
const client = new Client({ name: "rea-cleanup-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    "--import",
    bootstrap,
    resolve("experiments/atomic-codemode/server.mjs"),
  ],
  env: { ...process.env },
  stderr: "pipe",
});
const call = async (name, input) => {
  const result = await client.callTool({ name, arguments: input });
  const value = JSON.parse(result.content[0].text);
  calls.push({ name, input, value });
  return value;
};
try {
  await client.connect(transport);
  const opened = await call("open_binary", { path: binary });
  assert.equal(opened.ok, true);
  const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
  const read = direct
    ? await call("facts_functions", { limit: 1, fields: [] })
    : await call("execute_javascript", {
        code: "return await rea.functions({limit:1,fields:[]});",
      });
  assert.equal(read.ok, true);
  if (!direct) assert.equal(read.value.ok, true);
  const failed = await call("close_binary", {});
  assert.equal(failed.ok, false);
  assert.equal(failed.context.lease, opened.context.lease);
  assert.equal(failed.error.code, "cleanup_incomplete");
  assert.deepEqual(failed.error.details.failure.details.resources, [
    "verifier-injected-cleanup-resource",
  ]);
  assert.equal((await call("close_binary", {})).ok, true);
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  // Also drain the one-shot injection if a preceding assertion failed early.
  for (let retry = 0; retry < 2; retry++) {
    try {
      await call("close_binary", {});
    } catch {}
  }
  await client.close();
  await transport.close();
  await root.close();
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(output, JSON.stringify({ calls, failures, lifecycle }), {
  flag: "wx",
});
console.log(JSON.stringify({ output, calls: calls.length, failures }));
if (failures.length) process.exitCode = 1;
