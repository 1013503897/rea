// Real provider and converted MCP contracts, compared to a complete legacy producer golden.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { AtomicSession } from "./session.mjs";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";
const [goldenPath, output, adapter = "sdk", machinePath] =
  process.argv.slice(2);
assert(
  goldenPath &&
    output &&
    machinePath &&
    ["sdk", "direct", "codemode"].includes(adapter),
);
const golden = JSON.parse(await readFile(goldenPath, "utf8")),
  target = golden.manifest.target,
  machine = JSON.parse(await readFile(machinePath, "utf8"));
assert.equal(machine.target_sha256, golden.manifest.target_sha256);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(sha(await readFile(target)), golden.manifest.target_sha256);
assert(
  process.env.REA_ATOMIC_EVIDENCE_DIR &&
    process.env.REA_ATOMIC_NATIVE_STRING_QUERY === "1",
);
const run = createVerifierRun(),
  observations = [],
  phases = [],
  sources = new Set(),
  failures = [];
const session = adapter === "sdk" ? new AtomicSession() : null;
const client = session
  ? null
  : new Client({ name: "native-string-query-verifier", version: "0.1.0" });
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
  const result = session || adapter === "direct" ? wrapper : wrapper.value;
  assert(result);
  observations.push({ name, input, response: result });
  for (const row of [result.data, ...(result.data?.results ?? [])])
    if (row?.source?.evidence_id) sources.add(row.source.evidence_id);
  return result;
};
const measure = async (name, work) => {
  const before = await familyCounters(),
    start = performance.now();
  const value = await work(),
    after = await familyCounters();
  phases.push({
    name,
    elapsed_ms: performance.now() - start,
    cpu_seconds: (after.cpu - before.cpu) / 1e6,
  });
  return value;
};
const check = (result, selection, offset, text) => {
  assert(result.ok);
  assert.equal(result.context.artifact_sha256, golden.manifest.target_sha256);
  assert.equal(result.context.string_acquisition, "native-query-v1");
  assert.equal(result.data.total, selection.total);
  assert.equal(result.data.coverage.examined, golden.total);
  assert.equal(result.data.coverage.source_scope, "selected query report");
  assert.equal(result.data.coverage.artifact_discovery, "unknown");
  const expected = selection.sample.slice(offset, offset + 2);
  assert.equal(result.data.items.length, expected.length);
  for (const [index, row] of result.data.items.entries()) {
    const before = expected[index];
    assert.equal(row.address, before.address_hex);
    assert.equal(row.source_row, before.source_row);
    assert.equal(row.string.encoding, before.encoding);
    assert.equal(row.string.byte_length, before.byte_length);
    assert.equal(row.string.nul_terminated, before.nul_terminated);
    assert.equal(Object.hasOwn(row, "value"), text);
    if (text) assert.equal(row.value, before.text);
  }
  assert.equal(
    result.data.next_offset,
    offset + expected.length < selection.total
      ? offset + expected.length
      : null,
  );
  assert.equal(result.data.source.capture_complete, true);
};
let verified = 0;
try {
  if (session) await session.open(target);
  else {
    await client.connect(transport);
    await invoke("open_binary", { path: target });
  }
  for (const selection of golden.queries) {
    const input = { query: selection.query, fields: [], limit: 2 };
    const metadata = await measure(
      "cold_metadata:" + JSON.stringify(selection.query),
      () => read("strings", input),
    );
    check(metadata, selection, 0, false);
    const warm = await measure(
      "warm_metadata:" + JSON.stringify(selection.query),
      () => read("strings", input),
    );
    check(warm, selection, 0, false);
    assert.equal(
      warm.data.source.evidence_id,
      metadata.data.source.evidence_id,
    );
    const full = await measure(
      "selected_values:" + JSON.stringify(selection.query),
      () =>
        read("strings", {
          query: selection.query,
          fields: ["value"],
          limit: 2,
        }),
    );
    check(full, selection, 0, true);
    const again = await read("strings", input);
    assert.equal(
      again.data.source.evidence_id,
      metadata.data.source.evidence_id,
    );
    if (selection.total > 2) {
      const page = await read("strings", { ...input, offset: 2 });
      check(page, selection, 2, false);
    }
    const evidence = await read("evidence", {
      evidence_id: metadata.data.source.evidence_id,
      offset: 0,
      limit: 64,
    });
    assert(evidence.ok);
    assert.equal(
      evidence.data.source.evidence_id,
      metadata.data.source.evidence_id,
    );
  }
  const windows = machine.objects.flatMap((object) => object.windows);
  const loaded = await measure("independent_selected_bytes", () =>
    read("bytes", {
      windows: windows.map(({ address, length }) => ({ address, length })),
    }),
  );
  assert(loaded.ok);
  assert.equal(loaded.data.results.length, windows.length);
  for (const [index, result] of loaded.data.results.entries()) {
    const expected = windows[index];
    assert(result.ok);
    assert.equal(result.address, expected.address);
    assert.equal(result.hex.replaceAll(" ", "").toLowerCase(), expected.hex);
    assert.equal(result.returned_bytes, expected.length);
    assert.equal(result.coverage.status, "complete-for-requested-range");
  }
  for (const filename of await readdir(process.env.REA_ATOMIC_EVIDENCE_DIR)) {
    if (!filename.endsWith(".json")) continue;
    const meta = JSON.parse(
        await readFile(
          join(process.env.REA_ATOMIC_EVIDENCE_DIR, filename),
          "utf8",
        ),
      ),
      raw = await readFile(
        join(
          process.env.REA_ATOMIC_EVIDENCE_DIR,
          filename.replace(/\.json$/u, ".txt"),
        ),
      );
    assert.equal(meta.context.artifact_sha256, golden.manifest.target_sha256);
    assert.equal(
      meta.context.engine_sha256,
      process.env.REA_ATOMIC_NATIVE_IR_ENGINE_SHA256,
    );
    assert.equal(meta.source.bytes, raw.length);
    assert.equal(meta.source.sha256, sha(raw));
    assert(meta.source.capture_complete);
    assert(sources.has(meta.source.evidence_id));
    verified++;
  }
  assert.equal(verified, sources.size);
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
assert.equal(sha(await readFile(target)), golden.manifest.target_sha256);
await writeFile(
  output,
  JSON.stringify(
    {
      adapter,
      target,
      phases,
      observations,
      raw_sources_verified: verified,
      failures,
      lifecycle,
    },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(JSON.stringify({ adapter, phases, verified, failures }));
assert.deepEqual(failures, []);
