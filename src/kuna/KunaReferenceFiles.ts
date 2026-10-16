import { createHash } from "node:crypto";

import { z } from "zod";

import type { AnalysisError } from "../domain/analysisErrorBase.js";
import { err, ok, type Result } from "../domain/result.js";
import { compareKunaAddresses } from "./KunaAddress.js";
import { parseKunaJson } from "./KunaJson.js";
import { KunaJsonDocumentReader, parseKunaRow } from "./KunaJsonStream.js";

/** The raw xref budget also bounds its materialized rows. */
export const KUNA_XREF_OUTPUT_BYTES = 16 * 1024 * 1024;

const addressKeys = new Set(["address", "from_address", "to_address"]);
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

const fieldsOf = (schema: z.ZodObject, excluded: readonly string[]) =>
  new Set(Object.keys(schema.shape).filter((key) => !excluded.includes(key)));

const GRAPH_DOCUMENT = {
  header: new Set(["schemaVersion"]),
  sections: new Map([
    ["binary", new Set(Object.keys(graphHeader.shape.binary.shape))],
  ]),
  rows: new Map([
    [
      "functions",
      {
        fields: fieldsOf(graphNode, [
          "address",
          "forwardsTo",
          "codeC",
          "assembly",
          "error",
        ]),
        addresses: new Set(["address", "forwardsTo"]),
        empty: new Set<string>(),
        // `--functions ''` requests no bodies; one is refused unassembled.
        nulls: new Set(["codeC", "assembly", "error"]),
      },
    ],
    [
      "edges",
      {
        fields: fieldsOf(graphEdge, ["callerAddress", "calleeAddress"]),
        addresses: new Set(["callerAddress", "calleeAddress"]),
        empty: new Set<string>(),
        nulls: new Set<string>(),
      },
    ],
  ]),
};

/**
 * Validates `kuna decompile-graph --functions ''` as Kuna writes it and
 * retains only the facts call queries use.
 */
export class KunaCallGraphReader extends KunaJsonDocumentReader<KunaCallGraph> {
  readonly #nodes = new Map<string, KunaGraphNode>();
  /** Callees of every edge by caller, which also detects repeated edges. */
  readonly #targets = new Map<string, Set<string>>();
  /** Callee orders by caller; each caller's must be 0..n-1. */
  readonly #orders = new Map<string, Set<number>>();
  readonly #callers = new Map<string, string[]>();
  readonly #callees = new Map<string, string[]>();
  #edgeCount = 0;
  #hasIndirectCalls = false;

  constructor() {
    super("kuna:call-graph", "Kuna's call graph", GRAPH_DOCUMENT);
  }

  override finish(input: string): Result<KunaCallGraph, AnalysisError> {
    const completed = this.complete();
    if (!completed.ok) return completed;
    const header = graphHeader.safeParse(completed.value.header);
    if (!header.success)
      return err(this.unusable("the graph header is not Kuna's schema 4"));
    if (header.data.binary.sourcePath !== input)
      return err(this.unusable("graph names a different input"));
    if (
      header.data.binary.functionCount !== this.#nodes.size ||
      header.data.binary.edgeCount !== this.#edgeCount
    )
      return err(this.unusable("graph counts disagree with examined rows"));
    const invalid = this.#invalidEdges();
    // These indexes only validate edges; queries never read them.
    this.#targets.clear();
    this.#orders.clear();
    if (invalid !== undefined) return err(this.unusable(invalid));
    for (const index of [this.#callers, this.#callees])
      for (const list of index.values()) list.sort(compareKunaAddresses);
    return ok({
      nodes: this.#nodes,
      callers: this.#callers,
      callees: this.#callees,
      edgeCount: this.#edgeCount,
      hasIndirectCalls: this.#hasIndirectCalls,
      bytes: completed.value.bytes,
      sha256: completed.value.sha256,
    });
  }

  protected override acceptRow(
    member: string,
    fields: Readonly<Record<string, unknown>>,
  ): void {
    if (member === "edges") {
      this.#index(parseKunaRow(graphEdge, "graph edge", fields));
      return;
    }
    const node = parseKunaRow(graphNode, "graph function", fields);
    if (this.#nodes.has(node.address))
      throw new Error("graph repeats a function address");
    this.#nodes.set(node.address, node);
    this.#hasIndirectCalls ||= node.hasIndirectCalls;
  }

  protected override discardRows(): void {
    for (const index of [
      this.#nodes,
      this.#targets,
      this.#orders,
      this.#callers,
      this.#callees,
    ])
      index.clear();
  }

  /**
   * Index one edge as it arrives, so the working set grows under the row
   * admission instead of after it; endpoints are checked once every node is
   * known.
   */
  #index(edge: z.infer<typeof graphEdge>): void {
    const { callerAddress: caller, calleeAddress: callee } = edge;
    this.#edgeCount += 1;
    const targets = this.#targets.get(caller) ?? new Set<string>();
    if (targets.has(callee)) throw new Error("graph repeats an edge");
    targets.add(callee);
    this.#targets.set(caller, targets);
    const order = this.#orders.get(caller) ?? new Set<number>();
    if (order.has(edge.calleeOrder))
      throw new Error("graph repeats a callee order");
    order.add(edge.calleeOrder);
    this.#orders.set(caller, order);
    if (edge.kind !== "call") return;
    const incoming = this.#callers.get(callee) ?? [];
    incoming.push(caller);
    this.#callers.set(callee, incoming);
    const outgoing = this.#callees.get(caller) ?? [];
    outgoing.push(callee);
    this.#callees.set(caller, outgoing);
  }

  /** Why the edges contradict the nodes, if they do. */
  #invalidEdges(): string | undefined {
    for (const [caller, targets] of this.#targets) {
      if (!this.#nodes.has(caller)) return "graph edge has an unknown endpoint";
      for (const callee of targets)
        if (!this.#nodes.has(callee))
          return "graph edge has an unknown endpoint";
    }
    for (const order of this.#orders.values())
      for (let index = 0; index < order.size; index += 1)
        if (!order.has(index)) return "graph callee orders are incomplete";
    return undefined;
  }
}

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
