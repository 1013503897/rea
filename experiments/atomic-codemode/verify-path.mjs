// Completed public MCP witness task, using a retained native graph as edge oracle.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { readNativeGraphEvidence } from "./native-ir-contract.mjs";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, goldenPath, output] = process.argv.slice(2);
assert.ok(
  binary && goldenPath && output && process.env.REA_ATOMIC_EVIDENCE_DIR,
);
const goldenText = await readFile(goldenPath, "utf8");
const golden = JSON.parse(goldenText).functions[0];
const graph = JSON.parse(readNativeGraphEvidence(goldenText).text);
const expected = [
  {
    from: 1142,
    target: { kind: "block", id: 1159 },
    avoid: [],
    edges: ["1142:0"],
  },
  {
    from: 1158,
    target: { kind: "block", id: 1159 },
    avoid: [],
    edges: ["1158:0"],
  },
  {
    from: 1143,
    target: { kind: "exit" },
    avoid: [1159],
    edges: ["1143:0", "1144:0", "1201:0", "1204:0", "1205:1"],
  },
  {
    from: 1161,
    target: { kind: "exit" },
    avoid: [1159],
    edges: ["1161:1", "1162:1", "1163:1", "1164:0", "1205:1"],
  },
];
const queries = expected.map(({ edges: _edges, ...input }) => input);

// Historical consumer-side composition, deliberately independent of the new owner.
// This exists only in the verifier to measure the former all-block workflow.
function oldWitnesses(blocks, queries) {
  const byID = new Map(blocks.map((block) => [block.id, block]));
  return queries.map(({ from, target, avoid }) => {
    const pending = [{ at: from, edges: [] }],
      seen = new Set(avoid);
    seen.add(from);
    for (const row of pending) {
      const block = byID.get(row.at);
      if (
        target.kind === "block"
          ? row.at === target.id
          : !block.successors.length
      )
        return { end: row.at, edges: row.edges };
      for (const edge of block.successors)
        if (!seen.has(edge.target)) {
          seen.add(edge.target);
          pending.push({ at: edge.target, edges: [...row.edges, edge.id] });
        }
    }
    throw new Error("Baseline witness missing");
  });
}
const run = createVerifierRun(),
  phases = [],
  calls = [],
  failures = [];
