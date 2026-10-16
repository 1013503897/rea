// Real public boundary facts; the complete old record remains a fidelity oracle.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [output] = process.argv.slice(2);
assert.ok(output && process.env.REA_ATOMIC_EVIDENCE_DIR);
const cases = [
  [
    "0x25cb0",
    "ev_36a9ed8af203f2f64ca1a60d51b791f3c52e81fc1aa0e895aa183d99fd3ceba9",
  ],
  [
    "0x280c0",
    "ev_007ef9474700eff262536cfc0ff6e0187afaf50990888cc446bc78fa58538f65",
  ],
];
const fields = [
  "name",
  "type_name",
  "storage",
  "size_bytes",
  "is_void",
  "type_locked",
  "name_locked",
  "size_locked",
  "this_pointer",
  "indirect_storage",
  "hidden_return",
];
const run = createVerifierRun(),
  calls = [],
  phases = [],
  reviews = [],
  failures = [];
const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
const client = new Client({ name: "rea-parameter-verifier", version: "0.1.0" });
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
  const result = JSON.parse(reply.content[0].text);
  calls.push({
    name,
    input,
    result,
    response_bytes: Buffer.byteLength(reply.content[0].text),
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
};
const read = async (name, input) => {
  const result = direct
    ? await call(`facts_${name}`, input)
    : (
        await call("execute_javascript", {
          code: `return await rea.${name}(${JSON.stringify(input)});`,
        })
      ).value;
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.data;
};
const measure = async (phase, work) => {
  const before = await familyCounters(),
    start = performance.now(),
    first = calls.length;
  const result = await work(),
    after = await familyCounters();
  phases.push({
    phase,
    elapsed_ms: performance.now() - start,
    family_cpu_seconds: (after.cpu - before.cpu) / 1e6,
    cumulative_family_memory_peak_bytes: after.peak,
    mcp_calls: calls.length - first,
    response_bytes: calls
      .slice(first)
      .reduce((sum, c) => sum + c.response_bytes, 0),
  });
  return result;
};
try {
  await client.connect(transport);
  await call("open_binary", { path: "/usr/bin/ssh" });
  for (const [entry, prior] of cases) {
    const capture = await measure(`capture:${entry}`, () =>
      read("snapshot", { entry }),
    );
    assert.equal(
      capture.facets.parameters.availability,
      "available",
      JSON.stringify(capture),
    );
    const snapshot = capture.snapshot;
    const full = await measure(`parameters-first:${entry}`, () =>
      read("parameters", { snapshot, fields, limit: 128 }),
    );
    const repeat = await measure(`parameters-repeat:${entry}`, () =>
      read("parameters", { snapshot, fields, limit: 128 }),
    );
    assert.deepEqual(repeat, full);
    assert.equal(full.next_offset, null);
    assert.equal(full.items.length, capture.facets.parameters.count);
    assert.equal(full.coverage.source_signature, "unknown");
    const original = JSON.parse(
      await readFile(
        join(
          process.env.REA_ATOMIC_EVIDENCE_DIR,
          `${capture.source.evidence_id}.txt`,
        ),
        "utf8",
      ),
    ).functions[0];
    const { atomic_parameters: raw, ...ordinary } = original;
    const golden = JSON.parse(
      await readFile(
        resolve(".cache/atomic-codemode/ssh-guard-v1-evidence", `${prior}.txt`),
        "utf8",
      ),
    ).functions[0];
    assert.deepEqual(ordinary, golden);
    assert.deepEqual(full.items, raw.items);
    assert.deepEqual(full.output, raw.output);
    const {
      schema_version: _version,
      items: _items,
      output: _output,
      ...prototype
    } = raw;
    assert.deepEqual(full.prototype, prototype);
    const selected = await read("parameters", {
      snapshot,
      indices: [raw.items.length - 1, 0, 0, raw.items.length + 1],
      fields: [],
      limit: 1,
    });
    assert.equal(selected.total, Math.min(raw.items.length, 2));
    assert.deepEqual(selected.missing_indices, [raw.items.length + 1]);
    assert.deepEqual(selected.output, { id: "return", native_index: null });
    const empty = await read("parameters", {
      snapshot,
      indices: [],
      fields: ["storage", "is_void"],
    });
    assert.deepEqual(empty.items, []);
    const rawInputs = await read("values", {
      snapshot,
      is_input: true,
      limit: 1,
    });
    const locations = raw.items.flatMap((p) => (p.storage ? [p.storage] : []));
    const matches = await read("values", {
      snapshot,
      is_input: true,
      locations,
      limit: 128,
    });
    reviews.push({
      entry,
      source: capture.source,
      prototype: full.prototype,
      items: full.items,
      output: full.output,
      raw_input_value_count: rawInputs.total,
      formal_storage_input_matches: matches.items,
      unretained_formal_locations: matches.unretained_locations,
      complete_previous_function_equal_except_added_parameters: true,
    });
  }
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
    phases,
    calls,
    reviews,
    failures,
    lifecycle,
    scope:
      "Actual SDK MCP and complete retained native fidelity; recovered prototypes are not source signatures or ABI/runtime proof. No model cost claim.",
  }),
  { flag: "wx" },
);
console.log(JSON.stringify({ output, direct, phases, reviews, failures }));
if (failures.length) process.exitCode = 1;
