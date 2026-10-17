// Real SDK/MCP range facts, source identity, paging and bounded native work.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { AtomicSession } from "./session.mjs";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output, adapter = "sdk"] = process.argv.slice(2);
assert(binary && output && ["sdk", "direct", "codemode"].includes(adapter));
const verifier = createVerifierRun(),
  session = adapter === "sdk" ? new AtomicSession() : null;
const client = session
  ? null
  : new Client({ name: "rea-range-verifier", version: "0.1.0" });
const transport = session
  ? null
  : new StdioClientTransport({
      command: process.execPath,
      args: [resolve("experiments/atomic-codemode/server.mjs")],
      env: { ...process.env, REA_ATOMIC_ADAPTER: adapter },
      stderr: "pipe",
    });
const observations = [],
  sources = new Map(),
  phases = [],
  failures = [];
const invoke = async (name, input) => {
  const reply = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  return JSON.parse(reply.content[0].text);
};
const read = async (method, input) => {
  const reply = session
    ? await session.call(method, input)
    : adapter === "direct"
      ? await invoke(`facts_${method}`, input)
      : (
          await invoke("execute_javascript", {
            code: `return await rea.${method}(${JSON.stringify(input)});`,
          })
        ).value;
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.equal(
    reply.context.artifact_sha256,
    "2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8",
  );
  for (const value of reply.data.results ?? [reply.data]) {
    if (Object.hasOwn(value, "ok"))
      assert.equal(value.ok, true, JSON.stringify(value));
    if (value.source) sources.set(value.source.evidence_id, value.source);
  }
  observations.push({ method, input, data: reply.data });
  return reply.data;
};
const measure = async (phase, work) => {
  const a = await familyCounters(),
    start = performance.now(),
    value = await work(),
    b = await familyCounters();
  phases.push({
    phase,
    elapsed_ms: performance.now() - start,
    family_cpu_seconds: (b.cpu - a.cpu) / 1e6,
    cumulative_family_memory_peak_bytes: b.peak,
  });
  return value;
};
const key = (row) => [
  row.from,
  row.to,
  row.kind,
  row.fromFunction?.address ?? null,
  row.fromFunction?.name ?? null,
];
const expected = [
  ["0x4215c", "0x11b376", "data", "0x420d0", "sqlite3LocateTable"],
  ["0x2d709", "0x11b37e", "data", "0x2d600", "sqlite3AlterRenameTable"],
  ["0x4565e", "0x11b37e", "data", "0x45590", "sqlite3StartTable"],
  ["0x4573d", "0x11b37e", "data", "0x45590", "sqlite3StartTable"],
  ["0x48b2e", "0x11b37e", "data", "0x47ff0", "sqlite3EndTable"],
  ["0xbad38", "0x11b37e", "data", "0xb90e0", "sqlite3Pragma"],
  ["0xbd1f0", "0x11b37e", "data", "0xbd1b0", "sqlite3InitOne"],
];
const schemaExpected = [
  ["0x422c5", "0x11b33f", "data", "0x42280", "sqlite3PreferredTableName"],
  ...["0x41f0b", "0x41f65", "0x41fb2"].map((from) => [
    from,
    "0x11b346",
    "data",
    "0x41db0",
    "sqlite3FindTable",
  ]),
];
let context;
try {
  if (session) {
    const opened = await session.open(binary);
    context = opened.context;
  } else {
    await client.connect(transport);
    const opened = await invoke("open_binary", { path: binary });
    assert.equal(opened.ok, true);
    context = opened.context;
  }
  const ranges = [];
  for (const value of ["no such table", "sqlite_schema"]) {
    const strings = await read("strings", { query: value, limit: 128 });
    const matches = strings.items.filter((s) => s.value === value);
    assert.equal(matches.length, 1);
    const string = matches[0];
    assert.equal(string.string.encoding, "ascii");
    assert.equal(string.string.byte_length, 14);
    assert.equal(string.string.nul_terminated, true);
    ranges.push({
      start: string.address,
      end_inclusive: `0x${(BigInt(string.address) + BigInt(string.string.byte_length) - 1n).toString(16)}`,
    });
  }
  const input = {
    ranges,
    kinds: ["data"],
    fields: ["fromFunction", "toFunction", "instruction"],
    limit: 128,
  };
  const cold = await measure("cold-two-span-batch", () =>
    read("references", input),
  );
  assert.deepEqual(cold.results[0].items.map(key), expected);
  assert.deepEqual(cold.results[1].items.map(key), schemaExpected);
  assert.equal(
    new Set(cold.results.map((r) => r.source.evidence_id)).size,
    1,
    "one source covers both ranges",
  );
  const warm = await measure("warm-same-two-span-batch", () =>
    read("references", input),
  );
  assert.deepEqual(warm, cold);
  const narrow = await read("references", { ...input, fields: [] });
  assert.deepEqual(narrow.results[0].source, cold.results[0].source);
  assert.deepEqual(Object.keys(narrow.results[0].items[0]), [
    "source_row",
    "from",
    "to",
    "kind",
  ]);
  for (const page of cold.results) {
    assert.equal(page.coverage.discovery, "unknown");
    assert.equal(page.coverage.whole_string_use, "not-established");
    assert.equal(page.next_offset, null);
  }
  const overlap = await read("references", {
    ranges: [
      ranges[0],
      { start: "0x11b37e", end_inclusive: ranges[0].end_inclusive },
      ranges[0],
      { start: "0xffffffffffffffff", end_inclusive: "0xffffffffffffffff" },
    ],
    kinds: ["data"],
    limit: 128,
  });
  assert.deepEqual(
    overlap.results.map((r) => r.total),
    [7, 6, 7, 0],
  );
  assert.deepEqual(
    overlap.results[0].items.map(key),
    overlap.results[2].items.map(key),
  );
  const recovered = [];
  for (let offset = 0; offset !== null;) {
    const reply = await read("references", {
      ranges: [ranges[0]],
      kinds: ["data"],
      offset,
      limit: 2,
    });
    assert.equal(reply.results[0].total, 7);
    recovered.push(...reply.results[0].items.map(key));
    offset = reply.results[0].next_offset;
  }
  assert.deepEqual(recovered, expected);
  const bytes = await read("bytes", {
    windows: ranges.map((r) => ({ address: r.start, length: 14 })),
  });
  assert.deepEqual(
    bytes.results.map((r) => Buffer.from(r.hex, "hex").toString("ascii")),
    ["no such table\0", "sqlite_schema\0"],
  );
  // A real .rodata printable run is not necessarily a NUL-terminated literal.
  const runText = "aceinouyyacdeeghijklnorstuuwyzouaiou";
  const runs = await read("strings", { query: runText, limit: 128 });
  const selectedRun = runs.items.filter((r) => r.address === "0x11ee21");
  assert.equal(selectedRun.length, 1);
  assert.equal(selectedRun[0].value, runText);
  assert.equal(selectedRun[0].string.nul_terminated, false);
  assert.equal(selectedRun[0].string.byte_length, runText.length);
  const runBytes = await read("bytes", {
    windows: [{ address: "0x11ee21", length: runText.length + 1 }],
  });
  const encodedRun = Buffer.from(runBytes.results[0].hex, "hex");
  assert.equal(
    encodedRun.subarray(0, runText.length).toString("ascii"),
    runText,
  );
  assert.notEqual(encodedRun.at(-1), 0);
  const machine = await read("instructions", {
    windows: [
      { address: "0x2d706", count: 6 },
      { address: "0x42158", count: 12 },
    ],
    fields: ["bytes", "text"],
  });
  for (const [at, bytes] of [
    ["0x2d709", "488d156edc0e00"],
    ["0x4215c", "488d1513920d00"],
    ["0x4216a", "480f45d0"],
  ])
    assert(
      machine.results.some((r) =>
        r.items.some((i) => i.address === at && i.bytes === bytes),
      ),
      at,
    );
  // Check each source row against its actual native batch position and page.
  for (const source of sources.values()) {
    let text = "",
      offset = 0;
    do {
      const page = await read("evidence", {
        evidence_id: source.evidence_id,
        offset,
        limit: 16384,
      });
      text += page.text;
      offset = page.next_offset;
    } while (offset !== null);
    assert.equal(Buffer.byteLength(text), source.bytes);
    assert.equal(
      createHash("sha256").update(text).digest("hex"),
      source.sha256,
    );
    const raw = JSON.parse(text);
    const pages = observations
      .filter((o) => o.method === "references")
      .flatMap((o) => o.data.results)
      .filter((p) => p.source.evidence_id === source.evidence_id);
    for (const page of pages)
      for (const fact of page.items) {
        const row = raw.xrefs[fact.source_row];
        assert.equal(row.range_index, page.range_index);
        assert.equal(row.from_address_hex, fact.from);
        assert.equal(row.to_address_hex, fact.to);
      }
  }
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  if (session) await session.close();
  else {
    try {
      await invoke("close_binary", {});
    } finally {
      await client.close();
    }
  }
}
const lifecycle = await completeVerifierRun(verifier);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({
    adapter,
    context,
    observations,
    phases,
    failures,
    lifecycle,
    source_count: sources.size,
    scope:
      "Selected static SDK/MCP range facts and original-source fidelity. No target execution, complete discovery or whole-string-use proof.",
  }),
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    output,
    adapter,
    phases,
    failures,
    source_count: sources.size,
  }),
);
if (failures.length) process.exitCode = 1;
