// One named contract registry shared by SDK, CLI, direct MCP and Code Mode.
import { z } from "zod";
import { KunaFactOwner } from "./provider.mjs";
import { FactFailure } from "./fact-error.mjs";
import { MAX_BYTE_BATCH_BYTES } from "./limits.mjs";
import { createReference } from "./reference.mjs";

const hex = z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u);
const snapshot = z.string().startsWith("snap_");
const byteWindow = z.strictObject({
  address: hex,
  length: z.number().int().min(1).max(MAX_BYTE_BATCH_BYTES).default(256),
});
const page = {
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(128).default(20),
};
const kinds = z.enum([
  "value",
  "load",
  "store",
  "phi",
  "call",
  "branch",
  "switch",
  "return",
]);
const fields = z
  .array(
    z.enum([
      "kind",
      "statement",
      "definitions",
      "constants",
      "opcode",
      "inputs",
      "output",
      "is_dead",
      "input_count",
      "definition_count",
      "constant_count",
    ]),
  )
  .optional();
const definition = (description, input, method, example) => ({
  description,
  input: z.strictObject(input),
  method,
  example,
});
const operationSeeds = z.array(z.string()).min(1).max(128);
const relationInput = z.discriminatedUnion("kind", [
  z.strictObject({
    snapshot,
    kind: z.literal("operands"),
    seeds: operationSeeds,
    input_indices: z.array(z.number().int().nonnegative()).max(128).optional(),
    ...page,
  }),
  z.strictObject({
    snapshot,
    kind: z.enum(["definitions", "uses"]),
    seeds: operationSeeds,
    ...page,
  }),
  z.strictObject({
    snapshot,
    kind: z.enum(["incoming", "outgoing", "controllers"]),
    seeds: z.array(z.number().int().nonnegative()).min(1).max(128),
    ...page,
  }),
]);
export const methods = {
  functions: definition(
    "Search retained native callable entries by literal name/alias, exact name, or entry addresses. Names can match several entries, including PLT/import stubs and implementations; preserve all matches and select by address. A name does not establish runtime symbol binding.",
    {
      query: z.string().default(""),
      exact: z.boolean().default(false),
      case_sensitive: z.boolean().default(true),
      addresses: z.array(hex).max(128).optional(),
      fields: z.array(z.enum(["name", "aliases", "size"])).optional(),
      ...page,
    },
    "functions",
    'await rea.functions({query:"format_error",exact:true})',
  ),
  strings: definition(
    "Search retained string inventory by literal text. Paging does not establish artifact completeness.",
    { query: z.string(), ...page },
    "strings",
    'await rea.strings({query:"incorrect header check"})',
  ),
  references: definition(
    "Batch incoming or outgoing lifted-code references without decompilation. Address scope selects exact target (incoming) or source instruction (outgoing); function scope selects outgoing native owning-function references and requires an entry address. Unknown function applicability stays unknown. Kind filtering is pushed to the native query; source rows, endpoints and Evidence identity remain. Recovered IR calls are a separate representation and may omit machine calls. Interior string references require a separate extent query.",
    {
      addresses: z.array(hex).min(1).max(16),
      direction: z.enum(["incoming", "outgoing"]).default("incoming"),
      scope: z.enum(["address", "function"]).default("address"),
      kinds: z
        .array(z.enum(["call", "jump", "data", "read", "write"]))
        .min(1)
        .optional(),
      fields: z
        .array(z.enum(["fromFunction", "toFunction", "instruction"]))
        .optional(),
      ...page,
    },
    "references",
    'await rea.references({addresses:["0x2000"]})',
  ),
  snapshot: definition(
    "Analyze an explicit function entry once; return a retained capture handle, facets and coverage. Reuses the source within this target lease. Code, recovered calls and values remain independently available when full recovered IR exceeds capacity. A bounded call-rooted operation/definition projection may also be available; inspect facets.operations and coverage before reads. CFG queries still require the complete recovered graph. Available calls include compact by_opcode counts of known/unknown targets over the whole retained call facet; no paging is needed for these counts. Selected calls and complete Evidence remain readable.",
    { entry: hex },
    "snapshot",
    'await rea.snapshot({entry:"0x1000"})',
  ),
  bytes: definition(
    "Read selected native loaded-image bytes without instruction decoding. Batch up to 16 exact virtual-address windows and 64 KiB total selected bytes; hex uses twice that space before provenance. Short reads remain partial. These are not live process memory or an original-file-offset mapping. Global code discovery is not performed.",
    {
      windows: z.array(byteWindow).min(1).max(16),
    },
    "bytes",
    'await rea.bytes({windows:[{address:"0x2000",length:32}]})',
  ),
  instructions: definition(
    "Batch selected machine instruction windows. Read exact bytes and native disassembly to verify actual control transfers; optimized recovered CFG edges can bypass machine blocks. Address+size with the artifact context identifies the byte range. A caller-selected decode start does not prove execution/alignment.",
    {
      windows: z
        .array(
          z.strictObject({
            address: hex,
            count: z.number().int().min(1).max(4096).default(16),
          }),
        )
        .min(1)
        .max(16),
      fields: z
        .array(z.enum(["bytes", "text", "mnemonic", "operands"]))
        .optional(),
    },
    "instructions",
    'await rea.instructions({windows:[{address:"0x1000",count:8}],fields:["bytes","text"]})',
  ),
  operations: definition(
    "Select SSA operations by IDs, source instruction origins, block IDs, constant literal or kind. Native default rows are compact summaries: opcode/kind/output and input/definition/constant counts; request detailed fields explicitly or page input slots via relations kind:operands. Filters intersect; identities and native is_dead are retained. Availability may be a complete recovered graph or a bounded call-rooted projection; inspect coverage before inferring absence. A literal match is not object identity. origin_addresses selects optimized recovered IR origins; use instructions for actual machine control transfers.",
    {
      snapshot,
      ids: z.array(z.string()).max(128).optional(),
      origin_addresses: z.array(hex).max(128).optional(),
      block_ids: z.array(z.number().int().nonnegative()).max(128).optional(),
      constant: hex.optional(),
      kind: kinds.optional(),
      fields,
      ...page,
    },
    "operations",
    'await rea.operations({snapshot:s,constant:"0x2000",fields:["statement"]})',
  ),
  relations: {
    description:
      "Read native operands or definitions/uses for operation IDs, incoming/outgoing CFG edges or derived controllers for block IDs. operands pages every selected input slot, including constants, function inputs and null slots; input_indices optionally selects slots in caller order. Identity is snapshot + operation + input_index; value_id/definition and exact phi predecessor/edge bindings remain separate. Out-of-range slots of retained operations are absent; unretained_seeds remain unknown. A bounded call-rooted projection supports operands/definitions/uses but no CFG; uses cover retained selected operations only. Diagnostic SSA lacks native operands and has partial CFG/printed occurrences. controllers requires a complete recovered graph and concerns finite paths to recovered exits, not runtime feasibility.",
    input: relationInput,
    method: "relations",
    example:
      'await rea.relations({snapshot:s,kind:"operands",seeds:[op.id],input_indices:[0,2]})',
  },
  values: definition(
    "Read identified native SSA values in a batch; scope may be a full graph, bounded call-rooted definition projection, or call-boundary values only; is_input filters retained operand/output values, not an original source signature. Offset is an address-space offset, not a computed arbitrary-width value. Width, constants, function inputs, annotation status and defining operation are separate facts. Requires the pinned native exporter.",
    {
      snapshot,
      ids: z.array(z.string()).max(128).optional(),
      is_input: z.boolean().optional(),
      fields: z
        .array(
          z.enum([
            "space",
            "offset",
            "size_bytes",
            "is_constant",
            "is_input",
            "is_annotation",
            "definition",
            "type_name",
          ]),
        )
        .optional(),
      ...page,
    },
    "values",
    "await rea.values({snapshot:s,ids:op.inputs.map(i=>i.value_id).filter(Boolean)})",
  ),
  calls: definition(
    "Select structured recovered call sites and argument bindings. Target comes from native call specifications, never the fspec annotation offset or display text. Each argument separates its SSA value from its passing storage. Calls and their boundary values survive full graph capacity failure. target_value_id retains input zero independently of target resolution; it may be an fspec annotation or an unresolved indirect target value. A null output describes this recovered operation, not proof of a void source signature. Input slots are not original source parameter ordinals; missing storage and indirect/runtime targets remain unknown. To investigate across functions, snapshot the selected callee and select values with is_input:true, comparing exact space/offset/width. Requires the pinned native exporter.",
    {
      snapshot,
      ids: z.array(z.string()).max(128).optional(),
      origin_addresses: z.array(hex).max(128).optional(),
      fields: z
        .array(
          z.enum([
            "target",
            "target_name",
            "arguments",
            "output",
            "prototype",
            "stack_offset",
            "target_value_id",
            "is_dead",
          ]),
        )
        .optional(),
      ...page,
    },
    "calls",
    'await rea.calls({snapshot:s,origin_addresses:["0x1100"]})',
  ),
  blocks: definition(
    "Read native recovered blocks by stable snapshot-local ID, with ordered predecessors, successor edges and member operation IDs. origin_start describes optimized IR provenance, not a machine block extent. Requires an available native recovered IR graph. Runtime successors remain unknown.",
    {
      snapshot,
      ids: z.array(z.number().int().nonnegative()).max(128).optional(),
      fields: z
        .array(
          z.enum(["origin_start", "operations", "predecessors", "successors"]),
        )
        .optional(),
      ...page,
    },
    "blocks",
    "await rea.blocks({snapshot:s,ids:[op.block]})",
  ),
  slice: definition(
    "Compose a bounded backward definition traversal from explicit operation IDs. Native default operation rows are compact summaries; request detailed fields or use paged operand relations for wide nodes. Available over a complete recovered graph or bounded call-rooted projection. Missing defining bodies retain frontier reasons; complete use sets and CFG are unavailable for a projection. Default load/phi cutoffs keep boundaries visible; choose stop_kinds:[] to traverse beyond them. Complete reachability and memory aliases remain unknown.",
    {
      snapshot,
      seeds: z.array(z.string()).min(1).max(64),
      max_operations: z.number().int().min(1).max(256).default(48),
      stop_at: z.array(z.string()).max(128).default([]),
      stop_kinds: z.array(kinds).default(["phi", "load"]),
      fields,
    },
    "slice",
    'await rea.slice({snapshot:s,seeds:callIds,stop_kinds:["load"],fields:["opcode","inputs","output","constants"]})',
  ),
  code: definition(
    "Read reconstructed code from the same retained function capture, even when its graph facet is unavailable. offset is zero-based. A large limit reads the complete code inside Code Mode for local filtering. The bridge byte budget bounds the result. No additional decompilation.",
    {
      snapshot,
      offset: page.offset,
      limit: z.number().int().positive().default(64),
    },
    "code",
    "await rea.code({snapshot:s,offset:100,limit:64})",
  ),
  evidence: definition(
    "Read complete retained native source in UTF-16-code-unit pages by evidence_id; no reanalysis. component:source preserves exact original wire JSON. component:recovered_ir reads the decoded graph source, including lossless compressed graphs; source hash remains the original capture and view has its own hash/byte count. This is source inspection, not a claim that malformed graph facts are valid. Available until close_binary.",
    {
      evidence_id: z.string().startsWith("ev_"),
      component: z.enum(["source", "recovered_ir"]).default("source"),
      offset: page.offset,
      limit: z.number().int().min(1).max(16384).default(4096),
    },
    "evidence",
    "await rea.evidence({evidence_id:id,offset:0,limit:4096})",
  ),
};

