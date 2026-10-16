// Real public MCP checks for both calling adapters and the stock/patched CLI.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
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
const client = new Client({ name: "rea-byte-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
const calls = [],
  failures = [];
const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
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
const read = async (windows) => {
  const result = direct
    ? await call("facts_bytes", { windows })
    : await call("execute_javascript", {
        code: `const r=await rea.bytes({windows:${JSON.stringify(windows)}});if(!r.ok)throw new Error(JSON.stringify(r));return r.data;`,
      });
  return direct ? result.data : result.value;
};
try {
  await client.connect(transport);
  const catalog = await client.listTools();
  const byName = new Map(catalog.tools.map((tool) => [tool.name, tool]));
  assert.ok(byName.has(direct ? "facts_bytes" : "execute_javascript"));
  assert.equal(byName.has("execute_javascript"), !direct);
  const ajv = new Ajv2020({ strict: false });
  for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
  const opened = await call("open_binary", { path: binary });
  assert.equal(
    opened.context.artifact_sha256,
    "2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8",
  );
  const mixed = await read([
    { address: "0x129238", length: 53 },
    { address: "0x154bf8", length: 16 },
    { address: "0xdeadbeef", length: 1 },
  ]);
  assert.equal(
    mixed.results[0].hex,
    Buffer.from(
      "Safety level may not be changed inside a transaction\0",
    ).toString("hex"),
  );
  assert.equal(
    mixed.results[0].coverage.status,
    "complete-for-requested-range",
  );
  assert.equal(mixed.results[0].coverage.original_file_mapping, "unknown");
  assert.equal(mixed.results[1].returned_bytes, 4);
  assert.equal(mixed.results[1].end_address, "0x154bfc");
  assert.equal(mixed.results[1].coverage.status, "partial");
  assert.ok(mixed.results[1].coverage.notes.length > 0);
  assert.equal(mixed.results[2].ok, false);
  const again = await read([{ address: "0x129238", length: 53 }]);
  assert.deepEqual(again.results[0], mixed.results[0]);
  let maximum;
  if (direct) {
    const result = await read([{ address: "0x120000", length: 65536 }]);
    maximum = result.results[0];
    assert.equal(maximum.hex.length, 131072);
    // The pinned ELF LOAD maps these VMAs to identical original file offsets.
    const artifact = await readFile(binary);
    assert.equal(
      maximum.hex,
      artifact.subarray(0x120000, 0x130000).toString("hex"),
    );
  } else {
    const result = await call("execute_javascript", {
      code: 'const r=await rea.bytes({windows:[{address:"0x120000",length:65536}]});if(!r.ok)throw new Error(JSON.stringify(r));const {hex,...facts}=r.data.results[0];return {...facts,hex_length:hex.length};',
    });
    maximum = result.value;
    assert.equal(maximum.hex_length, 131072);
  }
  assert.equal(maximum.returned_bytes, 65536);
  assert.equal(maximum.coverage.status, "complete-for-requested-range");
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
