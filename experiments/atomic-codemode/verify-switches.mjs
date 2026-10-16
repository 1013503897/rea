// Real MCP switch facts against an independent ELF table/guard oracle.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import Ajv2020 from "ajv/dist/2020.js";
import { familyCounters } from "./family-counters.mjs";
import { readNativeGraphEvidence } from "./native-ir-contract.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output, oraclePath, goldenPath] = process.argv.slice(2);
assert.equal(process.versions.node, (await readFile(".nvmrc", "utf8")).trim());
const oracle = JSON.parse(await readFile(oraclePath, "utf8")),
  golden = JSON.parse(await readFile(goldenPath, "utf8")).functions[0];
const run = createVerifierRun(),
  calls = [],
  failures = [],
  phases = [];
const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
const client = new Client({ name: "rea-switch-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
async function call(name, input) {
  const result = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  const value = JSON.parse(result.content[0].text);
  calls.push({
    name,
    input,
    value,
    content_bytes: Buffer.byteLength(result.content[0].text),
  });
  assert.equal(value.ok, true, JSON.stringify(value));
  return value;
}
async function read(name, input) {
  const result = direct
    ? await call(`facts_${name}`, input)
    : (
        await call("execute_javascript", {
          code: `return await rea.${name}(${JSON.stringify(input)});`,
        })
      ).value;
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.data;
}
async function measure(phase, work) {
  const before = await familyCounters(),
    started = performance.now(),
    value = await work();
  const elapsed_ms = performance.now() - started,
    after = await familyCounters();
  phases.push({
    phase,
    elapsed_ms,
    family_cpu_seconds: (after.cpu - before.cpu) / 1e6,
    cumulative_family_memory_peak_bytes: after.peak,
  });
  return value;
}
let comparison;
try {
  await client.connect(transport);
  const catalog = await client.listTools(),
    ajv = new Ajv2020({ strict: false });
  for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
  const opened = await call("open_binary", { path: binary });
  assert.equal(opened.context.artifact_sha256, oracle.sha256);
  const capture = await measure("fresh-snapshot", () =>
    read("snapshot", { entry: "0xea6d0" }),
  );
  assert.equal(capture.facets.recovered_ir.availability, "available");
  assert.equal(
    capture.facets.switches.availability,
    "available",
    JSON.stringify(capture.facets.switches),
  );
  const snapshot = capture.snapshot,
    listed = await read("switches", { snapshot });
  assert.equal(listed.total, 1);
  const sw = listed.items[0];
  assert.equal(sw.id, "0xea801:fe");
  assert.equal(sw.block, 8);
  assert.equal(sw.selector.size_bytes, 8);
  assert.equal(sw.selector.definition, "0xea7f6:c353");
  assert.ok(sw.table && !("rows" in sw.table));
  const all = [];
  let offset = 0;
  do {
    const page = await read("relations", {
      snapshot,
      kind: "cases",
      seeds: [sw.id],
      offset,
      limit: 64,
    });
    all.push(...page.items);
    assert.ok(page.next_offset === null || page.next_offset > offset);
    offset = page.next_offset;
  } while (offset !== null);
  assert.equal(all.length, sw.table.relation_count);
  assert.equal(new Set(all.map((r) => r.id)).size, all.length);
  assert.equal(new Set(all.map((r) => r.case_id)).size, sw.table.case_count);
  const machine = new Map(oracle.rows.map((r) => [r.case_value, r])),
    verified = new Set(),
    outside = [];
  for (const row of all) {
    if (row.label?.status !== "value") continue;
    const expected = machine.get(row.label.raw_bits);
    if (!expected) {
      outside.push(row);
      continue;
    }
    assert.equal(row.recovered_target?.space, "ram");
    assert.equal(
      row.recovered_target?.offset,
      expected.machine_target,
      JSON.stringify(row),
    );
    verified.add(row.label.raw_bits);
  }
  comparison = {
    native_table: sw.table,
    verified_machine_labels: verified.size,
    missing_machine_labels: [...machine.keys()].filter((v) => !verified.has(v)),
    outside_table_labels: outside,
  };
  assert.deepEqual(comparison.missing_machine_labels, []);
  const chosen = ["0x0", "0x1", "0x2a", "0xb5"],
    selected = await read("relations", {
      snapshot,
      kind: "cases",
      seeds: [sw.id, sw.id],
      case_values: chosen,
      limit: 64,
    });
  assert.equal(selected.next_offset, null);
  assert.deepEqual(
    selected.items,
    all.filter(
      (r) => r.label?.status === "value" && chosen.includes(r.label.raw_bits),
    ),
  );
  const byIndex = await read("relations", {
    snapshot,
    kind: "cases",
    seeds: [sw.id],
    case_indices: [0, 181, 182, 0],
    limit: 64,
  });
  assert.deepEqual(
    byIndex.items,
    all.filter((r) => [0, 181, 182].includes(r.case_index)),
  );
  const projected = await read("switches", {
    snapshot,
    ids: [sw.id],
    fields: ["table"],
  });
  assert.equal(projected.items[0].selector, undefined);
  const bytes = await read("bytes", {
    windows: [
      { address: oracle.machine_table_base, length: oracle.rows.length * 4 },
    ],
  });
  assert.equal(bytes.results[0].ok, true);
  assert.equal(bytes.results[0].hex, oracle.rows.map((r) => r.bytes).join(""));
  const instructions = await read("instructions", {
    windows: [{ address: "0xea7e1", count: 8 }],
    fields: ["bytes", "text"],
  });
  assert.ok(
    instructions.results[0].items.some(
      (r) => r.address === "0xea801" && r.bytes === "ffe0",
    ),
  );
  await measure("same-lease-reuse", async () => {
    const repeat = await read("snapshot", { entry: "0xea6d0" });
    assert.equal(repeat.snapshot, snapshot);
    assert.deepEqual(
      await read("relations", {
        snapshot,
        kind: "cases",
        seeds: [sw.id],
        case_values: chosen,
        limit: 64,
      }),
      selected,
    );
  });
  const source = await readFile(
    join(
      process.env.REA_ATOMIC_EVIDENCE_DIR,
      `${capture.source.evidence_id}.txt`,
    ),
    "utf8",
  );
  const {
    atomic_facts: _graph,
    atomic_switches: _switches,
    ...ordinary
  } = JSON.parse(source).functions[0];
  const { atomic_facts: expectedGraph, ...expectedOrdinary } = golden;
  assert.deepEqual(
    JSON.parse(readNativeGraphEvidence(source).text),
    expectedGraph,
  );
  assert.deepEqual(ordinary, expectedOrdinary);
  comparison.graph_and_ordinary_fields_match_golden = true;
  await call("close_binary", {});
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  try {
    await client.close();
  } catch (error) {
    failures.push(String(error));
  }
  try {
    await transport.close();
  } catch (error) {
    failures.push(String(error));
  }
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({ direct, calls, comparison, phases, failures, lifecycle }),
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    output,
    direct,
    calls: calls.length,
    comparison,
    phases,
    failures,
  }),
);
if (failures.length) process.exitCode = 1;
