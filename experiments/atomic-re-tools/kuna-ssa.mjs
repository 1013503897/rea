// Decoder for the pinned 1.833 print_raw format, not a production Kuna API.
// Relations come from native SSA annotations, never from reconstructed C text.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const pc = "0x[0-9a-f]{1,16}";
const seq = `${pc}:[0-9a-f]{1,16}`;
const operationLine = new RegExp(`^(${seq}):\\s+(.+)$`, "u");
const blockLine = new RegExp(`^Basic Block (\\d+) (${pc})-(${pc})$`, "u");
const definitionToken = new RegExp(`\\((${seq})\\)`, "gu");
const constantToken = /#(0x[0-9a-f]{1,16})(?::(\d+))?(?![0-9a-f])/gu;
const destination = `Block_(\\d+):(${pc})`;
const conditional = new RegExp(
  `^goto ${destination} if (.+) else ${destination}$`,
  "u",
);
const direct = new RegExp(`^goto ${destination}$`, "u");
const implied = new RegExp(`^(${pc}):\\s+\\[ goto ${destination} \\]$`, "u");
const address = (value) => `0x${BigInt(value).toString(16)}`;
const operationId = (value) => {
  const [location, time] = value.split(":");
  return `${address(location)}:${BigInt(`0x${time}`).toString(16)}`;
};
const indexInto = (index, key, row) => {
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(row);
};
const ordinal = (value) => {
  const n = Number(value);
  assert.ok(Number.isSafeInteger(n) && n >= 0);
  return n;
};
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};
const validateDefinitions = (operations, issues) => {
  for (const row of operations.values()) {
    for (const relation of row.definitions) {
      if (!operations.has(relation.definition))
        issues.push({
          source_line: row.source_line,
          reason: `Missing definition ${relation.definition}`,
        });
    }
  }
};

const parseOperation = (match, blockId, sourceLine) => {
  const id = operationId(match[1]);
  const statement = match[2];
  const split = statement.indexOf(" = ");
  const lhs = split < 0 ? "" : statement.slice(0, split);
  const rhs = split < 0 ? statement : statement.slice(split + 3);
  const kind = lhs.startsWith("*(")
    ? "store"
    : rhs.startsWith("*(")
      ? "load"
      : rhs.startsWith("call ")
        ? "call"
        : statement.startsWith("goto ")
          ? "branch"
          : statement.startsWith("switch ")
            ? "switch"
            : statement.startsWith("return(")
              ? "return"
              : rhs.includes(" ? ")
                ? "phi"
                : "value";
  // STORE's address is an input. An ordinary assignment's LHS is its output.
  const inputText = kind === "store" ? statement : rhs;
  const definitions = [...inputText.matchAll(definitionToken)].map(
    (token, occurrence) => ({
      definition: operationId(token[1]),
      use: id,
      occurrence,
      // This is printed-varnode order, NOT a p-code input_index or phi predecessor.
    }),
  );
  const literals = [...inputText.matchAll(constantToken)].map((token) => ({
    value: address(token[1]),
    printed_size_bytes: token[2] === undefined ? null : ordinal(token[2]),
  }));
  const row = {
    id,
    origin_address: id.split(":")[0],
    block: blockId,
    kind,
    statement,
    definitions,
    constants: literals,
    source_line: sourceLine,
  };
  return row;
};

const controlEdges = (row) => {
  const { statement } = row;
  const edges = [];
  const branch = conditional.exec(statement);
  const jump = direct.exec(statement);
  if (branch) {
    for (const [target, targetAddress, polarity] of [
      [branch[1], branch[2], "true"],
      [branch[4], branch[5], "false"],
    ]) {
      edges.push({
        from: row.block,
        to: ordinal(target),
        target_origin: address(targetAddress),
        kind: "conditional",
        polarity,
        predicate: branch[3],
        operation: row.id,
        source_line: row.source_line,
      });
    }
  } else if (jump) {
    edges.push({
      from: row.block,
      to: ordinal(jump[1]),
      target_origin: address(jump[2]),
      kind: "direct",
      operation: row.id,
      source_line: row.source_line,
    });
  }
  return edges;
};

