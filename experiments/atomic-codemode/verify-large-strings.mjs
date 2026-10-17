// Actual provider/adapter capacity, selective reads, in-program recovery and raw fidelity.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { AtomicSession } from "./session.mjs";
import { familyCounters } from "./family-counters.mjs";
import { MAX_MCP_RESULT_BYTES } from "./limits.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [manifestPath, output, adapter = "sdk"] = process.argv.slice(2);
assert(
  manifestPath && output && ["sdk", "direct", "codemode"].includes(adapter),
);
assert(process.env.REA_ATOMIC_EVIDENCE_DIR);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(hash(await readFile(manifest.binary)), manifest.sha256);
const run = createVerifierRun(),
  failures = [],
  observations = [],
  phases = [],
  ids = new Set(),
  capturedSources = new Set();
const session = adapter === "sdk" ? new AtomicSession() : null;
const client = session
  ? null
  : new Client({ name: "large-string-verifier", version: "0.1.0" });
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
  const result = session || adapter === "direct" ? wrapper : wrapper.value;
  assert(result, JSON.stringify(wrapper));
  assert.equal(result.context.artifact_sha256, manifest.sha256);
  const source = result.data?.source?.evidence_id;
  for (const row of [result.data, ...(result.data?.results ?? [])])
    if (row?.source?.evidence_id) capturedSources.add(row.source.evidence_id);
  for (const id of [
    ...(source ? [source] : []),
    ...(result.error?.details?.evidence_ids ?? []),
  ])
    ids.add(id);
  observations.push({
    method: name,
    input,
    ok: result.ok,
    error: result.error ?? null,
    encoded_response_bytes: Buffer.byteLength(JSON.stringify(result)),
  });
  return result;
};
const measure = async (phase, work) => {
  const before = await familyCounters(),
    started = performance.now();
  const value = await work(),
    after = await familyCounters();
  phases.push({
    phase,
    elapsed_ms: performance.now() - started,
    family_cpu_seconds: (after.cpu - before.cpu) / 1e6,
  });
  return value;
};
const metadata = async (fixture) => {
  const result = await read("strings", {
    query: fixture.query,
    fields: [],
    limit: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.items.length, 1);
  const item = result.data.items[0];
  assert.equal(item.address, fixture.address);
  assert.equal(Object.hasOwn(item, "value"), false);
  assert.equal(item.string.byte_length, fixture.encoded_span_bytes);
  assert.equal(item.string.nul_terminated, true);
  return result.data.source.evidence_id;
};
const recovery = async (fixture, expectedId) => {
  const input = { query: fixture.query, limit: 1 };
  const reply = await invoke("execute_javascript", {
    code: `
    const full=await rea.strings(${JSON.stringify(input)});
    if(full.ok)return {unexpected:true};
    const id=full.error.details.evidence_ids[0];
    const selected=await rea.strings(${JSON.stringify({ ...input, fields: [] })});
    const preview=await rea.evidence({evidence_id:id,limit:256});
    return {code:full.error.code,context:full.context,id,selected: selected.ok,
      selected_id:selected.data.source.evidence_id,preview:preview.ok,
      preview_id:preview.data.source.evidence_id};`,
  });
  assert.equal(reply.ok, true);
  assert.equal(reply.value.code, "bridge_budget");
  assert.equal(reply.value.id, expectedId);
  assert.equal(reply.value.selected_id, expectedId);
  assert.equal(reply.value.preview_id, expectedId);
  assert.equal(reply.value.context.artifact_sha256, manifest.sha256);
  assert(reply.value.selected && reply.value.preview);
  observations.push({ method: "in-program recovery", result: reply.value });
};
let context;
try {
  if (session) context = (await session.open(manifest.binary)).context;
  else {
    await client.connect(transport);
    context = (await invoke("open_binary", { path: manifest.binary })).context;
  }
  await measure("cold-metadata-first", () => metadata(manifest.cases[0]));
  await measure("warm-metadata-repeat", () => metadata(manifest.cases[0]));
  for (const fixture of manifest.cases) {
    const id = await metadata(fixture);
    const full = await read("strings", { query: fixture.query, limit: 1 });
    if (session) {
      assert.equal(full.ok, true);
      assert.equal(full.data.items[0].value.length, fixture.text_bytes);
      assert.equal(full.data.source.evidence_id, id);
    } else {
      assert.equal(full.ok, false);
      assert.equal(
        full.error.code,
        adapter === "direct" ? "result_budget" : "bridge_budget",
      );
      assert.deepEqual(full.error.details.evidence_ids, [id]);
      assert.equal(full.error.details.evidence_retention, "retained_by_lease");
    }
    const preview = await read("evidence", {
      evidence_id: id,
      offset: 0,
      limit: 256,
    });
    assert.equal(preview.ok, true);
    assert.equal(preview.data.source.evidence_id, id);
    if (adapter === "codemode") await recovery(fixture, id);
    const tail = `0x${(BigInt(fixture.address) + BigInt(fixture.encoded_span_bytes) - 8n).toString(16)}`;
    const bytes = await read("bytes", {
      windows: [
        { address: fixture.address, length: 16 },
        { address: tail, length: 8 },
      ],
    });
    assert.equal(bytes.ok, true);
    assert.equal(
      Buffer.from(bytes.data.results[0].hex, "hex").toString("ascii"),
      fixture.query.slice(0, 16),
    );
    assert.equal(
      bytes.data.results[1].hex,
      Buffer.from([...Array(7).fill(fixture.fill_byte), 0]).toString("hex"),
    );
  }
  // Verify the one cached native inventory directly, without putting its text in model context.
  assert.equal(ids.size, 1);
  for (const id of capturedSources) {
    const path = join(process.env.REA_ATOMIC_EVIDENCE_DIR, id),
      record = JSON.parse(await readFile(path + ".json", "utf8")),
      raw = await readFile(path + ".txt");
    assert.equal(record.context.artifact_sha256, manifest.sha256);
    assert.equal(
      record.context.engine_sha256,
      process.env.REA_ATOMIC_NATIVE_IR_ENGINE_SHA256,
    );
    assert.equal(raw.length, record.source.bytes);
    assert.equal(hash(raw), record.source.sha256);
    if (record.source.arguments[0] !== "strings") continue;
    const document = JSON.parse(raw.toString("utf8"));
    for (const fixture of manifest.cases) {
      const rows = document.strings.filter(
        (r) => r.address_hex === fixture.address,
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].text.length, fixture.text_bytes);
      assert.equal(rows[0].nul_terminated, true);
    }
  }
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
assert.equal(hash(await readFile(manifest.binary)), manifest.sha256);
await writeFile(
  output,
  JSON.stringify(
    {
      adapter,
      context,
      manifest,
      observations,
      phases,
      failures,
      raw_sources_verified: capturedSources.size,
      lifecycle,
      scope:
        "Real native capacity and static bytes on a synthetic ELF; not real-application quality or target execution.",
    },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(JSON.stringify({ adapter, phases, failures }));
assert.deepEqual(failures, []);
