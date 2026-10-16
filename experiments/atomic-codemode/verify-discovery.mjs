// Verify actual SDK-converted catalogs and named help without target analysis.
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

const [output] = process.argv.slice(2);
const run = createVerifierRun(),
  results = [],
  failures = [];
for (const direct of [false, true]) {
  const client = new Client({
    name: "rea-discovery-verifier",
    version: "0.1.0",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("experiments/atomic-codemode/server.mjs")],
    env: { ...process.env, REA_ATOMIC_ADAPTER: direct ? "direct" : "codemode" },
    stderr: "pipe",
  });
  const call = async (query, view = "contracts") => {
    const reply = await client.callTool({
      name: "reference",
      arguments: { query, view },
    });
    return JSON.parse(reply.content[0].text);
  };
  try {
    await client.connect(transport);
    const catalog = await client.listTools();
    const prefix = direct ? "facts_" : "rea.";
    const ids = [
      "snapshot",
      "operations",
      "relations",
      "values",
      "instructions",
      "bytes",
      "evidence",
    ];
    const selected = await call(ids.map((name) => prefix + name).join(" "));
    assert.deepEqual(
      selected.methods.map((m) => m.method),
      ids,
    );
    assert.deepEqual(selected.unmatched_queries, []);
    assert.equal(selected.coverage.declared_methods, 14);
    const ajv = new Ajv2020({ strict: false });
    for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
    for (const method of selected.methods) {
      ajv.compile(method.input_schema);
      assert.equal(method.name, prefix + method.method);
      if (direct)
        assert.ok(catalog.tools.some((tool) => tool.name === method.name));
    }
    for (const [name, good, bad] of [
      ["snapshot", { entry: "0xea6d0" }, { snapshot: "snap_other" }],
      ["values", { snapshot: "snap_other", ids: ["v1"] }, { entry: "0xea6d0" }],
      [
        "relations",
        {
          snapshot: "snap_other",
          kind: "operands",
          seeds: ["0x1:0"],
          input_indices: [0, 155],
        },
        {
          snapshot: "snap_other",
          kind: "uses",
          seeds: ["0x1:0"],
          input_indices: [0],
        },
      ],
      [
        "evidence",
        { evidence_id: "ev_example", component: "recovered_ir" },
        { evidence_id: "ev_example", component: "unknown" },
      ],
    ]) {
      const method = selected.methods.find((m) => m.method === name);
      const validators = [ajv.compile(method.input_schema)];
      if (direct)
        validators.push(
          ajv.compile(
            catalog.tools.find((t) => t.name === method.name).inputSchema,
          ),
        );
      for (const validate of validators) {
        assert.equal(validate(good), true);
        assert.equal(validate(bad), false);
      }
    }
    const missing = await call(`${prefix}values unknown`);
    assert.deepEqual(
      missing.methods.map((m) => m.method),
      ["values"],
    );
    assert.deepEqual(missing.unmatched_queries, ["unknown"]);
    const all = await call("");
    assert.equal(all.methods.length, 14);
    for (const method of all.methods) ajv.compile(method.input_schema);
    const index = await call("", "index");
    assert.equal(index.coverage.view, "index");
    assert.deepEqual(
      index.methods.map((m) => m.method),
      all.methods.map((m) => m.method),
    );
    assert.ok(
      index.methods.every(
        (m) =>
          !Object.hasOwn(m, "input_schema") && !Object.hasOwn(m, "returns"),
      ),
    );
    assert.deepEqual(
      index.methods.map((m) => ({
        method: m.method,
        name: m.name,
        description: m.description,
      })),
      all.methods.map((m) => ({
        method: m.method,
        name: m.name,
        description: m.description,
      })),
    );
    assert.ok(
      Buffer.byteLength(JSON.stringify(index)) <
        Buffer.byteLength(JSON.stringify(all)),
    );
    assert.ok(JSON.stringify(selected).length < JSON.stringify(all).length);
    results.push({
      direct,
      selected,
      all_reference_bytes: Buffer.byteLength(JSON.stringify(all)),
      index_bytes: Buffer.byteLength(JSON.stringify(index)),
      selected_reference_bytes: Buffer.byteLength(JSON.stringify(selected)),
      actual_catalog_and_named_schema_checks_passed: true,
    });
  } catch (error) {
    failures.push(error.stack ?? String(error));
  } finally {
    await client.close();
    await transport.close();
  }
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({
    results,
    failures,
    lifecycle,
    scope:
      "Static contract/catalog checks; no native target analysis or model cost measurement",
  }),
  { flag: "wx" },
);
console.log(JSON.stringify({ output, lanes: results.length, failures }));
if (failures.length) process.exitCode = 1;
