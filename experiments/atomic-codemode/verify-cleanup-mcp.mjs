// Real public MCP lifecycle, with explicitly injected cleanup failures.
import assert from "node:assert/strict";
import { readFile, readlink, writeFile } from "node:fs/promises";
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

const [binary, output, scenario = "native-close"] = process.argv.slice(2);
assert.ok(
  binary && output,
  "Usage: verify-cleanup-mcp.mjs BINARY OUTPUT [native-close|installation-close]",
);
assert.ok(["native-close", "installation-close"].includes(scenario));
const run = createVerifierRun(),
  calls = [],
  failures = [],
  root = await PrivateRuntimeRoot.create({
    prefix: "rea-cleanup-mcp-verifier-",
  });
const url = (path) => JSON.stringify(pathToFileURL(resolve(path)).href);
const bootstrap = join(root.path, "injected-cleanup.mjs");
const audit = join(root.path, "injected-descriptor.json");
await writeFile(
  bootstrap,
  scenario === "native-close"
    ? `import {KunaTargetCommands} from ${url("dist/kuna/KunaTargetCommands.js")};
import {ProviderCleanupError} from ${url("dist/domain/providerCleanupError.js")};
import {err} from ${url("dist/domain/result.js")};
const close=KunaTargetCommands.prototype.close;let injected=false;
KunaTargetCommands.prototype.close=async function(){
 if(!injected){injected=true;return err(new ProviderCleanupError("kuna",["verifier-injected-cleanup-resource"],{reason:"Explicit verifier fault; not a real engine cleanup failure"}));}
 return close.call(this);
};`
    : `import {OwnedFileHandle} from ${url("dist/filesystem/OwnedFileHandle.js")};
import {readlink,realpath,writeFile} from "node:fs/promises";
const engine=await realpath(process.env.REA_KUNA_COMMAND);
const close=OwnedFileHandle.prototype.close;let selected,failures=0;
OwnedFileHandle.prototype.close=async function(){
 if(selected===undefined && await readlink("/proc/self/fd/"+this.handle.fd).catch(()=>null)===engine){
  selected=this;
  await writeFile(${JSON.stringify(audit)},JSON.stringify({descriptor:"/proc/"+process.pid+"/fd/"+this.handle.fd,engine}),{flag:"wx"});
 }
 if(this===selected && failures++<2)throw new Error("Verifier-injected engine descriptor close failure; not an observed OS failure");
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
  if (scenario === "installation-close") {
    assert.equal(process.platform, "linux", "Descriptor probe requires procfs");
    const failed = await call("open_binary", { path: binary });
    assert.equal(failed.ok, false);
    assert.equal(failed.context, null);
    assert.equal(failed.error.code, "cleanup_incomplete");
    const descriptor = JSON.parse(await readFile(audit, "utf8"));
    assert.deepEqual(failed.error.details.failure.details.resources, [
      descriptor.engine,
    ]);
    assert.equal(await readlink(descriptor.descriptor), descriptor.engine);
    const blocked = await call("open_binary", { path: binary });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.context, null);
    assert.equal(blocked.error.code, "cleanup_incomplete");
    assert.deepEqual(blocked.error.details.resources, [descriptor.engine]);
    assert.equal(await readlink(descriptor.descriptor), descriptor.engine);
    assert.equal((await call("close_binary", {})).ok, true);
    await assert.rejects(readlink(descriptor.descriptor), { code: "ENOENT" });
  }
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
  if (scenario === "native-close") {
    const failed = await call("close_binary", {});
    assert.equal(failed.ok, false);
    assert.equal(failed.context.lease, opened.context.lease);
    assert.equal(failed.error.code, "cleanup_incomplete");
    assert.deepEqual(failed.error.details.failure.details.resources, [
      "verifier-injected-cleanup-resource",
    ]);
  }
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
await writeFile(
  output,
  JSON.stringify({ scenario, calls, failures, lifecycle }),
  {
    flag: "wx",
  },
);
console.log(JSON.stringify({ output, calls: calls.length, failures }));
if (failures.length) process.exitCode = 1;
