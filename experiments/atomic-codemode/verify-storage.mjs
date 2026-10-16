// Real public MCP catalog reads, retained-source fidelity and cold/warm receipts.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output] = process.argv.slice(2);
assert.ok(binary && output, "Usage: verify-storage.mjs BINARY OUTPUT");
const run = createVerifierRun(),
  calls = [],
  phases = [],
  failures = [];
const client = new Client({ name: "rea-storage-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
let stderr = "";
transport.stderr?.on("data", (chunk) => {
  stderr = (stderr + chunk.toString()).slice(-8192);
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
  const result =
    process.env.REA_ATOMIC_ADAPTER === "direct"
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
  const value = await work(),
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
  return value;
};
let report;
try {
  await client.connect(transport);
  const opened = await call("open_binary", { path: binary });
  const first = await measure("first-spaces-capture", () =>
    read("spaces", {
      indices: [3, 4, 8],
      fields: [
        "kind",
        "endianness",
        "address_size_bytes",
        "addressable_unit_bytes",
      ],
    }),
  );
  const repeat = await measure("warm-spaces", () =>
    read("spaces", {
      indices: [3, 4, 8],
      fields: [
        "kind",
        "endianness",
        "address_size_bytes",
        "addressable_unit_bytes",
      ],
    }),
  );
  assert.deepEqual(repeat, first);
  const selected = await measure("warm-register-batch", () =>
    read("registers", {
      locations: [
        { space: "register", offset: "0x8", size_bytes: 2 },
        { space: "register", offset: "0x8", size_bytes: 4 },
        { space: "register", offset: "0x8", size_bytes: 8 },
        { space: "register", offset: "0x38", size_bytes: 8 },
        { space: "register", offset: "0xb8", size_bytes: 8 },
        { space: "register", offset: "0x88", size_bytes: 4 },
        { space: "register", offset: "0x8", size_bytes: 3 },
        { space: "stack", offset: "0x8", size_bytes: 8 },
      ],
      fields: ["name"],
    }),
  );
  assert.equal(selected.source.evidence_id, first.source.evidence_id);
  if (first.architecture.native_id === "x86:LE:64:default:gcc") {
    assert.deepEqual(
      selected.items.map((r) => r.name),
      ["CX", "ECX", "RCX", "RDI", "R15", "R9D"],
    );
    assert.equal(selected.unretained_locations.length, 2);
    assert.deepEqual(
      first.items.map((r) => r.name),
      ["ram", "register", "stack"],
    );
  }
  if (first.architecture.native_id === "AARCH64:LE:64:v8A:default") {
    const named = await read("registers", {
      names: ["x0", "w0"],
      fields: ["name"],
    });
    assert.deepEqual(
      named.items.map(({ space, offset, size_bytes, name }) => ({
        space,
        offset,
        size_bytes,
        name,
      })),
      [
        { space: "register", offset: "0x4000", size_bytes: 8, name: "x0" },
        { space: "register", offset: "0x4000", size_bytes: 4, name: "w0" },
      ],
    );
    assert.equal(named.source.evidence_id, first.source.evidence_id);
  }
  for (const name of ["spaces", "registers"]) {
    const empty = await read(name, { names: [] });
    assert.equal(empty.total, 0);
    assert.deepEqual(empty.items, []);
  }
  let text = "",
    offset = 0;
  do {
    const page = await read("evidence", {
      evidence_id: first.source.evidence_id,
      offset,
      limit: 16384,
    });
    text += page.text;
    offset = page.next_offset;
  } while (offset !== null);
  assert.equal(
    createHash("sha256").update(text).digest("hex"),
    first.source.sha256,
  );
  const raw = JSON.parse(text);
  assert.equal(raw.register_count, first.totals.registers);
  assert.equal(raw.space_index_capacity, first.totals.space_index_capacity);
  assert.equal(raw.coverage.functions_decompiled, 0);
  assert.equal(raw.coverage.listing_discovery, false);
  for (const name of ["spaces", "registers"]) {
    const rows = [];
    offset = 0;
    do {
      const page = await read(name, { offset, limit: 128 });
      assert.equal(page.source.evidence_id, first.source.evidence_id);
      rows.push(...page.items);
      offset = page.next_offset;
    } while (offset !== null);
    assert.deepEqual(rows, raw[name]);
  }
  report = {
    context: opened.context,
    source: first.source,
    architecture: first.architecture,
    totals: first.totals,
    phases,
    selected,
    all_rows_match_retained_source: true,
    source_digest_verified: true,
    scope:
      "Native canonical exact-name map only; no model, runtime or alias-completeness claim.",
  };
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
  JSON.stringify({ ...report, calls, failures, lifecycle, stderr }),
  { flag: "wx" },
);
if (failures.length) process.exitCode = 1;
console.log(JSON.stringify({ output, ...report }));
