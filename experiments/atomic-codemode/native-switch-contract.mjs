// Native switch framing/rows are admitted independently of graph and calls.
import { z } from "zod";
import {
  hex,
  ordinal,
  edgeId,
  operationId,
  value,
  rowParser,
  readNativeFacet,
  requireFact,
} from "./native-contract.mjs";

const edge = z.strictObject({ id: edgeId, index: ordinal, target: ordinal });
const location = z.strictObject({ space: z.string(), offset: hex });
const row = z.strictObject({
  index: ordinal,
  label: z
    .strictObject({ status: z.enum(["value", "no-label"]), raw_bits: hex })
    .nullable(),
  recovered_target: location.nullable(),
  edges: z.array(edge),
});
const table = z.strictObject({
  partial: z.boolean(),
  labelled: z.boolean(),
  consumed_mask: hex,
  signed_render_hint: z.boolean(),
  default_raw_index: z.number().int().min(-1).max(0x7fffffff),
  default_edge: edge.nullable(),
  default_is_folded: z.boolean(),
  rows: z.array(row),
});
const item = z.strictObject({
  id: operationId,
  origin_address: hex,
  block: ordinal,
  selector: value.nullable(),
  table: table.nullable(),
});
const facet = z.strictObject({
  schema_version: z.literal(1),
  items: z.array(item).max(12000),
  coverage: z.strictObject({
    scope: z.string(),
    blocks_examined: ordinal.min(1),
    operations_examined: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    machine_semantic_equivalence: z.literal("unknown"),
  }),
});
const parseTable = rowParser(table, {
  rows: rowParser(row, { edges: (v) => edge.parse(v) }),
});
const parseItem = rowParser(
  item,
  {},
  { table: (v) => (v === null ? null : parseTable(v)) },
);
const parseFacet = rowParser(facet, { items: parseItem });

export const readSwitchFacet = (fn) =>
  readNativeFacet(fn, "atomic_switches", "recovered switches", (raw) => {
    requireFact(
      raw?.schema_version === 1,
      "Unsupported native switch facet schema; expected 1",
    );
    requireFact(
      Array.isArray(raw.items) && raw.items.length <= 12000,
      "Native switch count exceeds capacity or has invalid shape",
    );
    let rows = 0,
      mappings = 0,
      text = 0;
    for (const item of raw.items) {
      for (const s of [item?.selector?.space, item?.selector?.type_name])
        if (typeof s === "string") text += Buffer.byteLength(s);
      if (item?.table === null) continue;
      requireFact(
        Array.isArray(item?.table?.rows),
        "Native switch rows must be an array",
      );
      rows += item.table.rows.length;
      requireFact(rows <= 100000, "Native switch rows exceed capacity");
      for (const row of item.table.rows) {
        requireFact(
          Array.isArray(row?.edges),
          "Native case edges must be an array",
        );
        mappings += row.edges.length;
        requireFact(
          mappings <= 100000,
          "Native switch mappings exceed capacity",
        );
        if (typeof row?.recovered_target?.space === "string")
          text += Buffer.byteLength(row.recovered_target.space);
      }
    }
    requireFact(text <= 2 * 1024 * 1024, "Native switch text exceeds capacity");
    return parseFacet(raw);
  });
