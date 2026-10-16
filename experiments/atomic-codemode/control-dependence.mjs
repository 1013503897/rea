// Immediate postdominators on the reversed recovered CFG, using linear retained
// state. Control dependence is derived for finite paths to recovered exits.
import { FactFailure } from "./fact-error.mjs";
import { freezeFacts } from "./fact-reads.mjs";

const workBudget = (limit) => {
  let work = 0;
  return () => {
    if (++work > limit)
      throw new FactFailure(
        "capacity",
        "Control-dependence work budget exceeded",
      );
  };
};

// Retain one linear-size index per resident graph. Selected rows are generated
// per read, so paging does not retain a potentially quadratic relation set.
export function createControlDependenceIndex(
  blocks,
  { workLimit = 2_000_000 } = {},
) {
  const exit = Symbol("recovered-exit");
  const successors = new Map(
    blocks.map((block) => [
      block.id,
      block.successors.map((edge) => edge.target),
    ]),
  );
  const reverse = new Map([
    [exit, []],
    ...blocks.map((block) => [block.id, []]),
  ]);
  const tick = workBudget(workLimit);
  for (const [from, targets] of successors) {
    if (!targets.length) targets.push(exit);
    for (const to of targets) reverse.get(to).push(from);
  }
  const { parent, visited } = postdominatorParents(
    exit,
    successors,
    reverse,
    tick,
  );
  const coverage = freezeFacts({
    scope:
      "derived control dependence in the recovered graph; zero-successor blocks treated as exits; finite paths only",
    status:
      visited.size === blocks.length + 1
        ? "complete-for-recovered-finite-exit-paths"
        : "partial",
    exit_unreachable_blocks: blocks
      .filter((block) => !visited.has(block.id))
      .map((block) => block.id),
    nontermination: "unknown",
    runtime_reachability: "unknown",
  });
  function* relations(dependents) {
    const tick = workBudget(workLimit);
    for (const block of blocks) {
      if (!parent.has(block.id)) continue;
      for (const edge of block.successors) {
        let runner = edge.target;
        while (
          parent.has(runner) &&
          runner !== parent.get(block.id) &&
          runner !== exit
        ) {
          tick();
          if (!dependents || dependents.has(runner))
            yield { controller: block.id, dependent: runner, edge };
          runner = parent.get(runner);
        }
      }
    }
  }
  return Object.freeze({
    relations,
    coverage,
    read: ({ seeds, offset = 0, limit = 20 }) => {
      const selected = new Set(seeds),
        items = [];
      let total = 0;
      // Exhaust for a truthful total, retaining only the requested page.
      for (const row of relations(selected)) {
        if (total >= offset && items.length < limit) items.push(row);
        total++;
      }
      return {
        items,
        total,
        next_offset: offset + limit < total ? offset + limit : null,
        relation_coverage: coverage,
      };
    },
  });
}

function postdominatorParents(exit, successors, reverse, tick) {
  const visited = new Set([exit]);
  const stack = [[exit, 0]],
    postorder = [];
  while (stack.length) {
    tick();
    const frame = stack.at(-1),
      children = reverse.get(frame[0]);
    if (frame[1] < children.length) {
      const child = children[frame[1]++];
      if (!visited.has(child)) {
        visited.add(child);
        stack.push([child, 0]);
      }
    } else {
      postorder.push(frame[0]);
      stack.pop();
    }
  }
  const order = postorder.reverse();
  const position = new Map(order.map((id, i) => [id, i]));
  const parent = new Map([[exit, exit]]);
  const intersect = (a, b) => {
    while (a !== b) {
      tick();
      if (position.get(a) > position.get(b)) a = parent.get(a);
      else b = parent.get(b);
    }
    return a;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of order.slice(1)) {
      tick();
      const known = successors.get(node).filter((id) => parent.has(id));
      if (!known.length) continue;
      const next = known.slice(1).reduce(intersect, known[0]);
      if (parent.get(node) !== next) {
        parent.set(node, next);
        changed = true;
      }
    }
  }
  return { parent, visited };
}
