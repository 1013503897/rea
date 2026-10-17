// Real Linux FFmpeg inventory beyond the buffered wire cap, through public adapters.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { AtomicSession } from "./session.mjs";
import { familyCounters } from "./family-counters.mjs";
import { MAX_MCP_RESULT_BYTES, NATIVE_OUTPUT_BYTES } from "./limits.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [target, output, adapter = "sdk"] = process.argv.slice(2);
assert(target && output && ["sdk", "direct", "codemode"].includes(adapter));
assert(process.env.REA_ATOMIC_EVIDENCE_DIR);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const bytes = await readFile(target),
  digest = sha(bytes);
assert.equal(
  digest,
  "28c258cc42cbaf9813bf91b41666d2b8063d10aa77aaaf424fac0079f6497b7e",
);
// File offsets and target coordinates independently checked against ELF PT_LOAD.
const cases = [
  {
    query: "Invalid extradata size: %d",
    address: "0xb52f2e",
    file_offset: 0xb52f2e,
  },
  {
    query: "Unsupported codec version!",
    address: "0xba3ed1",
    file_offset: 0xba3ed1,
  },
];
const run = createVerifierRun(),
  observations = [],
  phases = [],
  failures = [];
const session = adapter === "sdk" ? new AtomicSession() : null;
const client = session
  ? null
  : new Client({ name: "streamed-inventory-verifier", version: "0.1.0" });
const transport = session
  ? null
  : new StdioClientTransport({
      command: process.execPath,
      args: [resolve("experiments/atomic-codemode/server.mjs")],
      env: { ...process.env, REA_ATOMIC_ADAPTER: adapter },
      stderr: "pipe",
    });
const invoke = async (name, input) => {
  const reply = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  assert(!reply.isError);
  assert(Buffer.byteLength(JSON.stringify(reply)) <= MAX_MCP_RESULT_BYTES);
  return JSON.parse(reply.content[0].text);
};
const read = async (name, input) => {
  const wrapper = session
    ? await session.call(name, input)
    : adapter === "direct"
      ? await invoke("facts_" + name, input)
      : await invoke("execute_javascript", {
          code: `return await rea.${name}(${JSON.stringify(input)});`,
        });
  const response = session || adapter === "direct" ? wrapper : wrapper.value;
  assert(response);
  observations.push({
    name,
    input,
    response_bytes: Buffer.byteLength(JSON.stringify(response)),
    ok: response.ok,
    error: response.error ?? null,
  });
  return response;
};
const measure = async (name, work) => {
  const start = performance.now(),
    before = await familyCounters();
  const result = await work(),
    after = await familyCounters();
  phases.push({
    name,
    elapsed_ms: performance.now() - start,
    family_cpu_seconds: (after.cpu - before.cpu) / 1e6,
  });
  return result;
};
let context,
  source,
  rawBytes,
  rawRows,
  checked = 0;
