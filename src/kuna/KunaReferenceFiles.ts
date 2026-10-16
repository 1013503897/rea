import { createHash } from "node:crypto";

import { z } from "zod";

import { err, ok, type Result } from "../domain/result.js";
import { compareKunaAddresses } from "./KunaAddress.js";
import { parseKunaJson } from "./KunaJson.js";

/** Raw JSON budgets also bound the materialized indexes; no decompiled bodies are admitted. */
export const KUNA_GRAPH_OUTPUT_BYTES = 32 * 1024 * 1024;
export const KUNA_XREF_OUTPUT_BYTES = 16 * 1024 * 1024;

const addressKeys = new Set([
  "address",
  "callerAddress",
  "calleeAddress",
  "forwardsTo",
  "from_address",
  "to_address",
]);
const address = z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const kind = z.enum(["call", "jump", "data", "read", "write"]);

const graphHeader = z.object({
  schemaVersion: z.literal(4),
  binary: z.object({
    sourcePath: z.string(),
    functionCount: count,
    edgeCount: count,
  }),
  functions: z.array(z.unknown()),
  edges: z.array(z.unknown()),
});
const graphNode = z.object({
  address,
  name: z.string().min(1),
  kind: z.string().min(1),
  hasIndirectCalls: z.boolean(),
  forwardsTo: address.nullable(),
  codeC: z.null(),
  assembly: z.null(),
  error: z.null(),
});
const graphEdge = z.object({
  callerAddress: address,
  calleeAddress: address,
  kind,
  calleeOrder: count,
});

export type KunaGraphNode = z.infer<typeof graphNode>;
export interface KunaCallGraph {
  readonly sha256: string;
  readonly bytes: number;
  readonly edgeCount: number;
  readonly hasIndirectCalls: boolean;
  readonly nodes: ReadonlyMap<string, KunaGraphNode>;
  readonly callers: ReadonlyMap<string, readonly string[]>;
  readonly callees: ReadonlyMap<string, readonly string[]>;
}

/** Validate once at the producer boundary and retain only facts used by queries. */
export const parseKunaCallGraph = (
  text: string,
  input: string,
): Result<KunaCallGraph, string> => {
  try {
    const header = graphHeader.parse(
      parseKunaJson(text, KUNA_GRAPH_OUTPUT_BYTES, addressKeys),
    );
    if (header.binary.sourcePath !== input)
      throw new Error("graph names a different input");
    if (
      header.binary.functionCount !== header.functions.length ||
      header.binary.edgeCount !== header.edges.length
    )
      throw new Error("graph counts disagree with examined rows");
    const nodes = new Map<string, KunaGraphNode>();
    let hasIndirectCalls = false;
    for (const raw of header.functions) {
      const node = graphNode.parse(raw);
      if (nodes.has(node.address))
        throw new Error("graph repeats a function address");
      nodes.set(node.address, node);
      hasIndirectCalls ||= node.hasIndirectCalls;
    }
    const callers = new Map<string, string[]>();
    const callees = new Map<string, string[]>();
    const pairs = new Set<string>();
    const orders = new Map<string, Set<number>>();
    for (const raw of header.edges) {
      const edge = graphEdge.parse(raw);
      if (!nodes.has(edge.callerAddress) || !nodes.has(edge.calleeAddress))
        throw new Error("graph edge has an unknown endpoint");
      const pair = `${edge.callerAddress}:${edge.calleeAddress}`;
      if (pairs.has(pair)) throw new Error("graph repeats an edge");
      pairs.add(pair);
      const order = orders.get(edge.callerAddress) ?? new Set<number>();
      if (order.has(edge.calleeOrder))
        throw new Error("graph repeats a callee order");
      order.add(edge.calleeOrder);
      orders.set(edge.callerAddress, order);
      if (edge.kind !== "call") continue;
      const incoming = callers.get(edge.calleeAddress) ?? [];
      incoming.push(edge.callerAddress);
      callers.set(edge.calleeAddress, incoming);
      const outgoing = callees.get(edge.callerAddress) ?? [];
      outgoing.push(edge.calleeAddress);
      callees.set(edge.callerAddress, outgoing);
    }
    for (const order of orders.values())
      for (let index = 0; index < order.size; index += 1)
        if (!order.has(index))
          throw new Error("graph callee orders are incomplete");
    for (const list of [...callers.values(), ...callees.values()])
      list.sort(compareKunaAddresses);
    return ok({
      nodes,
      callers,
      callees,
      edgeCount: header.edges.length,
      hasIndirectCalls,
      bytes: Buffer.byteLength(text),
      sha256: createHash("sha256").update(text).digest("hex"),
    });
  } catch (cause: unknown) {
    return err(cause instanceof Error ? cause.message : String(cause));
  }
};

