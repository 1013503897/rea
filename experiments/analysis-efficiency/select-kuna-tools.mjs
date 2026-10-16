// Generate a complete declared-native baseline; do not infer tools from ordering.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { KUNA_OPERATIONS } from "../../dist/kuna/KunaProviderCapabilities.js";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [output] = process.argv.slice(2);
assert.ok(output, "Usage: node select-kuna-tools.mjs NEW_OUTPUT_JSON");
assert.equal(process.versions.node, (await readFile(".nvmrc", "utf8")).trim());
const desired = new Set([
  ...KUNA_OPERATIONS,
  "open_binary",
  "close_binary",
  "inspect_analysis_view",
]);
const run = createVerifierRun(),
  failures = [];
const client = new Client({
  name: "rea-kuna-baseline-catalog",
  version: "0.1.0",
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("scripts/rea.mjs"), "mcp"],
  env: {
    ...process.env,
    // This pass needs tool identities, not large result schemas. Keep any
    // explicit caller profile; the measured runner already selects off.
    REA_MCP_OUTPUT_SCHEMA_PROFILE:
      process.env.REA_MCP_OUTPUT_SCHEMA_PROFILE ?? "off",
  },
  stderr: "pipe",
});
let names;
try {
  await client.connect(transport);
  names = [];
  const cursors = new Set();
  let cursor;
  do {
    assert.ok(!cursors.has(cursor), "Catalog pagination did not advance");
    cursors.add(cursor);
    const page = await client.listTools(cursor === undefined ? {} : { cursor });
    names.push(
      ...page.tools
        .filter((tool) => desired.has(tool.name))
        .map((tool) => tool.name),
    );
    cursor = page.nextCursor;
  } while (cursor !== undefined);
  assert.equal(
    new Set(names).size,
    names.length,
    "Ambiguous duplicate catalog names",
  );
  assert.deepEqual(
    [...desired].filter((name) => !names.includes(name)),
    [],
    "Declared native operation lacks a named MCP tool",
  );
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  await client.close();
  await transport.close();
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
assert.deepEqual(failures, []);
// Caller-selected artifact only; never replace an existing configuration/record.
await writeFile(output, JSON.stringify(names, null, 2) + "\n", { flag: "wx" });
console.log(
  JSON.stringify({
    provider: "kuna",
    selection: "complete declared native operations plus session/views",
    names,
    lifecycle,
    scope:
      "Actual registered catalog matched by name to the compiled provider capability owner. No target opened; declared coverage does not prove live provider availability.",
  }),
);