try {
  if (session) context = (await session.open(target)).context;
  else {
    await client.connect(transport);
    context = (await invoke("open_binary", { path: target })).context;
  }
  for (const [index, fixture] of cases.entries()) {
    const r = await measure(
      index ? "same_inventory_second_query" : "cold_metadata",
      () => read("strings", { query: fixture.query, fields: [], limit: 1 }),
    );
    assert(r.ok);
    assert.equal(r.context.lease, context.lease);
    assert.equal(r.data.total, 1);
    assert.equal(r.data.coverage.source_scope, "whole native inventory");
    assert.equal(r.data.coverage.examined, 60601);
    assert.equal(r.data.items.length, 1);
    const row = r.data.items[0];
    assert.equal(row.address, fixture.address);
    assert.equal(row.string.encoding, "ascii");
    assert.equal(row.string.nul_terminated, true);
    assert.equal(row.string.byte_length, 28);
    assert(!Object.hasOwn(row, "value"));
    if (source) assert.equal(r.data.source.evidence_id, source.evidence_id);
    else source = r.data.source;
    assert.equal(source.capture_complete, true);
    assert(source.bytes > NATIVE_OUTPUT_BYTES);
    const value = await read("strings", {
      query: fixture.query,
      fields: ["value"],
      limit: 1,
    });
    assert(value.ok);
    assert.equal(
      value.data.items[0].value,
      bytes.subarray(fixture.file_offset, fixture.file_offset + 27).toString(),
    );
    assert.equal(bytes[fixture.file_offset - 1], 0);
    assert.equal(bytes[fixture.file_offset + 27], 0);
  }
  await measure("warm_metadata", () =>
    read("strings", { query: cases[0].query, fields: [], limit: 1 }),
  );
  const raw = await readFile(
    join(process.env.REA_ATOMIC_EVIDENCE_DIR, source.evidence_id + ".txt"),
  );
  assert.equal(sha(raw), source.sha256);
  assert.equal(raw.length, source.bytes);
  rawBytes = raw.length;
  const inventory = JSON.parse(raw.toString());
  assert.equal(inventory.count, 60601);
  assert.equal(inventory.strings.length, inventory.count);
  rawRows = inventory.count;
  const offset = raw.toString().indexOf(cases[1].query);
  for (const name of ["raw_evidence_first", "raw_evidence_repeat"]) {
    const evidence = await measure(name, () =>
      read("evidence", { evidence_id: source.evidence_id, offset, limit: 32 }),
    );
    assert(evidence.ok);
    assert.equal(evidence.data.source.evidence_id, source.evidence_id);
    assert.equal(evidence.data.text, raw.toString().slice(offset, offset + 32));
    assert.equal(evidence.data.total_code_units, raw.toString().length);
  }
  const windows = cases.flatMap((row) => [
    { address: row.address, length: 16 },
    { address: "0x" + (BigInt(row.address) + 20n).toString(16), length: 8 },
  ]);
  const selected = await read("bytes", { windows });
  assert(selected.ok);
  assert.equal(selected.data.results.length, 4);
  for (const [i, row] of selected.data.results.entries()) {
    assert(row.ok);
    const fixture = cases[Math.floor(i / 2)],
      length = i % 2 ? 8 : 16,
      offset = fixture.file_offset + (i % 2 ? 20 : 0);
    assert.equal(
      row.hex,
      bytes.subarray(offset, offset + length).toString("hex"),
    );
    assert.equal(row.returned_bytes, length);
    assert.equal(row.coverage.status, "complete-for-requested-range");
  }
  for (const file of await readdir(process.env.REA_ATOMIC_EVIDENCE_DIR)) {
    if (!file.endsWith(".json")) continue;
    const record = JSON.parse(
        await readFile(join(process.env.REA_ATOMIC_EVIDENCE_DIR, file), "utf8"),
      ),
      payload = await readFile(
        join(
          process.env.REA_ATOMIC_EVIDENCE_DIR,
          file.replace(/\.json$/u, ".txt"),
        ),
      );
    assert.equal(record.context.artifact_sha256, digest);
    assert.equal(record.context.engine_sha256, context.engine_sha256);
    assert.equal(sha(payload), record.source.sha256);
    assert.equal(payload.length, record.source.bytes);
    assert.equal(record.source.capture_complete, true);
    checked++;
  }
  assert.equal(checked, 5);
  if (session) {
    await session.close();
    await session.open(target);
  } else {
    await invoke("close_binary", {});
    await invoke("open_binary", { path: target });
  }
  const stale = await read("evidence", {
    evidence_id: source.evidence_id,
    limit: 1,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, "unknown_evidence");
  assert.notEqual(stale.context.lease, context.lease);
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  if (session) {
    session.abort();
    await session.close();
  } else {
    try {
      await invoke("close_binary", {});
    } finally {
      await client.close();
      await transport.close();
    }
  }
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
assert.equal(sha(await readFile(target)), digest);
await writeFile(
  output,
  JSON.stringify(
    {
      adapter,
      target,
      digest,
      context,
      source,
      raw_bytes: rawBytes,
      raw_rows: rawRows,
      raw_sources_verified: checked,
      observations,
      phases,
      failures,
      lifecycle,
    },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(
  JSON.stringify({ adapter, source, rawRows, checked, phases, failures }),
);
assert.deepEqual(failures, []);