const xrefFunction = z.object({
  name: z.string().min(1),
  address,
  address_hex: address,
});
const xrefRow = z.object({
  address,
  address_hex: address,
  kind,
  from_address: address,
  from_address_hex: address,
  to_address: address,
  to_address_hex: address,
  from_function: xrefFunction.nullable(),
  to_function: xrefFunction.nullable(),
  instruction: z.string(),
});
const xrefsDocument = z.object({
  binary: z.string(),
  direction: z.enum(["to", "from"]),
  count,
  target: z.object({
    address,
    address_hex: address,
    name: z.string().nullable(),
    aliases: z.array(xrefFunction),
  }),
  xrefs: z.array(z.unknown()),
});

/** One owning interpretation of native endpoints, identities and alias scope. */
const parseReferenceRow = (
  raw: unknown,
  aliases: ReadonlySet<string>,
  query: KunaReferenceQuery,
) => {
  const row = xrefRow.parse(raw);
  if (
    row.address !== row.address_hex ||
    row.address !==
      (query.direction === "to" ? row.from_address : row.to_address) ||
    row.from_address !== row.from_address_hex ||
    row.to_address !== row.to_address_hex
  )
    throw new Error(
      "xref endpoints disagree with numeric or directional fields",
    );
  for (const fn of [row.from_function, row.to_function])
    if (fn !== null && fn.address !== fn.address_hex)
      throw new Error("xref function address disagrees with its hex field");
  if (query.direction === "to" && !aliases.has(row.to_address))
    throw new Error(
      "xref row targets neither the requested address nor an advertised alias",
    );
  if (
    query.direction === "from" &&
    row.from_address !== query.address &&
    row.from_function?.address !== query.address
  )
    throw new Error(
      "outgoing xref has no source binding to the requested address or function",
    );
  return row;
};

export interface KunaReferenceAddresses {
  readonly addresses: readonly string[];
  readonly sha256: string;
  readonly bytes: number;
  readonly rows: number;
  readonly excludedAliasRows: number;
}

/** Experimental fact projection, owned by the native protocol parser. */
export type KunaReferenceFact = {
  readonly source_row: number;
  readonly from: string;
  readonly to: string;
  readonly kind: z.infer<typeof kind>;
  readonly fromFunction: {
    readonly address: string;
    readonly name: string;
  } | null;
  readonly toFunction: {
    readonly address: string;
    readonly name: string;
  } | null;
  readonly instruction: string;
};

export type KunaReferenceQuery = (
  | {
      readonly direction: "to";
      readonly scope: "address";
      readonly address: string;
    }
  | {
      readonly direction: "from";
      readonly scope: "address" | "function";
      readonly address: string;
    }
) & { readonly kinds?: readonly z.infer<typeof kind>[] };

export interface KunaReferenceFacts extends KunaReferenceAddresses {
  readonly facts: readonly KunaReferenceFact[];
  readonly excludedScopeRows: number;
  readonly unattributedScopeRows: number;
  readonly functionScope: "established-by-rows" | "unknown" | null;
}