methods.bytes.input = methods.bytes.input.superRefine((value, context) => {
  // Pattern failures need not prevent object refinements from running in Zod.
  // Only the named window contract may admit values to exact u64 arithmetic.
  const windows = value.windows.flatMap((window) => {
    const parsed = byteWindow.safeParse(window);
    return parsed.success ? [parsed.data] : [];
  });
  if (
    windows.reduce((sum, window) => sum + window.length, 0) >
    MAX_BYTE_BATCH_BYTES
  )
    context.addIssue({
      code: "custom",
      path: ["windows"],
      message:
        "Select at most 64 KiB of bytes per batch; use additional windows/pages in later calls",
    });
  if (
    windows.some(
      (window) =>
        BigInt(window.address) + BigInt(window.length) > 0xffffffffffffffffn,
    )
  )
    context.addIssue({
      code: "custom",
      path: ["windows"],
      message: "Byte range end exceeds the native u64 address format",
    });
});
methods.references.input = methods.references.input.superRefine(
  (value, context) => {
    if (value.direction === "incoming" && value.scope !== "address")
      context.addIssue({
        code: "custom",
        path: ["scope"],
        message: "Incoming references require exact address scope",
      });
  },
);
export class AtomicSession {
  #owner;
  #tail = Promise.resolve();
  constructor(factory = KunaFactOwner.open) {
    this.factory = factory;
  }
  #admit(work) {
    const pending = this.#tail.then(work, work);
    this.#tail = pending.catch(() => {});
    return pending;
  }
  get context() {
    return this.#owner?.context ?? null;
  }
  abort() {
    this.#owner?.cancel();
  }
  open(path) {
    return this.#admit(async () => {
      if (this.#owner) await this.#owner.close();
      this.#owner = undefined;
      this.#owner = await this.factory(path);
      return {
        ok: true,
        context: this.context,
        methods: Object.keys(methods),
        evidence_lifetime: "current target lease",
      };
    });
  }
  close() {
    return this.#admit(async () => {
      if (this.#owner) await this.#owner.close();
      this.#owner = undefined;
      return { ok: true, closed: true };
    });
  }
  call(
    name,
    input,
    signal = new AbortController().signal,
    lease = this.context?.lease,
  ) {
    return this.#admit(async () => {
      try {
        if (signal.aborted)
          throw new FactFailure(
            "cancelled",
            "Request was cancelled before admission",
          );
        if (!this.#owner)
          throw new FactFailure(
            "no_target",
            "Call open_binary before analysis",
          );
        if (lease !== this.context.lease)
          throw new FactFailure(
            "stale_context",
            "Target lease changed; do not join facts across leases",
          );
        if (!Object.hasOwn(methods, name))
          throw new FactFailure(
            "unknown_method",
            `Unknown API method: ${name}`,
          );
        const contract = methods[name];
        const parsed = contract.input.parse(input);
        const data = await this.#owner[contract.method](parsed, signal);
        if (signal.aborted)
          throw new FactFailure(
            "cancelled",
            "Request was cancelled after observations were collected",
            { partial_observation: data },
          );
        return { ok: true, context: this.context, data };
      } catch (error) {
        return {
          ok: false,
          context: this.context,
          error: {
            code:
              error instanceof z.ZodError
                ? "invalid_input"
                : (error.code ?? "analysis_failed"),
            message: error.message,
            details: error.details ?? {},
          },
        };
      }
    });
  }
}

export const reference = createReference(methods);
