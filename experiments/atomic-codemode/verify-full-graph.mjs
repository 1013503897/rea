// Real public retained-graph reads; producer fidelity is not machine equivalence.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import Ajv2020 from "ajv/dist/2020.js";
import { readNativeGraphEvidence } from "./native-ir-contract.mjs";
import { finiteExitControlOracle } from "./control-path-oracle.mjs";
import { familyCounters } from "./family-counters.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output, goldenPath, partialPath] = process.argv.slice(2);
const evidenceDirectory = process.env.REA_ATOMIC_EVIDENCE_DIR;
assert.ok(
  evidenceDirectory,
  "Set REA_ATOMIC_EVIDENCE_DIR for producer comparison",
);
assert.equal(
  process.versions.node,
  (await readFile(resolve(".nvmrc"), "utf8")).trim(),
  "Use the repository's pinned Node before running native analysis",
);
const goldenText = await readFile(goldenPath, "utf8");
const golden = JSON.parse(goldenText).functions[0];
const graph = JSON.parse(readNativeGraphEvidence(goldenText).text);
const oracle = finiteExitControlOracle(graph.blocks);
const partial = JSON.parse(await readFile(partialPath, "utf8")).functions[0]
  .atomic_projection;
const formerFrontier = partial.coverage.frontier
  .slice(0, 3)
  .map((row) => row.definition);
const run = createVerifierRun(),
  calls = [],
  phases = [],
  failures = [];
