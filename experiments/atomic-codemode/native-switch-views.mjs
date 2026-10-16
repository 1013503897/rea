// Native table ownership is separate from optimized CFG and machine transfers.
import { requireFact, requireSameNativeValue } from "./native-contract.mjs";
import { uniqueNative, readNativeIdentities } from "./native-reads.mjs";
import { freezeFacts } from "./fact-reads.mjs";

function validateEdge(edge, block) {
  requireFact(
    edge.id === `${block}:${edge.index}`,
    "Native switch edge identity mismatch",
  );
}
function indexTable(sw) {
  const { rows, ...metadata } = sw.table;
  requireFact(
    (metadata.default_raw_index === -1) === (metadata.default_edge === null),
    "Native switch default availability mismatch",
  );
  if (metadata.default_edge) {
    validateEdge(metadata.default_edge, sw.block);
    requireFact(
      metadata.default_edge.index === metadata.default_raw_index,
      "Native switch default index mismatch",
    );
  }
  const counts = {
    case_count: rows.length,
    mapping_count: 0,
    known_label_count: 0,
    missing_label_count: 0,
    no_label_count: 0,
    unmapped_row_count: 0,
    unknown_target_count: 0,
  };
  const byLabel = new Map();
  for (const [i, row] of rows.entries()) {
    requireFact(row.index === i, "Native case row ordinal mismatch");
    const edges = new Set();
    for (const edge of row.edges) {
      validateEdge(edge, sw.block);
      requireFact(
        !edges.has(edge.id),
        "Duplicate native case/out-edge binding",
      );
      edges.add(edge.id);
    }
    if (row.label === null) counts.missing_label_count++;
    else if (row.label.status === "no-label") counts.no_label_count++;
    else {
      counts.known_label_count++;
      if (!byLabel.has(row.label.raw_bits)) byLabel.set(row.label.raw_bits, []);
      byLabel.get(row.label.raw_bits).push(row);
    }
    counts.mapping_count += row.edges.length;
    if (row.edges.length === 0) counts.unmapped_row_count++;
    if (row.recovered_target === null) counts.unknown_target_count++;
  }
  const hasRawLabels = counts.missing_label_count < rows.length;
  requireFact(
    metadata.labelled === hasRawLabels,
    "Native switch label availability mismatch",
  );
  const prefix = caseOffsets(rows);
  const table = { ...metadata, ...counts, relation_count: prefix.at(-1) };
  // Retain source rows and label references, not a second full row projection.
  // A numeric row lookup is O(1); selected label reads use this index.
  return { table, lookup: { rows, prefix, byLabel, labelOffsets: new Map() } };
}

