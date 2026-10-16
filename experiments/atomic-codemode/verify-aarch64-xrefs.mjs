// Public SDK regression on the extracted, never executed Debian AArch64 SSH.
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
assert.ok(binary && output, "Usage: verify-aarch64-xrefs.mjs ARM64_SSH OUTPUT");
const run = createVerifierRun(),
  session = new AtomicSession();
const phases = [],
  sources = new Map(),
  observations = [],
  failures = [];
const digest =
  "de352e4ace7028d9816fd0ee9d22936bc1b5622c400d5b0b7df660df3426b068";
const read = async (method, input) => {
  const reply = await session.call(method, input);
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.equal(reply.context.artifact_sha256, digest);
  for (const result of reply.data.results ?? [reply.data]) {
    if (Object.hasOwn(result, "ok"))
      assert.equal(result.ok, true, JSON.stringify(result));
    if (result.source) sources.set(result.source.evidence_id, result.source);
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
const referenceQuery = {
  addresses: ["0xb0468", "0xb1330"],
  limit: 8,
};
let context;
try {
  await session.open(binary);
  context = session.context;
  assert.equal(context.artifact_sha256, digest);
  for (const [query, address] of [
    ["REMOTE HOST IDENTIFICATION HAS CHANGED", "0xb0468"],
    ["has changed and you have requested strict checking.", "0xb1330"],
  ]) {
    const strings = await read("strings", { query, limit: 4 });
    assert.deepEqual(
      strings.items.map((s) => s.address),
      [address],
    );
  }
  const refs = await measure("cold-two-address-reference-batch", () =>
    read("references", referenceQuery),
  );
  for (const [i, from, owner] of [
    [0, "0x25750", "0x256c0"],
    [1, "0x2853c", "0x27848"],
  ]) {
    const result = refs.results[i];
    assert.equal(result.ok, true);
    assert.equal(result.total, 1);
    assert.equal(result.items[0].from, from);
    assert.equal(result.items[0].to, referenceQuery.addresses[i]);
    assert.equal(result.items[0].kind, "data");
    assert.equal(result.items[0].fromFunction.address, owner);
    assert.equal(result.coverage.discovery, "unknown");
  }
  const warm = await measure("warm-same-reference-batch", () =>
    read("references", referenceQuery),
  );
  assert.deepEqual(warm, refs);
  const incoming = await read("references", {
    addresses: ["0x256c0"],
    kinds: ["call"],
    limit: 8,
  });
  assert.deepEqual(
    incoming.results[0].items.map((r) => [r.from, r.fromFunction.address]),
    [
      ["0x2841c", "0x27848"],
      ["0x29ccc", "0x297e0"],
    ],
  );
  const got = await read("references", {
    addresses: ["0x10ff20"],
    kinds: ["read"],
    limit: 128,
  });
  const pages = [got.results[0]];
  while (pages.at(-1).next_offset !== null) {
    const offset = pages.at(-1).next_offset;
    assert.ok(
      Number.isSafeInteger(offset) && offset > (pages.length - 1) * 128,
    );
    const next = await read("references", {
      addresses: ["0x10ff20"],
      kinds: ["read"],
      limit: 128,
      offset,
    });
    pages.push(next.results[0]);
  }
  const reads = pages.flatMap((p) => p.items);
  for (const from of ["0x256d0", "0x27908", "0x27dcc", "0x28eb8"])
    assert.ok(
      reads.some(
        (r) => r.from === from && r.to === "0x10ff20" && r.kind === "read",
      ),
      from,
    );
  const bytes = await read("bytes", {
    windows: [{ address: "0x10ff20", length: 8 }],
  });
  assert.equal(bytes.results[0].hex, "7004110000000000");
  assert.equal(bytes.results[0].coverage.runtime_memory, "not-observed");
  const machine = await read("instructions", {
    windows: [
      { address: "0x2574c", count: 3 },
      { address: "0x28534", count: 7 },
    ],
    fields: ["bytes", "text"],
  });
  assert.deepEqual(
    machine.results.map((r) => r.items.map((i) => i.bytes)),
    [
      ["460400f0", "c6a01191", "acd50094"],
      [
        "460400b0",
        "050080d2",
        "c6c00c91",
        "44008052",
        "03008052",
        "42a78052",
        "2eca0094",
      ],
    ],
  );
  // Hash the public retained source. This audit is outside the timed query phases.
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
      "Static selected SDK/reference/machine facts; no target execution, full-provider parity, live GOT binding or model-cost claim.",
  }),
  { flag: "wx" },
);
console.log(
  JSON.stringify({ output, phases, failures, source_count: sources.size }),
);
if (failures.length) process.exitCode = 1;
