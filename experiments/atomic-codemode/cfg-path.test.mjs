import assert from "node:assert/strict";
import test from "node:test";
import { createGraphPathReader } from "./cfg-path.mjs";
import { MAX_GRAPH_BLOCKS } from "./graph-limits.mjs";

const graph = (successors) => {
  const blocks = new Map(successors.map((_, id) => [id, { id }]));
  const outgoing = new Map(
    successors.map((targets, from) => [
      from,
      targets.map((to, index) =>
        Object.freeze({
          id: `${from}:${index}`,
          from,
          to,
          target: to,
          index,
          operation: `op${from}`,
          polarity: null,
          condition_value: null,
          condition_test: null,
        }),
      ),
    ]),
  );
  return { blocks, outgoing, read: createGraphPathReader(blocks, outgoing) };
};

function floydDistances(successors, allowed) {
  const distances = Array.from({ length: 3 }, (_, from) =>
    Array.from({ length: 3 }, (_, to) =>
      !allowed(from) || !allowed(to)
        ? Infinity
        : from === to
          ? 0
          : successors[from].includes(to)
            ? 1
            : Infinity,
    ),
  );
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        distances[i][j] = Math.min(
          distances[i][j],
          distances[i][k] + distances[k][j],
        );
  return distances;
}
function assertWitness(result, { distance, ends, from, outgoing, allowed }) {
  assert.equal(result.status, distance === Infinity ? "not-found" : "found");
  assert.equal(result.total, distance === Infinity ? 0 : distance);
  if (result.status !== "found") return;
  assert.ok(ends.includes(result.end));
  let at = from;
  for (const [step, edge] of result.items.entries()) {
    assert.equal(edge.step_index, step);
    assert.equal(edge.from, at);
    assert.equal(outgoing.get(at)[edge.index].id, edge.id);
    assert.equal(outgoing.get(at)[edge.index].to, edge.to);
    assert.ok(allowed(edge.to));
    at = edge.to;
  }
  assert.equal(at, result.end);
}

test("all three-node digraphs and exclusions agree with independent Floyd-Warshall distances", () => {
  for (let mask = 0; mask < 512; mask++) {
    const successors = Array.from({ length: 3 }, (_, from) =>
      [0, 1, 2].filter((to) => mask & (1 << (from * 3 + to))),
    );
    const { read, outgoing } = graph(successors);
    for (let exclusions = 0; exclusions < 8; exclusions++) {
      const avoid = [0, 1, 2].filter((id) => exclusions & (1 << id));
      const allowed = (id) => !avoid.includes(id);
      const distances = floydDistances(successors, allowed);
      const queries = [0, 1, 2].flatMap((from) =>
        [
          { kind: "exit" },
          ...[0, 1, 2].map((id) => ({ kind: "block", id })),
        ].map((target) => ({ from, target })),
      );
      for (const { from, target } of queries) {
        const ends =
          target.kind === "block"
            ? [target.id]
            : [0, 1, 2].filter((id) => successors[id].length === 0);
        const distance = Math.min(...ends.map((to) => distances[from][to]));
        assertWitness(read({ from, target, avoid }), {
          distance,
          ends,
          from,
          outgoing,
          allowed,
        });
      }
    }
  }
});

test("paging retains original edge ordinal, source fields and full-path outcome", () => {
  const { read } = graph([[0, 1, 1], [2], []]);
  const request = { from: 0, target: { kind: "exit" } };
  const first = read({ ...request, limit: 1 });
  assert.equal(first.status, "found");
  assert.equal(first.total, 2);
  assert.equal(first.end, 2);
  assert.equal(first.next_offset, 1);
  assert.equal(first.items[0].id, "0:1");
  assert.equal(first.items[0].index, 1);
  assert.equal(first.items[0].step_index, 0);
  assert.equal(first.items[0].operation, "op0");
  assert.throws(() => {
    first.items[0].to = 999;
  }, TypeError);
  const second = read({ ...request, offset: 1, limit: 1 });
  assert.equal(second.items[0].step_index, 1);
  assert.equal(second.next_offset, null);
  const beyond = read({ ...request, offset: 9 });
  assert.equal(beyond.status, "found");
  assert.equal(beyond.total, 2);
  assert.equal(beyond.end, 2);
  assert.deepEqual(beyond.items, []);
});

test("unknown selections, duplicates and excluded endpoints stay explicit", () => {
  const { read } = graph([[1], []]);
  for (const input of [
    { from: 9, target: { kind: "exit" } },
    { from: 0, target: { kind: "block", id: 9 } },
    { from: 0, target: { kind: "exit" }, avoid: [9, 9] },
  ]) {
    const result = read(input);
    assert.equal(result.status, "unknown");
    assert.equal(result.total, null);
    assert.equal(result.end, null);
    assert.deepEqual(result.unretained_blocks, [9]);
  }
  assert.equal(
    read({ from: 0, target: { kind: "block", id: 0 }, avoid: [0] }).status,
    "not-found",
  );
  const zero = read({ from: 1, target: { kind: "exit" } });
  assert.equal(zero.status, "found");
  assert.equal(zero.total, 0);
  assert.equal(zero.end, 1);
  assert.equal(zero.path_coverage.runtime_reachability, "unknown");
});

test("one graph-owned cache covers paging and normalized exclusions, replaces on input change", () => {
  const { blocks, outgoing } = graph([[1], [2], [], []]);
  let reads = 0;
  const observed = {
    get(id) {
      reads++;
      return outgoing.get(id);
    },
  };
  const read = createGraphPathReader(blocks, observed);
  const request = { from: 0, target: { kind: "exit" }, avoid: [3, 3] };
  read(request);
  const initial = reads;
  read({ ...request, avoid: [3], offset: 1, limit: 1 });
  assert.equal(reads, initial);
  read({ ...request, avoid: [99] });
  read(request);
  assert.equal(reads, initial);
  read({ from: 0, target: { kind: "block", id: 1 }, avoid: [3] });
  assert.ok(reads > initial);
  const changed = reads;
  read(request);
  assert.ok(reads > changed);
  const other = createGraphPathReader(blocks, observed);
  const before = reads;
  other(request);
  assert.ok(reads > before, "fresh owner must not share the cache");
});

test("maximum admitted chain is iterative, paged and does not expand caller output", () => {
  const { read } = graph(
    Array.from({ length: MAX_GRAPH_BLOCKS }, (_, i) =>
      i + 1 < MAX_GRAPH_BLOCKS ? [i + 1] : [],
    ),
  );
  const result = read({ from: 0, target: { kind: "exit" }, limit: 1 });
  assert.equal(result.total, MAX_GRAPH_BLOCKS - 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.end, MAX_GRAPH_BLOCKS - 1);
  assert.equal(result.path_coverage.examined_blocks, MAX_GRAPH_BLOCKS);
});
