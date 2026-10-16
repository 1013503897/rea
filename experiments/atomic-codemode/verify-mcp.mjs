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
const client = new Client({ name: "rea-codemode-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
let stderr = "";
transport.stderr?.on("data", (part) => {
  stderr = (stderr + part).slice(-8192);
});
const calls = [];
const call = async (name, arguments_ = {}) => {
  const response = await client.callTool(
    { name, arguments: arguments_ },
    { timeout: 180000 },
  );
  assert.equal(response._meta?.provenance?.untrusted_content, true);
  const value = JSON.parse(response.content[0].text);
  calls.push({ name, arguments: arguments_, response: value });
  assert.equal(value.ok ?? true, true, JSON.stringify(value));
  return value;
};
let failure;
try {
  await client.connect(transport);
  const catalog = await client.listTools();
  assert.deepEqual(catalog.tools.map((tool) => tool.name).sort(), [
    "close_binary",
    "execute_javascript",
    "open_binary",
    "reference",
  ]);
  const ajv = new Ajv2020({ strict: false });
  for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
  await call("open_binary", { path: binary });
  await call("reference", { query: "relations" });
  const result = await call("execute_javascript", {
    code: `
const found=await rea.strings({query:"incorrect header check",limit:1});
if(!found.ok) throw new Error(JSON.stringify(found));
const literal=found.data.items[0].address;
const refs=await rea.references({addresses:[literal]});
const entry=refs.data.results[0].items[0].fromFunction.address;
const snap=await rea.snapshot({entry}); if(!snap.ok)throw new Error(JSON.stringify(snap));
const s=snap.data.snapshot;
const seed=await rea.operations({snapshot:s,constant:literal});
const uses=await rea.relations({snapshot:s,kind:"uses",seeds:seed.data.items.map(x=>x.id)});
const consumers=await rea.operations({snapshot:s,ids:uses.data.items.map(x=>x.use)});
const incoming=await rea.relations({snapshot:s,kind:"incoming",seeds:consumers.data.items.map(x=>x.block)});
const slice=await rea.slice({snapshot:s,seeds:incoming.data.items.map(x=>x.operation).filter(Boolean)});
return {literal,entry,snapshot:s,selected:slice.data.operations.length,guards:slice.data.operations.map(x=>x.statement),coverage:slice.data.coverage,evidence_id:slice.data.evidence_id};`,
  });
  assert.equal(result.value.selected, 19);
  assert.equal(result.value.coverage.status, "partial");
  assert.ok(result.value.guards.some((s) => s.includes("/ #0x1f")));
  await call("close_binary");
} catch (error) {
  failure = error.stack ?? String(error);
} finally {
  await client.close();
  await transport.close();
}
const lifecycle = await completeVerifierRun(verifier);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({ calls, failure, stderr, lifecycle }, null, 2),
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    output,
    calls: calls.length,
    failure,
    cleanup_verified: true,
  }),
);
if (failure) process.exitCode = 1;
