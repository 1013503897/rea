// Equivalent retained-source queries, not a real-agent or native speed benchmark.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { parseNativeIR } from "./native-ir.mjs";
import { readNativeGraphEvidence } from "./native-ir-contract.mjs";
import { finiteExitControlOracle } from "./control-path-oracle.mjs";

const [sourcePath, output, baseline] = process.argv.slice(2);
assert.match(
  baseline ?? "",
  /^[0-9a-f]{40}$/u,
  "Select a pinned baseline commit",
);
const sha = (text) => createHash("sha256").update(text).digest("hex");
const text = await readFile(sourcePath, "utf8"),
  document = JSON.parse(text);
const fn = document.functions[0],
  graph = JSON.parse(readNativeGraphEvidence(text).text);
const parseStart = performance.now(),
  parseCpu = process.cpuUsage();
const model = parseNativeIR(text, fn.address_hex, document.binary);
const parsing = {
  elapsed_ms: performance.now() - parseStart,
  cpu: process.cpuUsage(parseCpu),
};
const { stdout: original } = await promisify(execFile)("git", [
  "show",
  `${baseline}:experiments/atomic-codemode/control-dependence.mjs`,
]);
const dependency = '"./fact-error.mjs"';
assert.equal(original.split(dependency).length, 2);
const old = await import(
  `data:text/javascript,${encodeURIComponent(original.replace(dependency, JSON.stringify(new URL("./fact-error.mjs", import.meta.url).href)))}`
);
assert.equal(typeof old.controlDependencies, "function");
const seeds = [1154, 1159],
  dependents = new Set(seeds),
  limit = 2;
const before = (offset) => {
  const result = old.controlDependencies(graph.blocks, { dependents });
  return {
    items: result.relations.slice(offset, offset + limit),
    total: result.relations.length,
    next_offset:
      offset + limit < result.relations.length ? offset + limit : null,
    relation_coverage: result.coverage,
  };
};
const after = (offset) =>
  model.edges({ kind: "controllers", seeds, offset, limit });
function task(read) {
  let offset = 0,
    queries = 0;
  const rows = [];
  do {
    const page = read(offset);
    rows.push(...page.items);
    queries++;
    offset = page.next_offset;
  } while (offset !== null);
  return { rows, queries };
}
const measures = [];
function measure(name, read) {
  const cpu = process.cpuUsage(),
    start = performance.now();
  const result = task(read);
  measures.push({
    name,
    elapsed_ms: performance.now() - start,
    cpu: process.cpuUsage(cpu),
    queries: result.queries,
    rows: result.rows.length,
  });
  return result;
}
const expected = measure("baseline-complete-task", before);
assert.deepEqual(measure("first-indexed-complete-task", after), expected);
assert.deepEqual(measure("same-complete-task-warm", after), expected);
for (const [name, read] of [
  ["baseline-50-complete-tasks", before],
  ["indexed-50-complete-tasks", after],
]) {
  const cpu = process.cpuUsage(),
    start = performance.now();
  for (let i = 0; i < 50; i++) assert.deepEqual(task(read), expected);
  measures.push({
    name,
    elapsed_ms: performance.now() - start,
    cpu: process.cpuUsage(cpu),
    tasks: 50,
    queries: expected.queries * 50,
    rows: expected.rows.length * 50,
  });
}
const oracleStart = performance.now(),
  oracle = finiteExitControlOracle(graph.blocks);
const oracle_ms = performance.now() - oracleStart;
const rows = oracle.relations.filter((row) => dependents.has(row.dependent));
const key = (row) =>
  `${row.controller}|${row.dependent}|${row.edge_id ?? row.edge.id}`;
assert.deepEqual(expected.rows.map(key).sort(), rows.map(key).sort());
const blocks = new Map(graph.blocks.map((b) => [b.id, b]));
const operations = new Map(graph.operations.map((op) => [op.id, op]));
const selected = [1159, 1141, 1157].map((id) => ({
  id,
  block: blocks.get(id),
  controllers: oracle.relations
    .filter((r) => r.dependent === id)
    .map((row) => ({
      ...row,
      edge: blocks
        .get(row.controller)
        .successors.find((e) => e.id === row.edge_id),
      operation: operations.get(blocks.get(row.controller).operations.at(-1)),
    })),
}));
const report = {
  scope:
    "Same paged controller facts on retained real graph; parsing/native/MCP/model costs are separate. Query order and OS caches uncontrolled; family peak is cumulative.",
  sourcePath,
  source_sha256: sha(text),
  baseline,
  baseline_module_sha256: sha(original),
  current_module_sha256: sha(
    await readFile(new URL("./control-dependence.mjs", import.meta.url)),
  ),
  entry: fn.address_hex,
  blocks: graph.blocks.length,
  edges: graph.blocks.reduce((n, b) => n + b.successors.length, 0),
  parsing,
  measures,
  oracle_ms,
  oracle_relation_count: oracle.relations.length,
  selected,
};
await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" });
console.log(
  JSON.stringify({
    output,
    parsing,
    measures,
    oracle_ms,
    oracle_relation_count: oracle.relations.length,
  }),
);
