// Replay real captures against independent machine-byte and arithmetic checks.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mappedCode } from "./mapped-code.mjs";
import { parseKunaSsaDump } from "./kuna-ssa.mjs";
import { queryLiteralUses } from "./query-ssa.mjs";

const [root, output] = process.argv.slice(2);
assert.ok(root && output);
const json = async (name) =>
  JSON.parse(await readFile(join(root, name), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const zlib = await json("relations-zlib-query-v2.json");
const sqlite = await json("relations-sqlite-query-v2.json");
assert.deepEqual(zlib.runs[0].answers, zlib.runs[1].answers);
assert.deepEqual(sqlite.runs[0].answers, sqlite.runs[1].answers);
for (const query of [zlib, sqlite]) {
  const source = await readFile(query.source.raw.file, "utf8");
  assert.equal(sha256(source), query.source.raw.sha256);
  const snapshot = parseKunaSsaDump(source);
  for (const answer of query.runs[0].answers)
    assert.deepEqual(queryLiteralUses(snapshot, answer.literal), answer);
}
const old = await json("native-zlib-code-fixed.report.json");
assert.equal(zlib.source.artifact_sha256, old.facts.artifact_sha256);
assert.deepEqual(zlib.source.engine, old.facts.engine);
const bodySource = old.calls.find((call) => call.arguments[0] === "decompile");
const body = await readFile(bodySource.file, "utf8");
assert.equal(sha256(body), bodySource.sha256);
const bodyDocument = JSON.parse(body);
const raw = await readFile(zlib.source.raw.file, "utf8");
assert.equal(sha256(raw), zlib.source.raw.sha256);
assert.equal(
  raw.split("\n0\nBasic Block", 1)[0].trim(),
  bodyDocument.functions[0].code.trim(),
  "Cross-surface emitted C differs",
);
const native = async () => ({
  input: bodyDocument.binary,
  stdout: { text: body },
});
const mappings = [];
for (const [i, expectedLine] of [164, 551, 653].entries()) {
  const answer = zlib.runs[0].answers[i];
  const original = old.facts.results[i];
  assert.equal(answer.literal, original.string.address);
  const failed = await mappedCode(native, original);
  assert.equal(failed.status, "unknown");
  const sites = answer.direct_uses.map((id) => ({
    from: answer.operations.find((op) => op.id === id).origin_address,
  }));
  const mapped = await mappedCode(native, {
    functions: original.functions,
    sites,
  });
  assert.equal(mapped.status, "ok");
  assert.deepEqual(mapped.exact_mapped_lines, [expectedLine]);
  mappings.push({
    literal: answer.literal,
    original_sites: original.sites.map((s) => s.from),
    semantic_sites: sites.map((s) => s.from),
    line: expectedLine,
  });
}
const header = zlib.runs[0].answers[0];
assert.deepEqual(
  header.control_edges.map((e) => [e.from, e.to, e.polarity]),
  [
    [182, 446, "false"],
    [183, 446, "false"],
  ],
);
assert.equal(header.operations.length, 21);
assert.equal(header.coverage.dependencies.boundaries.length, 2);
assert.ok(header.operations.some((op) => op.statement.includes("& #0x1:4")));
assert.ok(header.operations.some((op) => op.statement.includes("/ #0x1f")));
const match = sqlite.runs[0].answers[0];
assert.equal(
  match.operations.find((op) => op.id === match.direct_uses[0]).kind,
  "call",
);
assert.ok(match.operations.some((op) => op.statement.includes("!= #0x1:4")));
assert.deepEqual(
  match.control_edges.map((e) => e.polarity),
  ["false"],
);
const assemblyProofs = [];
for (const [file, patterns] of [
  [
    "relations-zlib-guard.objdump.txt",
    [/d9ec:.*je\s+ded7/u, /da32:.*jne\s+ded7/u, /0x842108421084211/u],
  ],
  [
    "relations-sqlite-error.objdump.txt",
    [
      /65239:.*cmp\s+\$0x1,%ebx/u,
      /6523c:.*je\s+65281/u,
      /65284:.*lea.*11dcd8/u,
    ],
  ],
]) {
  const text = await readFile(join(root, file), "utf8");
  for (const pattern of patterns) assert.match(text, pattern);
  assemblyProofs.push({ file, sha256: sha256(text) });
}
// Exhaustive ordinary 16-bit header domain. This executes arithmetic, not targets.
for (let n = 0n; n < 65536n; n++) {
  const high = (n * 0x842108421084211n) >> 64n;
  const machineQ = (((n - high) >> 1n) + high) >> 4n;
  const ssaQ = (((n - n / 31n) >> 1n) + n / 31n) >> 4n;
  assert.equal(machineQ, n / 31n);
  assert.equal(ssaQ, machineQ);
  assert.equal(n !== machineQ * 31n, n % 31n !== 0n);
}
const ghidra = await json("relations-ghidra-zlib-retained.bundle.json");
const flow = ghidra.records.find((r) => r.normalized_result?.native_value_flow)
  ?.normalized_result.native_value_flow;
assert.equal(flow.truncated, true);
assert.equal(flow.operations.length, 3000);
assert.equal(flow.known_omitted_edges, 239);
assert.ok(
  !flow.operations.some((op) =>
    op.inputs.some((v) => v.constant_hex === "118fc4"),
  ),
);
await writeFile(
  output,
  JSON.stringify(
    {
      mappings,
      zlib_header_selected_operations: header.operations.length,
      sqlite_selected_operations: match.operations.length,
      assemblyProofs,
      arithmetic_oracle: {
        tested_values: 65536,
        domain: "ordinary 16-bit header value",
        target_executed: false,
      },
      ghidra: {
        retained_operations: 3000,
        known_omitted_edges: 239,
        late_literal_coverage: "unknown due to truncation",
      },
      limitations: [
        "Printed-SSA observations are derived, not runtime behavior.",
        "Entry state, complete control dependencies, phi predecessor and memory alias bindings remain unknown.",
        "Source-version agreement does not prove an exact Debian source/build match.",
      ],
    },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    output,
    mapped_errors: mappings.length,
    arithmetic_values: 65536,
  }),
);
