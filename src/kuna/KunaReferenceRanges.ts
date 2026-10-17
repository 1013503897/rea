// Paged native range batches: query identity and coverage stay with their owner.
import { createHash } from "node:crypto";
import { z } from "zod";
import { err, ok } from "../domain/result.js";
import { parseKunaJson } from "./KunaJson.js";
import { KUNA_XREF_OUTPUT_BYTES } from "./KunaLimits.js";
import {
  kunaReferenceAddressKeys,
  kunaReferenceAddressSchema as address,
  kunaReferenceCountSchema as count,
  kunaReferenceKindSchema,
  kunaReferenceRowSchema,
  validateKunaReferenceRow,
  kunaReferenceFact,
  type KunaReferenceFact,
} from "./KunaReferenceRows.js";

const span = z.strictObject({ start: address, end_inclusive: address });
const metadata = span.extend({
  index: count,
  offset: count,
  limit: count.min(1).max(128),
  total: count,
  count,
  next_offset: count.nullable(),
});
const wire = z.object({
  schema_version: z.literal(1),
  binary: z.string(),
  direction: z.literal("to"),
  ranges: z.array(metadata).min(1).max(16),
  count,
  xrefs: z.array(kunaReferenceRowSchema.extend({ range_index: count })),
});
export interface KunaReferenceRangeQuery {
  readonly ranges: readonly z.infer<typeof span>[];
  readonly offset: number;
  readonly limit: number;
  readonly kinds?: readonly z.infer<typeof kunaReferenceKindSchema>[];
}
export interface KunaReferenceRangePage {
  readonly range: z.infer<typeof span>;
  readonly range_index: number;
  readonly total: number;
  readonly next_offset: number | null;
  readonly facts: readonly KunaReferenceFact[];
}

type NativeRangeDocument = z.infer<typeof wire>;
type ParsedPage = {
  metadata: z.infer<typeof metadata>;
  facts: KunaReferenceFact[];
  keys: Set<string>;
};
const readPages = (
  entries: NativeRangeDocument["ranges"],
  query: KunaReferenceRangeQuery,
) => {
  const pages = new Map<number, ParsedPage>();
  for (const meta of entries) {
    const expected = query.ranges[meta.index];
    if (
      pages.has(meta.index) ||
      expected === undefined ||
      meta.start !== expected.start ||
      meta.end_inclusive !== expected.end_inclusive ||
      BigInt(meta.start) > BigInt(meta.end_inclusive) ||
      meta.offset !== query.offset ||
      meta.limit !== query.limit
    )
      throw new Error("xref range metadata is not bound to the selected query");
    const selected = Math.min(
      meta.limit,
      Math.max(0, meta.total - meta.offset),
    );
    if (
      meta.count !== selected ||
      meta.next_offset !==
        (meta.offset + selected < meta.total ? meta.offset + selected : null)
    )
      throw new Error("xref range pagination contradicts examined coverage");
    pages.set(meta.index, { metadata: meta, facts: [], keys: new Set() });
  }
  return pages;
};
const readRows = (
  rows: NativeRangeDocument["xrefs"],
  pages: Map<number, ParsedPage>,
  kinds: KunaReferenceRangeQuery["kinds"],
) => {
  for (const [source_row, raw] of rows.entries()) {
    const row = validateKunaReferenceRow(raw, "to"),
      page = pages.get(row.range_index);
    if (
      page === undefined ||
      BigInt(row.to_address) < BigInt(page.metadata.start) ||
      BigInt(row.to_address) > BigInt(page.metadata.end_inclusive) ||
      (kinds !== undefined && !kinds.includes(row.kind))
    )
      throw new Error("xref row violates selected range or kind scope");
    const key = JSON.stringify([row.from_address, row.to_address, row.kind]);
    if (page.keys.has(key))
      throw new Error("xref range page repeats an occurrence");
    page.keys.add(key);
    page.facts.push(kunaReferenceFact(row, source_row));
  }
};

export const parseKunaReferenceRanges = (
  text: string,
  input: string,
  query: KunaReferenceRangeQuery,
) => {
  try {
    const document = wire.parse(
      parseKunaJson(text, KUNA_XREF_OUTPUT_BYTES, kunaReferenceAddressKeys),
    );
    if (
      document.binary !== input ||
      document.count !== document.xrefs.length ||
      document.ranges.length !== query.ranges.length
    )
      throw new Error(
        "xref range document has foreign input or inconsistent counts",
      );
    const pages = readPages(document.ranges, query);
    readRows(document.xrefs, pages, query.kinds);
    const results: KunaReferenceRangePage[] = query.ranges.map(
      (range, index) => {
        const page = pages.get(index);
        if (page === undefined || page.facts.length !== page.metadata.count)
          throw new Error("xref range page is missing declared observations");
        return {
          range: { ...range },
          range_index: index,
          total: page.metadata.total,
          next_offset: page.metadata.next_offset,
          facts: page.facts,
        };
      },
    );
    return ok({
      results,
      bytes: Buffer.byteLength(text),
      sha256: createHash("sha256").update(text).digest("hex"),
    });
  } catch (cause: unknown) {
    return err(cause instanceof Error ? cause.message : String(cause));
  }
};
