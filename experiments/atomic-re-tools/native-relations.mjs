// Native-boundary experiment, not MCP and not a production provider extension.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { AnalysisError } from "../../dist/domain/analysisErrorBase.js";
import { projectAnalysisError } from "../../dist/domain/analysisErrorProjection.js";
import { mappedCode } from "./mapped-code.mjs";
import { parseBinaryTarget } from "../../dist/application/BinaryTargetResolver.js";
import { inspectKunaInstallation } from "../../dist/kuna/KunaInstallation.js";
import { KunaTargetCommands } from "../../dist/kuna/KunaTargetCommands.js";
import { parseKunaJson } from "../../dist/kuna/KunaJson.js";
import { parseKunaStringInventory } from "../../dist/kuna/KunaStringInventory.js";
import { parseKunaIncomingReferenceFacts } from "../../dist/kuna/KunaReferenceFiles.js";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, pattern, variant, prefix, codeOption] = process.argv.slice(2);
assert.ok(binary && pattern && prefix);
assert.ok(["per-address", "inventory"].includes(variant));
await mkdir(dirname(prefix), { recursive: true });
const verifier = createVerifierRun();
const lifetime = new AbortController();
const parsed = await parseBinaryTarget(binary);
assert.ok(parsed.ok);
const installed = await inspectKunaInstallation({
  ...process.env,
  REA_KUNA_CACHE_DIR: resolve(`${prefix}.cache`),
});
assert.ok(installed.ok);
const commands = new KunaTargetCommands(parsed.value, {
  signal: lifetime.signal,
});
const address = z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u);
const functionSchema = z.object({
  name: z.string(),
  address,
  address_hex: address,
});
const relatedRow = z.object({
  address,
  address_hex: address,
  text: z.string(),
  length: z.number().int().nonnegative(),
  encoding: z.string(),
  byte_length: z.number().int().nonnegative(),
  nul_terminated: z.boolean(),
  xrefs_count: z.number().int().nonnegative(),
  functions: z.array(functionSchema),
});
const sourceKeys = new Set(["address", "from_address", "to_address"]);
const limit = 16 * 1024 * 1024;
const calls = [],
  failures = [];
