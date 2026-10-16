// Immediate postdominators on the reversed recovered CFG, using linear retained
// state. Control dependence is derived for finite paths to recovered exits.
import { FactFailure } from "./fact-error.mjs";
export function controlDependencies(
  blocks,
  { workLimit = 2_000_000, dependents } = {},
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
  const tick = (() => {
    let work = 0;
    return () => {
      if (++work > workLimit)
        throw new FactFailure(
          "capacity",
          "Control-dependence work budget exceeded",
        );
    };
  })();
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
  const relations = [];
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
          relations.push({ controller: block.id, dependent: runner, edge });
        runner = parent.get(runner);
      }
    }
  }
  return {
    relations,
    coverage: {
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
    },
  };
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