export function indexSwitchFacet(facts) {
  freezeFacts(facts);
  const switches = uniqueNative(facts.items),
    summaries = new Map(),
    cases = new Map();
  requireFact(
    switches.size <= facts.coverage.operations_examined,
    "Native switch count exceeds examined operations",
  );
  for (const sw of switches.values()) {
    requireFact(
      sw.id.split(":")[0] === sw.origin_address,
      "Native switch origin/identity mismatch",
    );
    let table = null;
    if (sw.table) {
      const indexed = indexTable(sw);
      table = indexed.table;
      cases.set(sw.id, indexed.lookup);
    }
    summaries.set(
      sw.id,
      freezeFacts({
        id: sw.id,
        origin_address: sw.origin_address,
        block: sw.block,
        selector: sw.selector,
        table,
      }),
    );
  }
  return { switches, summaries, cases };
}
export function validateSwitchGraph(index, graph) {
  for (const sw of index.switches.values()) {
    const op = graph.operations.get(sw.id),
      block = graph.blocks.get(sw.block);
    requireFact(
      op?.opcode === "CPUI_BRANCHIND" &&
        op.block === sw.block &&
        op.address === sw.origin_address &&
        block,
      "Native switch/graph ownership mismatch",
    );
    requireFact(
      (op.inputs[0]?.value_id ?? null) === (sw.selector?.id ?? null),
      "Native switch/graph selector mismatch",
    );
    if (sw.selector)
      requireSameNativeValue(
        sw.selector,
        graph.values.get(sw.selector.id),
        "Native switch/graph selector value mismatch",
      );
    const checkEdge = (edge) =>
      requireFact(
        block.successors[edge.index]?.id === edge.id &&
          block.successors[edge.index]?.target === edge.target,
        "Native switch/graph edge mapping mismatch",
      );
    if (sw.table?.default_edge) checkEdge(sw.table.default_edge);
    for (const row of sw.table?.rows ?? [])
      for (const edge of row.edges) checkEdge(edge);
  }
  for (const op of graph.operations.values())
    requireFact(
      op.opcode !== "CPUI_BRANCHIND" || index.switches.has(op.id),
      "Native indirect branch omitted from switch coverage",
    );
}
export function validateSwitchValues(index, values) {
  if (!values) return;
  for (const sw of index.switches.values())
    if (sw.selector && values.has(sw.selector.id))
      requireSameNativeValue(
        sw.selector,
        values.get(sw.selector.id),
        "Native switch/shared value mismatch",
      );
}
function caseOffsets(rows) {
  const prefix = new Uint32Array(rows.length + 1);
  for (let i = 0; i < rows.length; i++)
    prefix[i + 1] = prefix[i] + Math.max(1, rows[i].edges.length);
  return prefix;
}
function selectCaseRows(lookup, labels, indices) {
  if (!labels && !indices) return lookup;
  if (!indices && labels?.size === 1) {
    const label = labels.values().next().value;
    const rows = lookup.byLabel.get(label) ?? [];
    if (!lookup.labelOffsets.has(label) && lookup.byLabel.has(label))
      lookup.labelOffsets.set(label, caseOffsets(rows));
    return {
      rows,
      prefix: lookup.labelOffsets.get(label) ?? new Uint32Array(1),
    };
  }
  const rows = indices
    ? indices
        .flatMap((i) => lookup.rows[i] ?? [])
        .filter(
          (r) =>
            !labels ||
            (r.label?.status === "value" && labels.has(r.label.raw_bits)),
        )
    : [...labels]
        .flatMap((label) => lookup.byLabel.get(label) ?? [])
        .sort((a, b) => a.index - b.index);
  return { rows, prefix: caseOffsets(rows) };
}
function firstCaseAt(prefix, offset) {
  let low = 0,
    high = prefix.length - 1;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (prefix[mid + 1] <= offset) low = mid + 1;
    else high = mid;
  }
  return low;
}
function casePage(sw, selected, start, end) {
  const { id, block } = sw;
  const items = [];
  for (
    let i = firstCaseAt(selected.prefix, start);
    i < selected.rows.length && selected.prefix[i] < end;
    i++
  ) {
    const r = selected.rows[i],
      case_id = `${id}:case:${r.index}`;
    const begin = Math.max(0, start - selected.prefix[i]);
    const finish = Math.min(
      Math.max(1, r.edges.length),
      end - selected.prefix[i],
    );
    for (let j = begin; j < finish; j++) {
      const edge = r.edges[j] ?? null;
      items.push({
        id: `${case_id}:edge:${edge?.index ?? "unknown"}`,
        case_id,
        switch: id,
        block,
        case_index: r.index,
        label: r.label,
        recovered_target: r.recovered_target,
        edge,
      });
    }
  }
  return items;
}
function selectedCaseCoverage(seeds, summaries) {
  return seeds.flatMap((id) => {
    const sw = summaries.get(id),
      t = sw?.table;
    return sw
      ? [
          {
            id,
            table_available: t !== null,
            partial: t?.partial ?? null,
            case_count: t?.case_count ?? null,
            relation_count: t?.relation_count ?? null,
            mapping_count: t?.mapping_count ?? null,
            known_label_count: t?.known_label_count ?? null,
            missing_label_count: t?.missing_label_count ?? null,
            no_label_count: t?.no_label_count ?? null,
            unmapped_row_count: t?.unmapped_row_count ?? null,
          },
        ]
      : [];
  });
}
function readCases(index, coverage, input) {
  const seeds = [...new Set(input.seeds)],
    labels = input.case_values && new Set(input.case_values),
    indices =
      input.case_indices &&
      [...new Set(input.case_indices)].sort((a, b) => a - b),
    offset = input.offset ?? 0,
    limit = input.limit ?? 20,
    items = [];
  let total = 0;
  for (const id of seeds) {
    const lookup = index.cases.get(id);
    if (!lookup) continue;
    const selected = selectCaseRows(lookup, labels, indices),
      count = selected.prefix.at(-1);
    const start = Math.max(0, offset - total),
      end = Math.min(count, offset + limit - total);
    if (start < end)
      items.push(...casePage(index.summaries.get(id), selected, start, end));
    total += count;
  }
  return {
    items,
    total,
    next_offset: offset + limit < total ? offset + limit : null,
    unretained_seeds: seeds.filter((id) => !index.switches.has(id)),
    coverage,
    relation_coverage: {
      scope:
        "one relation per captured case/out-edge; an unmapped case has one explicit unknown-edge row; not all feasible runtime cases",
      switches: selectedCaseCoverage(seeds, index.summaries),
    },
  };
}

export function createSwitchViews(facts, index) {
  const coverage = freezeFacts({
    ...facts.coverage,
    case_identity:
      "snapshot + switch operation + native address-table row index",
    relation_identity:
      "case_id + native out-edge index, or one explicit unknown-edge row",
    label_authority:
      "native recovered label and explicit reserved-no-label status; row/edge indexes are not label values",
    selector_authority:
      "native current BRANCHIND input; may be a normalized selector rather than a machine jump address",
    target_authority:
      "native address-table target and separate recovered out-edge mapping; optimized block origins may differ",
    default_authority:
      "native model default out-edge, not necessarily a machine out-of-range guard destination",
    signedness: "signed_render_hint is only a native rendering hint",
    runtime_feasibility: "unknown",
    memory_alias_dependencies: "unknown",
  });
  const tables = [...index.summaries.values()].map((s) => s.table);
  const summary = freezeFacts({
    count: index.switches.size,
    table_count: tables.filter(Boolean).length,
    partial_table_count: tables.filter((t) => t?.partial).length,
    case_count: tables.reduce((n, t) => n + (t?.case_count ?? 0), 0),
    relation_count: tables.reduce((n, t) => n + (t?.relation_count ?? 0), 0),
    coverage,
  });
  return {
    summary,
    switches: (input) => ({
      ...readNativeIdentities(
        index.summaries,
        input,
        (sw) =>
          !input.origin_addresses ||
          input.origin_addresses.includes(sw.origin_address),
      ),
      coverage,
    }),
    cases: (input) => readCases(index, coverage, input),
  };
}
