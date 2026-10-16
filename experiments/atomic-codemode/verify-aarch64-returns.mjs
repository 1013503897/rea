// Public SDK regression: canonical imports and the retained post-warning path.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { AtomicSession } from "./session.mjs";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output] = process.argv.slice(2);
assert.ok(
  binary && output,
  "Usage: verify-aarch64-returns.mjs ARM64_SSH OUTPUT",
);
const run = createVerifierRun(),
  session = new AtomicSession();
const observations = [],
  phases = [],
  sources = new Map(),
  failures = [];
const digest =
  "de352e4ace7028d9816fd0ee9d22936bc1b5622c400d5b0b7df660df3426b068";
const read = async (method, input) => {
  const reply = await session.call(method, input);
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.equal(reply.context.artifact_sha256, digest);
  for (const value of reply.data.results ?? [reply.data]) {
    if (Object.hasOwn(value, "ok"))
      assert.equal(value.ok, true, JSON.stringify(value));
    if (value.source) sources.set(value.source.evidence_id, value.source);
  }
  observations.push({ method, input, data: reply.data });
  return reply.data;
};
const measure = async (phase, work) => {
  const before = await familyCounters(),
    start = performance.now();
  const value = await work(),
    after = await familyCounters();
  phases.push({
    phase,
    elapsed_ms: performance.now() - start,
    family_cpu_seconds: (after.cpu - before.cpu) / 1e6,
    cumulative_family_memory_peak_bytes: after.peak,
  });
  return value;
};
let context;
try {
  await session.open(binary);
  context = session.context;
  assert.equal(context.artifact_sha256, digest);
  const functions = await read("functions", {
    addresses: ["0xbad0", "0xbad4", "0xbdd0", "0xbdd4"],
    fields: ["name", "aliases", "size"],
  });
  assert.deepEqual(
    functions.items.map((f) => [f.address, f.name]),
    [
      ["0xbad0", "free"],
      ["0xbdd0", "_exit"],
    ],
  );
  const refs = await read("references", {
    addresses: ["0x25858"],
    direction: "outgoing",
    kinds: ["jump"],
    fields: ["fromFunction", "toFunction"],
  });
  assert.equal(refs.results[0].total, 1);
  const tail = refs.results[0].items[0];
  assert.equal(tail.to, "0xbad0");
  assert.equal(tail.toFunction.name, "free");
  assert.equal(tail.fromFunction.address, "0x256c0");
  assert.equal(refs.results[0].coverage.runtime_binding, "unknown");
  const bytes = await read("bytes", {
    windows: [{ address: "0xbad0", length: 20 }],
  });
  assert.equal(
    bytes.results[0].hex,
    "5f2403d53008009011ca41f910420e9120021fd6",
  );
  const captures = [];
  for (const entry of ["0x256c0", "0x27848"]) {
    const capture = await measure(`cold-capture:${entry}`, () =>
      read("snapshot", { entry }),
    );
    const warm = await measure(`warm-same-capture:${entry}`, () =>
      read("snapshot", { entry }),
    );
    assert.deepEqual(warm, capture);
    const calls = await read("calls", {
      snapshot: capture.snapshot,
      origin_addresses:
        entry === "0x256c0" ? ["0x25858", "0x25884"] : ["0x2841c", "0x2854c"],
      fields: ["target", "target_name"],
    });
    const selected = new Map(calls.items.map((c) => [c.origin_address, c]));
    if (entry === "0x256c0") {
      assert.equal(selected.get("0x25858").target_name, "free");
      assert.equal(selected.get("0x25884").target.offset, "0x579a0");
    } else {
      assert.equal(selected.get("0x2841c").target.offset, "0x256c0");
      assert.equal(selected.get("0x2854c").target.offset, "0x5ae04");
    }
    const code = await read("code", {
      snapshot: capture.snapshot,
      limit: 2000,
    });
    assert.equal(code.next_offset, null);
    if (entry === "0x27848") {
      assert.ok(
        !code.text
          .split("\n")
          .some(
            (line) => line.includes("sub_256c0(") && line.includes("no-return"),
          ),
      );
    } else {
      assert.ok(
        code.text
          .split("\n")
          .some(
            (line) => line.includes("sub_579a0(") && line.includes("no-return"),
          ),
        "genuine fatal call stays terminal",
      );
    }
    captures.push({ capture, code });
  }
  // Complete sources remain accessible; hashing is outside timed capture phases.
  for (const source of sources.values()) {
    let text = "",
      offset = 0;
    do {
      const page = await session.call("evidence", {
        evidence_id: source.evidence_id,
        offset,
        limit: 16384,
      });
      assert.equal(page.ok, true);
      text += page.data.text;
      offset = page.data.next_offset;
    } while (offset !== null);
    assert.equal(Buffer.byteLength(text), source.bytes);
    assert.equal(
      createHash("sha256").update(text).digest("hex"),
      source.sha256,
    );
    const captured = captures.find(
      (c) => c.capture.source.evidence_id === source.evidence_id,
    );
    if (captured)
      assert.equal(JSON.parse(text).functions[0].code, captured.code.text);
  }
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  await session.close();
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({
    context,
    phases,
    observations,
    failures,
    lifecycle,
    source_digests_verified: failures.length === 0,
    scope:
      "Selected static SDK facts and recovered return coverage; not target execution, full analysis completeness, live binding or feasible-path proof.",
  }),
  { flag: "wx" },
);
console.log(
  JSON.stringify({ output, phases, failures, source_count: sources.size }),
);
if (failures.length) process.exitCode = 1;