const graphStart = (lines) => {
  const first = lines.findIndex(
    (line, i) => line.startsWith("Basic Block 0 ") && lines[i - 1] === "0",
  );
  assert.ok(first >= 0, "Missing native SSA block graph header");
  return first;
};
export const parseKunaSsaDump = (text) => {
  assert.ok(
    Buffer.byteLength(text) <= 16 * 1024 * 1024,
    "SSA dump exceeds capture budget",
  );
  const lines = text.split("\n");
  // The CLI places C before the root block graph header. Ignore that C entirely.
  const first = graphStart(lines);
  const operations = new Map(),
    blocks = new Map(),
    constants = new Map();
  const users = new Map(),
    incoming = new Map(),
    edges = [],
    issues = [];
  let block;
  for (let i = first; i < lines.length; i++) {
    const line = lines[i];
    const header = blockLine.exec(line);
    if (header) {
      const id = ordinal(header[1]);
      assert.ok(!blocks.has(id), "Duplicate block identity");
      // Stop is the last instruction's address, NOT an exclusive byte bound.
      block = {
        id,
        origin_start: address(header[2]),
        stop_instruction: address(header[3]),
        operations: [],
        source_line: i + 1,
      };
      blocks.set(id, block);
      continue;
    }
    if (!line.trim()) continue;
    const fallthrough = implied.exec(line);
    if (fallthrough) {
      edges.push({
        from: block.id,
        to: ordinal(fallthrough[2]),
        target_origin: address(fallthrough[3]),
        kind: "printed-implied-goto",
        operation: null,
        source_line: i + 1,
      });
      continue;
    }
    const match = operationLine.exec(line);
    if (!match) {
      issues.push({
        source_line: i + 1,
        reason: "Unrecognized native dump line",
      });
      continue;
    }
    const row = parseOperation(match, block.id, i + 1);
    assert.ok(!operations.has(row.id), "Duplicate operation identity");
    operations.set(row.id, row);
    block.operations.push(row.id);
    for (const literal of new Set(row.constants.map((c) => c.value)))
      indexInto(constants, literal, row.id);
    for (const edge of row.definitions) indexInto(users, edge.definition, edge);
    edges.push(...controlEdges(row));
  }
  validateDefinitions(operations, issues);
  for (const edge of edges) {
    assert.equal(
      blocks.get(edge.to)?.origin_start,
      edge.target_origin,
      "Branch target identity mismatch",
    );
    indexInto(incoming, edge.to, edge);
  }
  const outgoing = new Set(edges.map((edge) => edge.from));
  const unrepresented = [...blocks.values()]
    .filter((b) => {
      const tail = operations.get(b.operations.at(-1));
      return tail?.kind !== "return" && !outgoing.has(b.id);
    })
    .map((b) => b.id);
  const digest = createHash("sha256").update(text).digest("hex");
  for (const table of [operations, blocks, constants, users, incoming])
    for (const value of table.values()) freeze(value);
  return freeze({
    identity: { kind: "native-ssa-snapshot", sha256: digest },
    coverage: {
      scope: "printed-SSA",
      representation:
        "optimized recovered IR; origins are not machine branch targets or block extents",
      operations: operations.size,
      blocks: blocks.size,
      explicit_control_edges: edges.length,
      unrepresented_outgoing_blocks: unrepresented,
      issues,
      control_flow: "partial",
      machine_semantic_equivalence: "unknown",
    },
    ...queryViews({ operations, blocks, constants, users, incoming, edges }),
  });
};