let facts;
const native = async (arguments_) => {
  const start = performance.now();
  const outcome = await commands.run({
    installation: installed.value,
    operation: "experiment:native-relations",
    arguments: arguments_,
    outputBytes: limit,
    timeoutMs: 120000,
    signal: lifetime.signal,
  });
  if (!outcome.ok) throw outcome.error;
  const snapshot = outcome.value;
  const file = `${prefix}.native-${calls.length}.json`;
  await writeFile(file, snapshot.stdout.text);
  calls.push({
    elapsed_ms: performance.now() - start,
    file,
    arguments: arguments_(snapshot.input),
    sha256: createHash("sha256").update(snapshot.stdout.text).digest("hex"),
    bytes: Buffer.byteLength(snapshot.stdout.text),
  });
  return snapshot;
};
try {
  // Common producer: validate all string facts once through the existing owner.
  const scan = await native((input) => [
    "strings",
    input,
    "--json",
    "--encoding",
    "all",
    "--min-length",
    "5",
    "--termination",
    "any",
    "--no-xrefs",
  ]);
  const inventory = parseKunaStringInventory(scan.stdout.text, scan.input);
  assert.ok(inventory.ok, inventory.error);
  const selected = inventory.value.items
    .filter((row) => row.value.includes(pattern))
    .slice(0, 3);
  assert.ok(selected.length > 0);
  const results = [];
  if (variant === "per-address") {
    for (const item of selected) {
      const result = await native((input) => [
        "xrefs",
        input,
        "--to",
        item.address,
        "--json",
      ]);
      // Consume the owning parser's facts, without reinterpreting raw JSON.
      const validated = parseKunaIncomingReferenceFacts(
        result.stdout.text,
        result.input,
        item.address,
      );
      assert.ok(validated.ok, validated.error);
      const rows = validated.value.facts;
      const functions = [
        ...new Map(
          rows
            .flatMap((row) =>
              row.fromFunction === null ? [] : [row.fromFunction],
            )
            .map((fn) => [fn.address, fn]),
        ).values(),
      ];
      results.push({
        string: item,
        scope: "exact-start-address",
        xrefs_count: rows.length,
        functions,
        sites: rows.map((row) => ({
          from: row.from,
          to: row.to,
          kind: row.kind,
          instruction: row.instruction,
        })),
        source: calls.at(-1),
      });
    }
  } else {
    const result = await native((input) => [
      "strings",
      input,
      "--json",
      "--encoding",
      "all",
      "--min-length",
      "5",
      "--termination",
      "any",
    ]);
    const document = parseKunaJson(result.stdout.text, limit, sourceKeys);
    assert.equal(document.binary, result.input);
    assert.equal(document.xrefs, true);
    assert.equal(document.encoding, "all");
    assert.equal(document.min_length, 5);
    assert.equal(document.termination, "any");
    assert.equal(document.filter, null);
    assert.equal(document.section, null);
    assert.equal(document.scanned, inventory.value.scanned);
    assert.equal(document.count, document.strings.length);
    assert.equal(document.count, inventory.value.items.length);
    const known = new Map(
      inventory.value.items.map((row) => [
        `${row.address}|${row.string.encoding}`,
        row,
      ]),
    );
    const examined = new Map();
    for (const value of document.strings) {
      const row = relatedRow.parse(value);
      assert.equal(row.address, row.address_hex);
      const key = `${row.address}|${row.encoding}`;
      assert.ok(!examined.has(key));
      const expected = known.get(key);
      assert.ok(expected);
      assert.equal(row.text, expected.value);
      assert.equal(row.length, [...expected.value].length);
      assert.equal(row.byte_length, expected.string.byte_length);
      assert.equal(
        row.nul_terminated,
        expected.string.termination === "present_or_not_required",
      );
      const entries = new Set();
      for (const fn of row.functions) {
        assert.equal(fn.address, fn.address_hex);
        assert.ok(!entries.has(fn.address));
        entries.add(fn.address);
      }
      assert.ok(row.functions.length <= row.xrefs_count);
      examined.set(key, row);
    }
    for (const item of selected) {
      const row = examined.get(`${item.address}|${item.string.encoding}`);
      results.push({
        string: item,
        scope: "any-byte-in-string-extent",
        xrefs_count: row.xrefs_count,
        functions: row.functions,
        sites: {
          status: "unknown",
          reason:
            "Native string attribution does not return reference sites or kinds.",
        },
        source: calls.at(-1),
      });
    }
  }
  const code =
    codeOption === "--code-slice" ? await mappedCode(native, results[0]) : null;
  facts = {
    artifact_sha256: parsed.value.sha256,
    engine: {
      version: installed.value.version,
      sha256: installed.value.sha256,
    },
    inventory_count: inventory.value.items.length,
    selected_count: selected.length,
    results,
    mapped_code: code === null ? null : { ...code, source: calls.at(-1) },
    limitations: [
      "These are native derived static references, not runtime uses.",
      "The per-address and inventory scopes differ; their timings do not establish equivalent-query speedup.",
      "An empty function set can mean unowned references, not that a string is unused.",
      "Complete native source documents are retained locally by file and SHA-256; this is not an MCP token measurement.",
    ],
  };
} catch (error) {
  failures.push(
    error instanceof AnalysisError
      ? projectAnalysisError(error)
      : { message: String(error), stack: error.stack ?? null },
  );
}
lifetime.abort();
const closed = await commands.close();
if (!closed.ok) failures.push(String(closed.error));
const lifecycle = await completeVerifierRun(verifier);
try {
  assertVerifierCleanupComplete(lifecycle.process_lineage);
} catch (error) {
  failures.push(String(error));
}
await writeFile(
  `${prefix}.report.json`,
  JSON.stringify(
    {
      variant,
      binary: resolve(binary),
      pattern,
      calls,
      facts,
      failures,
      lifecycle,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    variant,
    native_commands: calls.length,
    native_ms: calls.reduce((sum, row) => sum + row.elapsed_ms, 0),
    selected: facts?.selected_count,
    owners: facts?.results.map((row) => row.functions.length),
    failures,
  }),
);
assert.deepEqual(failures, []);