const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
const client = new Client({ name: "rea-path-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
const call = async (name, input) => {
  const reply = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  const value = JSON.parse(reply.content[0].text);
  calls.push({
    name,
    input,
    value,
    content_bytes: Buffer.byteLength(reply.content[0].text),
  });
  assert.equal(value.ok, true, JSON.stringify(value));
  return value;
};
const read = async (name, input) => {
  const value = direct
    ? await call(`facts_${name}`, input)
    : (
        await call("execute_javascript", {
          code: `return await rea.${name}(${JSON.stringify(input)});`,
        })
      ).value;
  assert.equal(value.ok, true, JSON.stringify(value));
  return value.data;
};
const measure = async (phase, work) => {
  const before = await familyCounters(),
    start = performance.now(),
    callIndex = calls.length;
  const result = await work(),
    after = await familyCounters();
  phases.push({
    phase,
    elapsed_ms: performance.now() - start,
    family_cpu_seconds: (after.cpu - before.cpu) / 1e6,
    cumulative_family_memory_peak_bytes: after.peak,
    mcp_calls: calls.length - callIndex,
    response_bytes: calls
      .slice(callIndex)
      .reduce((n, row) => n + row.content_bytes, 0),
  });
  return result;
};
let review;
try {
  await client.connect(transport);
  await call("open_binary", { path: binary });
  const capture = await measure("fresh-native-capture", () =>
    read("snapshot", { entry: "0xea6d0" }),
  );
  assert.equal(capture.facets.recovered_ir.availability, "available");
  const snapshot = capture.snapshot;
  const runNew = async () => {
    if (direct) {
      const rows = [];
      for (const input of queries)
        rows.push(await read("path", { snapshot, ...input }));
      return rows;
    }
    return (
      await call("execute_javascript", {
        code: `const out=[]; for(const q of ${JSON.stringify(queries)}) { const r=await rea.path({snapshot:${JSON.stringify(snapshot)},...q}); if(!r.ok) throw Error(JSON.stringify(r)); out.push(r.data); } return out;`,
      })
    ).value;
  };
  const paths = await measure("first-path-queries", runNew);
  const repeated = await measure("repeated-path-queries-cache-churn", runNew);
  assert.deepEqual(repeated, paths);
  for (const [i, path] of paths.entries()) {
    assert.equal(path.status, "found");
    assert.deepEqual(
      path.items.map((edge) => edge.id),
      expected[i].edges,
    );
    assert.equal(path.total, expected[i].edges.length);
    assert.equal(path.evidence_id, capture.source.evidence_id);
    assert.equal(path.path_coverage.branch_predicate_feasibility, "unknown");
    for (const edge of path.items) {
      const block = graph.blocks.find((block) => block.id === edge.from);
      assert.deepEqual(edge, {
        ...block.successors[edge.index],
        from: block.id,
        to: block.successors[edge.index].target,
        operation: block.operations.at(-1) ?? null,
        kind: edge.polarity ? "conditional" : "recovered",
        step_index: edge.step_index,
      });
    }
  }
  const page = await measure("same-query-cached-page", () =>
    read("path", { snapshot, ...queries[3], offset: 2, limit: 2 }),
  );
  assert.deepEqual(page.items, paths[3].items.slice(2, 4));
  assert.equal(page.total, 5);
  assert.equal(page.next_offset, 4);
  const zero = await read("path", {
    snapshot,
    from: 1207,
    target: { kind: "exit" },
  });
  assert.equal(zero.status, "found");
  assert.equal(zero.total, 0);
  const absent = await read("path", {
    snapshot,
    from: 1207,
    target: { kind: "block", id: 1159 },
  });
  assert.equal(absent.status, "not-found");
  const unknown = await read("path", {
    snapshot,
    from: 1143,
    target: { kind: "exit" },
    avoid: [99999],
  });
  assert.equal(unknown.status, "unknown");
  assert.equal(unknown.total, null);
  assert.deepEqual(unknown.unretained_blocks, [99999]);
  const baseline = await measure(
    "historical-all-block-composition",
    async () => {
      if (!direct)
        return (
          await call("execute_javascript", {
            code: `const blocks=[]; let offset=0; do { const r=await rea.blocks({snapshot:${JSON.stringify(snapshot)},fields:["successors"],offset,limit:128}); if(!r.ok) throw Error(JSON.stringify(r)); blocks.push(...r.data.items); offset=r.data.next_offset; } while(offset!==null); return (${oldWitnesses.toString()})(blocks,${JSON.stringify(queries)});`,
          })
        ).value;
      const blocks = [];
      let offset = 0;
      do {
        const page = await read("blocks", {
          snapshot,
          fields: ["successors"],
          offset,
          limit: 128,
        });
        blocks.push(...page.items);
        offset = page.next_offset;
      } while (offset !== null);
      return oldWitnesses(blocks, queries);
    },
  );
  assert.deepEqual(
    baseline.map((row) => row.edges),
    expected.map((row) => row.edges),
  );
  const retained = JSON.parse(
    await readFile(
      join(
        process.env.REA_ATOMIC_EVIDENCE_DIR,
        `${capture.source.evidence_id}.txt`,
      ),
      "utf8",
    ),
  ).functions[0];
  assert.deepEqual(retained, golden);
  review = {
    paths: paths.map(({ items, ...rest }) => ({
      ...rest,
      edges: items.map((e) => e.id),
    })),
    complete_native_function_equals_prior_golden: true,
    all_returned_edge_fields_match_native: true,
    baseline_witnesses_equal: true,
    scope:
      "Four recovered-graph witnesses, no machine predicate or runtime feasibility proof. Warm queries follow one fresh native capture; OS cache uncontrolled. Response bytes are not model tokens.",
  };
  await call("close_binary", {});
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  await client.close();
  await transport.close();
}
const lifecycle = await completeVerifierRun(run);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({ direct, phases, calls, review, failures, lifecycle }),
  { flag: "wx" },
);
console.log(JSON.stringify({ output, direct, phases, failures, review }));
if (failures.length) process.exitCode = 1;
