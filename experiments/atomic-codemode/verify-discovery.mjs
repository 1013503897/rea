// Verify actual SDK-converted catalogs and named help without target analysis.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import Ajv2020 from "ajv/dist/2020.js";
import { EXECUTION_LIMITS, MAX_MCP_RESULT_BYTES } from "./limits.mjs";
import { methods } from "./api.mjs";
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
    assert.deepEqual(
      catalog.tools.map((tool) => tool.name).sort(),
      [
        "open_binary",
        "close_binary",
        "reference",
        ...(direct
          ? Object.keys(methods).map((name) => `facts_${name}`)
          : ["execute_javascript"]),
      ].sort(),
    );
    const prefix = direct ? "facts_" : "rea.";
    const ids = [
      "strings",
      "references",
      "spaces",
      "registers",
      "switches",
      "path",
      "parameters",
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
    assert.equal(selected.coverage.declared_methods, 19);
    assert.deepEqual(selected.transport_limits, {
      mcp_result_utf8_bytes: MAX_MCP_RESULT_BYTES,
    });
    const ajv = new Ajv2020({ strict: false });
    for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
    assert.equal(Object.hasOwn(selected, "limits"), !direct);
    if (!direct) {
      assert.deepEqual(selected.limits, EXECUTION_LIMITS);
      const execution = catalog.tools.find(
        (tool) => tool.name === "execute_javascript",
      );
      const timeout = execution.inputSchema.properties.timeout_ms;
      assert.deepEqual(
        {
          minimum: timeout.minimum,
          maximum: timeout.maximum,
          default: timeout.default,
        },
        EXECUTION_LIMITS.timeout_ms,
      );
      assert.ok(
        execution.description.includes(
          `${timeout.default} ms wall deadline (also the maximum)`,
        ),
      );
      const validate = ajv.compile(execution.inputSchema);
      assert.equal(validate({ code: "return 7" }), true);
      assert.equal(validate({ code: "return 7", timeout_ms: 200000 }), false);
      const rejected = await client.callTool({
        name: "execute_javascript",
        arguments: { code: "return 7", timeout_ms: 200000 },
      });
      assert.equal(rejected.isError, true);
      const resumed = await client.callTool({
        name: "execute_javascript",
        arguments: { code: "return 7" },
      });
      const value = JSON.parse(resumed.content[0].text);
      assert.equal(value.ok, true);
      assert.equal(value.value, 7);
      assert.equal(value.execution.host_calls, 0);
      assert.deepEqual(value.evidence_ids, []);
    }
    for (const method of selected.methods) {
      ajv.compile(method.input_schema);
      assert.equal(method.name, prefix + method.method);
      if (direct)
        assert.ok(catalog.tools.some((tool) => tool.name === method.name));
    }
    for (const [name, good, bad] of [
      [
        "references",
        { addresses: ["0x1"], direction: "outgoing", scope: "function" },
        { addresses: ["0x1"], direction: "incoming", scope: "function" },
      ],
      [
        "references",
        { addresses: ["0x1"] },
        {
          addresses: ["0x1"],
          ranges: [{ start: "0x0", end_inclusive: "0x1" }],
        },
      ],
      [
        "references",
        {
          ranges: [{ start: "0x0", end_inclusive: "0xffffffffffffffff" }],
          fields: [],
        },
        {
          ranges: [{ start: "0x0", end_inclusive: "0x1" }],
          direction: "outgoing",
        },
      ],
      [
        "strings",
        { query: "fixture", fields: [] },
        { query: "fixture", fields: ["whole"] },
      ],
      ["spaces", { indices: [3], fields: ["kind"] }, { indices: ["3"] }],
      [
        "registers",
        {
          locations: [{ space: "register", offset: "0x8", size_bytes: 2 }],
          fields: ["name"],
        },
        { locations: [{ space: null, offset: "0x8", size_bytes: 2 }] },
      ],
      ["snapshot", { entry: "0xea6d0" }, { snapshot: "snap_other" }],
      [
        "switches",
        {
          snapshot: "snap_other",
          origin_addresses: ["0xea801"],
          fields: ["selector", "table"],
        },
        { snapshot: "snap_other", fields: ["rows"] },
      ],
      ["values", { snapshot: "snap_other", ids: ["v1"] }, { entry: "0xea6d0" }],
      [
        "values",
        {
          snapshot: "snap_other",
          locations: [{ space: "ram", offset: "0x1144c8", size_bytes: 4 }],
          fields: [],
        },
        {
          snapshot: "snap_other",
          locations: [{ space: null, offset: "0x1144c8", size_bytes: 4 }],
        },
      ],
      [
        "relations",
        { snapshot: "snap_other", kind: "value_uses", seeds: ["v1"] },
        { snapshot: "snap_other", kind: "value_uses", seeds: [1] },
      ],
      [
        "relations",
        {
          snapshot: "snap_other",
          kind: "cases",
          seeds: ["0xea801:fe"],
          case_values: ["0xb5"],
          case_indices: [181],
        },
        { snapshot: "snap_other", kind: "cases", seeds: [8] },
      ],
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
        "parameters",
        {
          snapshot: "snap_other",
          indices: [0, 1],
          fields: ["storage", "is_void"],
        },
        { snapshot: "snap_other", indices: ["0"] },
      ],
      [
        "evidence",
        { evidence_id: "ev_example", component: "recovered_ir" },
        { evidence_id: "ev_example", component: "unknown" },
      ],
      [
        "path",
        {
          snapshot: "snap_other",
          from: 0,
          target: { kind: "exit" },
          avoid: [1],
          limit: 1,
        },
        { snapshot: "snap_other", from: "0", target: { kind: "exit" } },
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
    assert.equal(all.methods.length, 19);
    for (const method of all.methods) {
      ajv.compile(method.input_schema);
      assert.equal(method.description, methods[method.method].description);
      assert.equal(methods[method.method].method, method.method);
    }
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
        description: methods[m.method].summary,
      })),
    );
    assert.ok(
      Buffer.byteLength(JSON.stringify(index)) <
        Buffer.byteLength(JSON.stringify(all)),
    );
    assert.ok(JSON.stringify(selected).length < JSON.stringify(all).length);
    results.push({
      direct,
      catalog_tools: catalog.tools.map((tool) => tool.name),
      selected,
      all_reference_bytes: Buffer.byteLength(JSON.stringify(all)),
      index_bytes: Buffer.byteLength(JSON.stringify(index)),
      selected_reference_bytes: Buffer.byteLength(JSON.stringify(selected)),
      actual_catalog_and_named_schema_checks_passed: true,
      execution_policy_and_rejection_recovery_checked: !direct,
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