const referenceSelection = (
  row: z.infer<typeof xrefRow>,
  query: KunaReferenceQuery,
) => {
  if (query.direction === "to")
    return row.to_address === query.address ? "selected" : "alias";
  if (query.scope === "address")
    return row.from_address === query.address ? "selected" : "scope";
  if (row.from_function === null) return "unattributed";
  return row.from_function.address === query.address ? "selected" : "scope";
};

const referenceFact = (
  row: z.infer<typeof xrefRow>,
  source_row: number,
): KunaReferenceFact => ({
  source_row,
  from: row.from_address,
  to: row.to_address,
  kind: row.kind,
  fromFunction:
    row.from_function === null
      ? null
      : {
          address: row.from_function.address,
          name: row.from_function.name,
        },
  toFunction:
    row.to_function === null
      ? null
      : {
          address: row.to_function.address,
          name: row.to_function.name,
        },
  instruction: row.instruction,
});

/** One native-format boundary, with caller-selected endpoint/function scope. */
const parseReferenceDocument = (
  text: string,
  input: string,
  query: KunaReferenceQuery,
  retainFacts: boolean,
): Result<KunaReferenceFacts, string> => {
  try {
    const target = query.address;
    const document = xrefsDocument.parse(
      parseKunaJson(text, KUNA_XREF_OUTPUT_BYTES, addressKeys),
    );
    if (
      document.binary !== input ||
      document.direction !== query.direction ||
      document.target.address !== target ||
      document.target.address_hex !== target
    )
      throw new Error("xref document names a different input or target");
    if (document.count !== document.xrefs.length)
      throw new Error("xref count disagrees with examined rows");
    const aliases = new Set([target]);
    for (const alias of document.target.aliases) {
      if (alias.address !== alias.address_hex)
        throw new Error("xref alias address disagrees with its hex field");
      aliases.add(alias.address);
    }
    const addresses = new Set<string>();
    const facts: KunaReferenceFact[] = [];
    const excluded = { alias: 0, scope: 0, unattributed: 0 };
    let functionScope: KunaReferenceFacts["functionScope"] =
      query.scope === "function" ? "unknown" : null;
    for (const [source_row, raw] of document.xrefs.entries()) {
      const row = parseReferenceRow(raw, aliases, query);
      if (query.kinds && !query.kinds.includes(row.kind))
        throw new Error("xref row violates the caller-selected kind filter");
      const selected = referenceSelection(row, query);
      if (selected === "selected") {
        addresses.add(
          query.direction === "to" ? row.from_address : row.to_address,
        );
        if (query.scope === "function") functionScope = "established-by-rows";
        if (retainFacts) facts.push(referenceFact(row, source_row));
      } else excluded[selected] += 1;
    }
    return ok({
      addresses: [...addresses].sort(compareKunaAddresses),
      rows: document.xrefs.length,
      excludedAliasRows: excluded.alias,
      excludedScopeRows: excluded.scope,
      unattributedScopeRows: excluded.unattributed,
      functionScope,
      bytes: Buffer.byteLength(text),
      sha256: createHash("sha256").update(text).digest("hex"),
      facts,
    });
  } catch (cause: unknown) {
    return err(cause instanceof Error ? cause.message : String(cause));
  }
};

export const parseKunaReferenceFacts = (
  text: string,
  input: string,
  query: KunaReferenceQuery,
): Result<KunaReferenceFacts, string> =>
  parseReferenceDocument(text, input, query, true);

/** Existing address-only contract; richer facts do not enter its retained cache. */
export const parseKunaIncomingReferences = (
  text: string,
  input: string,
  target: string,
): Result<KunaReferenceAddresses, string> => {
  const parsed = parseReferenceDocument(
    text,
    input,
    { direction: "to", scope: "address", address: target },
    false,
  );
  if (!parsed.ok) return parsed;
  const { addresses, sha256, bytes, rows, excludedAliasRows } = parsed.value;
  return ok({ addresses, sha256, bytes, rows, excludedAliasRows });
};