const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
const client = new Client({
  name: "rea-full-graph-verifier",
  version: "0.1.0",
});
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
let sourceReview;
const measure = async (phase, work) => {
  const before = await familyCounters(),
    started = performance.now();
  const result = await work();
  const elapsed_ms = performance.now() - started,
    after = await familyCounters();
  phases.push({
    phase,
    elapsed_ms,
    family_cpu_seconds: (after.cpu - before.cpu) / 1e6,
    cumulative_family_memory_peak_bytes: after.peak,
  });
  return result;
};
try {
  await client.connect(transport);
  const catalog = await client.listTools(),
    ajv = new Ajv2020({ strict: false });
  for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
  await call("open_binary", { path: binary });
  const capture = await measure("fresh-native-capture", () =>
      read("snapshot", { entry: "0xea6d0" }),
    ),
    snapshot = capture.snapshot;
  assert.equal(capture.facets.recovered_ir.availability, "available");
  assert.equal(capture.facets.operations.count, 21349);
  assert.equal(capture.facets.values.count, 35755);
  assert.equal(capture.coverage.blocks, 1229);
  assert.equal(capture.coverage.omitted_definition_count, 0);
  assert.equal(capture.coverage.runtime_successors, "unknown");
  const definitions = await read("operations", {
    snapshot,
    ids: formerFrontier,
    fields: ["opcode", "output"],
  });
  assert.deepEqual(
    definitions.items.map((op) => op.id),
    formerFrontier,
  );
  for (const op of definitions.items) {
    const expected = graph.operations.find((row) => row.id === op.id);
    assert.equal(op.opcode, expected.opcode);
    assert.equal(op.output, expected.output);
  }
  const blocks = await read("blocks", {
    snapshot,
    ids: [1154, 1159],
    fields: ["predecessors", "successors", "operations"],
  });
  for (const block of blocks.items) {
    const expected = graph.blocks.find((row) => row.id === block.id);
    for (const field of ["predecessors", "successors", "operations"])
      assert.deepEqual(block[field], expected[field]);
  }
  const edges = await read("relations", {
    snapshot,
    kind: "incoming",
    seeds: [1154, 1159],
    limit: 128,
  });
  const expectedEdges = [1154, 1159].flatMap((seed) =>
    graph.blocks.flatMap((block) =>
      block.successors
        .filter((edge) => edge.target === seed)
        .map((edge) => ({
          ...edge,
          from: block.id,
          to: edge.target,
          operation: block.operations.at(-1) ?? null,
          kind: edge.polarity ? "conditional" : "recovered",
        })),
    ),
  );
  assert.deepEqual(edges.items, expectedEdges);
  const key = (row) =>
    `${row.controller}|${row.dependent}|${row.edge_id ?? row.edge.id}`;
  const selectedControls = await measure("first-selected-controllers", () =>
    read("relations", {
      snapshot,
      kind: "controllers",
      seeds: [1154, 1159],
      limit: 128,
    }),
  );
  assert.deepEqual(selectedControls.unretained_seeds, []);
  assert.deepEqual(
    selectedControls.items.map(key).sort(),
    oracle.relations
      .filter((r) => [1154, 1159].includes(r.dependent))
      .map(key)
      .sort(),
  );
  const allControls = [];
  await measure("all-retained-controller-pairs", async () => {
    for (let i = 0; i < graph.blocks.length; i += 128) {
      const seeds = graph.blocks.slice(i, i + 128).map((b) => b.id);
      let offset = 0;
      do {
        const page = await read("relations", {
          snapshot,
          kind: "controllers",
          seeds,
          offset,
          limit: 128,
        });
        assert.deepEqual(page.unretained_seeds, []);
        assert.deepEqual(
          page.relation_coverage.exit_unreachable_blocks,
          oracle.exit_unreachable_blocks,
        );
        for (const row of page.items) {
          const block = graph.blocks.find((b) => b.id === row.controller);
          assert.deepEqual(
            row.edge,
            block.successors.find((e) => e.id === row.edge.id),
          );
        }
        allControls.push(...page.items);
        offset = page.next_offset;
      } while (offset !== null);
    }
  });
  assert.deepEqual(
    allControls.map(key).sort(),
    oracle.relations.map(key).sort(),
  );
  const warm = await measure("same-selected-controllers-warm", () =>
    read("relations", {
      snapshot,
      kind: "controllers",
      seeds: [1154, 1159],
      limit: 128,
    }),
  );
  assert.deepEqual(warm, selectedControls);
  for (const kind of ["incoming", "outgoing", "controllers"]) {
    const missing = await read("relations", {
      snapshot,
      kind,
      seeds: [999999],
    });
    assert.equal(missing.total, 0);
    assert.deepEqual(missing.unretained_seeds, [999999]);
    const one = await read("relations", {
      snapshot,
      kind,
      seeds: [1159],
      limit: 128,
    });
    const mixed = await read("relations", {
      snapshot,
      kind,
      seeds: [1159, 999999, 1159],
      limit: 128,
    });
    assert.deepEqual(mixed.items, one.items);
    assert.equal(mixed.total, one.total);
    assert.deepEqual(mixed.unretained_seeds, [999999]);
  }
  const operands = await read("relations", {
    snapshot,
    kind: "operands",
    seeds: ["0xea998:14649"],
    input_indices: [0, 105, 155],
  });
  assert.equal(operands.items.length, 3);
  const retained = await read("calls", {
    snapshot,
    origin_addresses: ["0xf115c", "0xf238b"],
    fields: ["arguments", "target"],
  });
  assert.equal(retained.items.length, 2);
  assert.equal(retained.evidence_id, capture.source.evidence_id);
  const raw = await read("evidence", {
    evidence_id: capture.source.evidence_id,
    limit: 128,
  });
  const decoded = await read("evidence", {
    evidence_id: capture.source.evidence_id,
    component: "recovered_ir",
    limit: 256,
  });
  assert.equal(raw.view, undefined);
  assert.equal(decoded.view.encoding, "gzip-base64");
  assert.equal(decoded.source.sha256, capture.source.sha256);
  const text = await readFile(
    join(evidenceDirectory, `${capture.source.evidence_id}.txt`),
    "utf8",
  );
  assert.equal(
    createHash("sha256").update(text).digest("hex"),
    capture.source.sha256,
  );
  assert.ok(Buffer.byteLength(text) <= 8 * 1024 * 1024);
  const fn = JSON.parse(text).functions[0];
  const view = readNativeGraphEvidence(text);
  assert.deepEqual(JSON.parse(view.text), graph);
  assert.equal(
    decoded.view.sha256,
    createHash("sha256").update(view.text).digest("hex"),
  );
  assert.equal(decoded.view.bytes, Buffer.byteLength(view.text));
  assert.equal(decoded.text, view.text.slice(0, 256));
  const { atomic_facts: _ignored, ...ordinary } = fn;
  const { atomic_facts: _oldGraph, ...goldenOrdinary } = golden;
  assert.deepEqual(ordinary, goldenOrdinary);
  const next = await read("evidence", {
    evidence_id: capture.source.evidence_id,
    component: "recovered_ir",
    offset: decoded.next_offset,
    limit: 64,
  });
  assert.deepEqual(next.view, decoded.view);
  assert.equal(
    next.text,
    view.text.slice(decoded.next_offset, decoded.next_offset + 64),
  );
  assert.equal(
    (await read("snapshot", { entry: "0xea6d0" })).snapshot,
    snapshot,
  );
  sourceReview = {
    source_bytes: Buffer.byteLength(text),
    decoded_graph_bytes: Buffer.byteLength(view.text),
    logical_graph_equals_diagnostic_golden: true,
    ordinary_record_and_calls_equal_golden: true,
    former_projection_frontier_readable: formerFrontier,
    control_pairs_match_independent_path_oracle: allControls.length,
    complete_evidence_views_verified: true,
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
  JSON.stringify({
    direct,
    node_version: process.version,
    calls,
    phases,
    failures,
    sourceReview,
    lifecycle,
    scope:
      "Real public MCP plus complete retained producer-gold comparison; no model or runtime/machine-equivalence claim.",
  }),
  { flag: "wx" },
);
console.log(
  JSON.stringify({ output, calls: calls.length, failures, sourceReview }),
);
if (failures.length) process.exitCode = 1;
