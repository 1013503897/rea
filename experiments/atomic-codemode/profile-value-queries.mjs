// Equivalent core queries on retained real provider facts; not a model benchmark.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseNativeIR } from "./native-ir.mjs";
import { familyCounters } from "./family-counters.mjs";

const [sourcePath, oraclePath, output] = process.argv.slice(2);
assert.equal(process.versions.node, (await readFile(".nvmrc", "utf8")).trim());
const source = await readFile(sourcePath, "utf8"),
  oracle = JSON.parse(await readFile(oraclePath, "utf8"));
const sourceMetadata = JSON.parse(
  await readFile(sourcePath.replace(/\.txt$/u, ".json"), "utf8"),
);
assert.equal(
  createHash("sha256").update(source).digest("hex"),
  sourceMetadata.source.sha256,
);
const phases = [];
let model;
async function measure(phase, work) {
  const before = await familyCounters(),
    started = performance.now();
  const value = await work();
  const elapsed_ms = performance.now() - started,
    after = await familyCounters();
  phases.push({
    phase,
    elapsed_ms,
    family_cpu_seconds: (after.cpu - before.cpu) / 1e6,
    cumulative_family_memory_peak_bytes: after.peak,
    ...value,
  });
}
await measure("parse-retained-native-source", () => {
  model = parseNativeIR(source, oracle.entry);
});
const fields = ["space", "offset", "size_bytes", "definition", "is_input"];
const pickValue = (v) =>
  Object.fromEntries(["id", ...fields].map((k) => [k, v[k]]));
const sortedUses = (rows) =>
  [...rows].sort(
    (a, b) =>
      a.operation.localeCompare(b.operation) || a.input_index - b.input_index,
  );
function collectPagedUses(operations, byID, uses) {
  for (const op of operations)
    for (const input of op.inputs)
      if (byID.has(input.value_id))
        uses.push({
          operation: op.id,
          ...input,
          definition: byID.get(input.value_id).definition,
        });
}
for (const [phase, indexed] of [
  ["paged-task", false],
  ["indexed-first-task", true],
  ["indexed-warm-task", true],
]) {
  await measure(phase, () => {
    let calls = 0,
      bytes = 0,
      valueRows = 0,
      operationRows = 0;
    const read = (method, input) => {
      calls++;
      const result = model[method](input);
      // Included in these timings; this is core JSON size, not MCP wire/tokens.
      bytes += Buffer.byteLength(JSON.stringify(result));
      return result;
    };
    const values = [],
      uses = [];
    let offset = 0;
    do {
      const page = read("values", {
        offset,
        limit: 128,
        fields,
        ...(indexed ? { locations: oracle.locations } : {}),
      });
      valueRows += page.items.length;
      values.push(
        ...page.items.filter((v) =>
          oracle.locations.some((location) =>
            Object.entries(location).every(([k, value]) => v[k] === value),
          ),
        ),
      );
      offset = page.next_offset;
    } while (offset !== null);
    const byID = new Map(values.map((v) => [v.id, v]));
    if (indexed) {
      for (let i = 0; i < values.length; i += 128) {
        offset = 0;
        do {
          const page = read("edges", {
            kind: "value_uses",
            seeds: values.slice(i, i + 128).map((v) => v.id),
            offset,
            limit: 128,
          });
          uses.push(...page.items);
          offset = page.next_offset;
        } while (offset !== null);
      }
    } else {
      offset = 0;
      do {
        const page = read("select", { offset, limit: 128, fields: ["inputs"] });
        operationRows += page.items.length;
        collectPagedUses(page.items, byID, uses);
        offset = page.next_offset;
      } while (offset !== null);
    }
    assert.deepEqual(values, oracle.values.map(pickValue));
    assert.deepEqual(sortedUses(uses), sortedUses(oracle.uses));
    return {
      core_queries: calls,
      core_result_utf8_bytes: bytes,
      value_rows_read: valueRows,
      operation_rows_read: operationRows,
      selected_values: values.length,
      selected_uses: uses.length,
    };
  });
}
await writeFile(
  output,
  JSON.stringify(
    {
      source: sourceMetadata,
      phases,
      scope:
        "Offline retained real OpenSSH graph; equivalent source-derived facts, not alias proof. Query time/CPU includes core-result byte accounting. No fresh native/provider work, MCP wire or model-token cost is measured. Memory peaks are cumulative, not isolated warm peaks.",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(phases));
