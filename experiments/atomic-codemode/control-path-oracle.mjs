// Test/evaluator oracle only. Removing a node and searching for exits is
// independent of the runtime's immediate-postdominator algorithm.
export function finiteExitControlOracle(blocks) {
  const reverse = new Map(blocks.map((block) => [block.id, []]));
  for (const block of blocks)
    for (const edge of block.successors)
      reverse.get(edge.target).push(block.id);
  const exits = blocks
    .filter((block) => !block.successors.length)
    .map((b) => b.id);
  const reachesExitWithout = (forbidden) => {
    const seen = new Set(exits.filter((id) => id !== forbidden));
    const queue = [...seen];
    for (let i = 0; i < queue.length; i++)
      for (const previous of reverse.get(queue[i]))
        if (previous !== forbidden && !seen.has(previous)) {
          seen.add(previous);
          queue.push(previous);
        }
    return seen;
  };
  const active = reachesExitWithout(undefined),
    relations = [];
  for (const dependent of active) {
    const avoiding = reachesExitWithout(dependent);
    const postdominates = (node) => active.has(node) && !avoiding.has(node);
    for (const block of blocks) {
      if (!active.has(block.id)) continue;
      // Strict postdominance excludes the node itself, preserving loop
      // self-dependence when a recovered edge leads back to its controller.
      if (block.id !== dependent && postdominates(block.id)) continue;
      for (const edge of block.successors)
        if (postdominates(edge.target))
          relations.push({ controller: block.id, dependent, edge_id: edge.id });
    }
  }
  return {
    relations,
    exit_unreachable_blocks: blocks
      .filter((b) => !active.has(b.id))
      .map((b) => b.id),
  };
}