const queryViews = ({
  operations,
  blocks,
  constants,
  users,
  incoming,
  edges,
}) => ({
  // The owner parses/indexes once; all compositions reuse the same facts.
  operation: (id) => operations.get(id) ?? null,
  block: (id) => blocks.get(id) ?? null,
  findConstant: (value) => [...(constants.get(address(value)) ?? [])],
  uses: (id) => users.get(id) ?? [],
  incoming: (id) => incoming.get(id) ?? [],
  select: ({
    ids,
    origin_addresses,
    block_ids,
    constant,
    kind,
    offset = 0,
    limit = 20,
    fields,
  } = {}) => {
    const selectedIds = ids === undefined ? null : new Set(ids);
    const locations =
      origin_addresses === undefined
        ? null
        : new Set(origin_addresses.map(address));
    const selectedBlocks = block_ids === undefined ? null : new Set(block_ids);
    const literalIds =
      constant === undefined
        ? null
        : new Set(constants.get(address(constant)) ?? []);
    const rows = [...operations.values()].filter(
      (row) =>
        (!selectedIds || selectedIds.has(row.id)) &&
        (!locations || locations.has(row.origin_address)) &&
        (!selectedBlocks || selectedBlocks.has(row.block)) &&
        (!literalIds || literalIds.has(row.id)) &&
        (kind === undefined || row.kind === kind),
    );
    return page(rows, offset, limit, fields);
  },
  edges: ({ kind, seeds, offset = 0, limit = 20 }) => {
    const rows = seeds.flatMap((seed) =>
      kind === "definitions"
        ? (operations.get(seed)?.definitions ?? [])
        : kind === "uses"
          ? (users.get(seed) ?? [])
          : kind === "incoming"
            ? (incoming.get(seed) ?? [])
            : edges.filter((edge) => edge.from === seed),
    );
    return page(rows, offset, limit);
  },
});

const page = (rows, offset, limit, fields) => ({
  items: rows
    .slice(offset, offset + limit)
    .map((row) =>
      fields === undefined
        ? row
        : Object.fromEntries(
            [
              ...new Set([
                "id",
                "origin_address",
                "block",
                "source_line",
                ...fields,
              ]),
            ]
              .filter((key) => Object.hasOwn(row, key))
              .map((key) => [key, row[key]]),
          ),
    ),
  total: rows.length,
  offset,
  next_offset: offset + limit < rows.length ? offset + limit : null,
  scope: "retained printed facts; not complete machine semantics",
});

// Dependency-closed only within the caller's selected budget and boundaries.
export const backwardSlice = (
  snapshot,
  seeds,
  { maxOperations = 48, stopAt = [], stopKinds = ["phi", "load"] } = {},
) => {
  assert.ok(Number.isSafeInteger(maxOperations) && maxOperations > 0);
  const stopped = new Set(stopAt),
    kinds = new Set(stopKinds);
  const queue = [...new Set(seeds)],
    queued = new Set(queue),
    seen = new Set(),
    selected = [],
    boundaries = [],
    missing = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    if (seen.has(id)) continue;
    seen.add(id);
    const row = snapshot.operation(id);
    if (!row) {
      missing.push(id);
      continue;
    }
    if (selected.length >= maxOperations) {
      boundaries.push({ id, reason: "operation-budget" });
      continue;
    }
    selected.push(row);
    if (stopped.has(id) || kinds.has(row.kind)) {
      boundaries.push({
        id,
        reason: stopped.has(id) ? "caller-selected" : row.kind,
      });
    } else
      for (const edge of row.definitions) {
        if (!queued.has(edge.definition)) {
          queue.push(edge.definition);
          queued.add(edge.definition);
        }
      }
  }
  return {
    operations: selected,
    coverage: {
      status:
        boundaries.length ||
        missing.length ||
        (snapshot.coverage.issue_count ?? snapshot.coverage.issues.length)
          ? "partial"
          : "complete-for-printed-definitions",
      boundaries,
      missing,
      source_issues:
        snapshot.coverage.issue_count ?? snapshot.coverage.issues.length,
      runtime_reachability: "unknown",
      memory_alias_dependencies: "unknown",
    },
  };
};
