import { freezeFacts as freeze } from "./fact-reads.mjs";
import { nativePage } from "./native-reads.mjs";

function search(outgoing, from, target, avoid) {
  const blocked = new Set(avoid);
  if (blocked.has(from) || (target.kind === "block" && blocked.has(target.id)))
    return {
      status: "not-found",
      end: null,
      items: [],
      examined_blocks: 0,
      examined_edges: 0,
      search: "excluded-endpoint",
    };
  const queue = [from],
    predecessor = new Map([[from, null]]);
  let examined_blocks = 0,
    examined_edges = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor],
      edges = outgoing.get(current) ?? [];
    examined_blocks++;
    if (target.kind === "block" ? current === target.id : edges.length === 0) {
      const path = [];
      for (let at = current; predecessor.get(at) !== null;) {
        const edge = predecessor.get(at);
        path.push(edge);
        at = edge.from;
      }
      path.reverse();
      return {
        status: "found",
        end: current,
        items: path.map((edge, step_index) => freeze({ ...edge, step_index })),
        examined_blocks,
        examined_edges,
        search: "shortest-witness",
      };
    }
    for (const edge of edges) {
      examined_edges++;
      if (!blocked.has(edge.to) && !predecessor.has(edge.to)) {
        predecessor.set(edge.to, edge);
        queue.push(edge.to);
      }
    }
  }
  return {
    status: "not-found",
    end: null,
    items: [],
    examined_blocks,
    examined_edges,
    search: "reachable-subgraph-exhausted",
  };
}

// Consume validated identities/edges, never provider text or machine predicates.
// A resident immutable graph owns at most one cached query and O(V) search state.
export function createGraphPathReader(blocks, outgoing) {
  let last;
  return (input) => {
    const avoid = [...new Set(input.avoid ?? [])];
    const selected = [
      input.from,
      ...(input.target.kind === "block" ? [input.target.id] : []),
      ...avoid,
    ];
    const unretained_blocks = [...new Set(selected)].filter(
      (id) => !blocks.has(id),
    );
    let result;
    if (unretained_blocks.length) {
      result = {
        status: "unknown",
        end: null,
        items: [],
        examined_blocks: 0,
        examined_edges: 0,
        search: "unretained-selection",
      };
    } else {
      const key = JSON.stringify([
        input.from,
        input.target.kind,
        input.target.kind === "block" ? input.target.id : null,
        [...avoid].sort((a, b) => a - b),
      ]);
      if (last?.key !== key)
        last = {
          key,
          result: freeze(search(outgoing, input.from, input.target, avoid)),
        };
      result = last.result;
    }
    const {
      items,
      examined_blocks,
      examined_edges,
      search: scope,
      ...outcome
    } = result;
    return {
      ...outcome,
      from: input.from,
      target: { ...input.target },
      avoid,
      ...nativePage(items, input),
      total: outcome.status === "unknown" ? null : items.length,
      unretained_blocks,
      path_coverage: {
        scope:
          "recovered CFG under requested exclusions; one shortest edge-count witness in native edge order",
        search: scope,
        examined_blocks,
        examined_edges,
        branch_predicate_feasibility: "unknown",
        machine_semantic_equivalence: "unknown",
        runtime_reachability: "unknown",
      },
    };
  };
}
