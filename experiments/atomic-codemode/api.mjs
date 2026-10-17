// One named contract registry shared by SDK, CLI, direct MCP and Code Mode.
import { z } from "zod";
import { MAX_BYTE_BATCH_BYTES } from "./limits.mjs";
import { MAX_GRAPH_BLOCKS } from "./graph-limits.mjs";
import { createReference } from "./reference.mjs";
import { definition, hex, page, valueLocation } from "./api-contracts.mjs";
import { storageMethods } from "./storage-contracts.mjs";
import { referencesMethod } from "./reference-contracts.mjs";

const snapshot = z.string().startsWith("snap_");
const byteWindow = z.strictObject({
  address: hex,
  length: z.number().int().min(1).max(MAX_BYTE_BATCH_BYTES).default(256),
});
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
const identitySeeds = z.array(z.string()).min(1).max(128);
const relationInput = z.discriminatedUnion("kind", [
  z.strictObject({
    snapshot,
    kind: z.literal("cases"),
    seeds: identitySeeds,
    case_values: z.array(hex).max(128).optional(),
    case_indices: z.array(z.number().int().nonnegative()).max(128).optional(),
    ...page,
  }),
  z.strictObject({
    snapshot,
    kind: z.literal("operands"),
    seeds: identitySeeds,
    input_indices: z.array(z.number().int().nonnegative()).max(128).optional(),
    ...page,
  }),
  z.strictObject({
    snapshot,
    kind: z.enum(["definitions", "uses", "value_uses"]),
    seeds: identitySeeds,
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
  ...storageMethods,
  switches: definition(
    {
      summary:
        "Select recovered switches/table metadata; fetch cases separately. Native defaults may differ from machine guards.",
      description:
        "Inspect recovered indirect branches and their independent native jump-table metadata, without returning all case rows. Selector is the current recovered BRANCHIND input, which may be normalized rather than the machine jump address. Native consumed mask and signed rendering hint are not complete runtime/signedness proofs. Null tables/defaults stay unknown. The native model default out-edge is separate from any machine out-of-range guard destination. Use relations kind:cases for selected raw table rows, labels and their native mapping to recovered edges; row/edge ordinals are not case values. Available even when the full graph is unavailable if this independent facet was captured.",
    },
    {
      snapshot,
      ids: z.array(z.string()).max(128).optional(),
      origin_addresses: z.array(hex).max(128).optional(),
      fields: z.array(z.enum(["selector", "table"])).optional(),
      ...page,
    },
    "switches",
    'await rea.switches({snapshot:s,origin_addresses:["0x1000"]})',
  ),
  functions: definition(
    {
      summary:
        "Select callable entries and aliases, preserving ambiguous names; reported sizes are bounds, not assured extents.",
      description:
        "Search retained native callable entries by literal name/alias, exact name, or entry addresses. Names can match several entries, including PLT/import stubs and implementations; preserve all matches and select by address. A name does not establish runtime symbol binding.",
    },
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
    {
      summary:
        "Search native string candidates by literal text; discovery and reference attribution remain unknown.",
      description:
        "Search native string candidates by literal text (JavaScript UTF16 includes semantics, no regex). Address and encoding identify an object within the artifact; fields:[] omits display text. Select value, provider_value or decoding only when needed. Encoded byte lengths and provider-reported NUL termination are preserved when known; omitted NUL status is unknown. A false NUL status makes no claim about bytes outside that span. Coverage.source_scope distinguishes a retained whole inventory from a selected query report; source IDs need not be shared between queries/pages/detail views. source_row, when present, is the canonical candidate ordinal under the declared native scan settings. Paging and native selection completeness do not establish artifact discovery completeness. Complete captured source remains readable through evidence.",
    },
    {
      query: z.string(),
      fields: z
        .array(z.enum(["value", "provider_value", "decoding"]))
        .optional(),
      ...page,
    },
    "strings",
    'await rea.strings({query:"incorrect header check",fields:[]})',
  ),
  references: referencesMethod,
  snapshot: definition(
    {
      summary:
        "Capture one function's analysis; return a snapshot, retained Evidence, facet availability and scoped counts.",
      description:
        "Analyze an explicit function entry once; return a retained capture handle, facets and coverage. Reuses the source within this target lease. Code, recovered calls and values remain independently available when full recovered IR exceeds capacity. A bounded call-rooted operation/definition projection may also be available; inspect facets.operations and coverage before reads. CFG queries still require the complete recovered graph. Available calls include compact by_opcode counts of known/unknown targets over the whole retained call facet; no paging is needed for these counts. Selected calls and complete Evidence remain readable.",
    },
    { entry: hex },
    "snapshot",
    'await rea.snapshot({entry:"0x1000"})',
  ),
  bytes: definition(
    {
      summary:
        "Read batched static loaded-image byte ranges with source identity and per-window partial outcomes.",
      description:
        "Read selected native loaded-image bytes without instruction decoding. Batch up to 16 exact virtual-address windows and 64 KiB total selected bytes; hex uses twice that space before provenance. Short reads remain partial. These are not live process memory or an original-file-offset mapping. Global code discovery is not performed.",
    },
    {
      windows: z.array(byteWindow).min(1).max(16),
    },
    "bytes",
    'await rea.bytes({windows:[{address:"0x2000",length:32}]})',
  ),
  instructions: definition(
    {
      summary:
        "Decode selected static machine-byte windows, distinct from optimized IR edges and runtime execution.",
      description:
        "Batch selected machine instruction windows. Read exact bytes and native disassembly to verify actual control transfers; optimized recovered CFG edges can bypass machine blocks. Address+size with the artifact context identifies the byte range. A caller-selected decode start does not prove execution/alignment.",
    },
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
    {
      summary:
        "Select snapshot-local IR operations by identity, origin, constant or kind, with native/projection scope.",
      description:
        "Select SSA operations by IDs, source instruction origins, block IDs, constant literal or kind. Native default rows are compact summaries: opcode/kind/output and input/definition/constant counts; request detailed fields explicitly or page input slots via relations kind:operands. Filters intersect; identities and native is_dead are retained. Availability may be a complete recovered graph or a bounded call-rooted projection; inspect coverage before inferring absence. A literal match is not object identity. origin_addresses selects optimized recovered IR origins; use instructions for actual machine control transfers.",
    },
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
    summary:
      "Read typed SSA operands/def-use, CFG/controllers or switch cases by identities; preserve unknown/partial scope.",
    description:
      "Read native operand occurrences, operation definitions/uses, value_uses or case rows. value_uses takes value-ID seeds and returns exact operation/input-slot occurrences, including function inputs and constants without defining operations; null definition stays explicit, not a missing use. Uses cover retained operations, not runtime or memory aliases. Other data-flow/case seeds are operation IDs; incoming/outgoing CFG edges or derived controllers for block IDs. Native CFG/controller reads deduplicate seeds and report unretained_seeds; an unknown block is not a retained block with no relations. Incoming/outgoing rows keep caller seed then native edge order; controllers keep native controller/edge then postdominator order. cases pages one relation per case/out-edge, with a stable case_id; an unmapped case has one explicit unknown-edge row. total counts relations, not table rows. cases filters optional case_values (native labels tagged value) and case_indices (original row ordinals); both filters intersect and paging spans deduplicated seeds in caller order. Rows preserve missing/no-label status, original recovered target, and separate recovered edges. Partial/unavailable tables and unmapped rows are explicit; no runtime feasibility claim. operands pages every selected input slot, including constants, function inputs and null slots; input_indices optionally selects slots in caller order. Identity is snapshot + operation + input_index; value_id/definition and exact phi predecessor/edge bindings remain separate. Out-of-range slots of retained operations are absent; unretained_seeds remain unknown. A bounded call-rooted projection supports operands/definitions/uses but no CFG; uses cover retained selected operations only. Diagnostic SSA lacks native operands and has partial CFG/printed occurrences. controllers requires a complete recovered graph and concerns finite paths to recovered exits, not runtime feasibility.",
    input: relationInput,
    method: "relations",
    example:
      'await rea.relations({snapshot:s,kind:"operands",seeds:[op.id],input_indices:[0,2]})',
  },
  values: definition(
    {
      summary:
        "Select SSA values by ID or exact space/offset/width; keep versions, inputs and constants distinct, without alias inference.",
      description:
        "Read native SSA values by IDs or exact locations [{space,offset,size_bytes}], with width required. Locations match retained metadata, including const/unique spaces, not pointee contents, aliases or live memory. Filters intersect; IDs retain caller order, otherwise locations retain caller order and values retain native order per location. Empty IDs/locations select none. Null-space values cannot resolve a location and stay explicit in location_coverage; unretained_locations means no known retained coordinate match, not absent machine storage. Scope may be a full graph, bounded call-rooted definition projection, or call-boundary values only; is_input filters the raw native input flag, which can also mark globals or stack values; it is not formal-parameter membership. Use parameters for the separate native recovered prototype, which also does not prove an original source signature. Offset is an address-space offset, not a computed arbitrary-width value. Width, constants, function inputs, annotation status and defining operation are separate facts. Requires the pinned native exporter.",
    },
    {
      snapshot,
      ids: z.array(z.string()).max(128).optional(),
      is_input: z.boolean().optional(),
      locations: z.array(valueLocation).max(128).optional(),
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
    {
      summary:
        "Read recovered calls, target knowledge, arguments and passing storage; signatures and runtime binding remain uncertain.",
      description:
        "Select structured recovered call sites and argument bindings. Target comes from native call specifications, never the fspec annotation offset or display text. Each argument separates its SSA value from its passing storage. Calls and their boundary values survive full graph capacity failure. target_value_id retains input zero independently of target resolution; it may be an fspec annotation or an unresolved indirect target value. A null output describes this recovered operation, not proof of a void source signature. Input slots are not original source parameter ordinals; missing storage and indirect/runtime targets remain unknown. To investigate across functions, snapshot the selected callee and select values with is_input:true, comparing exact space/offset/width. Requires the pinned native exporter.",
    },
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
    {
      summary:
        "Select recovered CFG blocks and edges; origin addresses are provenance, not machine block extents.",
      description:
        "Read native recovered blocks by stable snapshot-local ID, with ordered predecessors, successor edges and member operation IDs. origin_start describes optimized IR provenance, not a machine block extent. Requires an available native recovered IR graph. Runtime successors remain unknown.",
    },
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
  parameters: definition(
    {
      summary:
        "Select native recovered formal parameter and return storage, convention and recovery flags; raw input varnodes are not formals.",
      description:
        "Read the captured native function prototype: paged parameter entries, return descriptor, native convention label, locks, variadic and recovery-error flags. IDs/indices belong to this snapshot's recovered prototype, not proven source parameter ordinals or original signature. Native is_input also marks stack/global input varnodes; it is not formal membership. Select indices in caller order and optional fields; defaults omit display names/type strings. Output uses the same field selection. Null storage/type stays unknown; explicit is_void is independent of storage absence. Storage matches across snapshots require exact artifact/callee identity and ABI reasoning; stack rebasing, aliases, split/join storage, runtime binding and source signatures remain unproved. Requires a captured parameters facet, independently of full CFG/calls. Older experimental captures explicitly report not-captured; no synthetic empty signature.",
    },
    {
      snapshot,
      indices: z.array(z.number().int().nonnegative()).max(128).optional(),
      fields: z
        .array(
          z.enum([
            "name",
            "type_name",
            "size_bytes",
            "is_void",
            "storage",
            "type_locked",
            "name_locked",
            "size_locked",
            "this_pointer",
            "indirect_storage",
            "hidden_return",
          ]),
        )
        .optional(),
      ...page,
    },
    "parameters",
    'await rea.parameters({snapshot:s,indices:[0],fields:["storage","size_bytes","is_void","type_name"]})',
  ),
  path: definition(
    {
      summary:
        "Find one shortest recovered CFG path to a block or exit, with exclusions and paged native edges; feasibility stays unknown.",
      description:
        "Find one shortest edge-count witness in the complete recovered CFG from a numeric block ID to a block or any zero-successor recovered exit, excluding avoid IDs. Ties follow native successor order. Return paged native edges with a separate step_index; index remains the original successor ordinal. A found zero-edge path is distinct from not-found. Unknown start/target/avoid identities produce status unknown and unretained_blocks, never absence. Not-found applies only to this recovered graph under the requested exclusions; exits, termination, machine flow and branch-predicate feasibility remain unproved. Requires the full recovered_ir facet, not a call-rooted projection. Search state is bounded by the admitted graph; one last-query cache per resident immutable graph expires with eviction/lease close. The avoid selection is bounded by the maximum admitted graph block count.",
    },
    {
      snapshot,
      from: z.number().int().nonnegative(),
      target: z.discriminatedUnion("kind", [
        z.strictObject({
          kind: z.literal("block"),
          id: z.number().int().nonnegative(),
        }),
        z.strictObject({ kind: z.literal("exit") }),
      ]),
      avoid: z
        .array(z.number().int().nonnegative())
        .max(MAX_GRAPH_BLOCKS)
        .default([]),
      ...page,
    },
    "path",
    'await rea.path({snapshot:s,from:block,target:{kind:"exit"},avoid:[join]})',
  ),
  slice: definition(
    {
      summary:
        "Trace bounded backward definitions with explicit LOAD/PHI/frontier cutoffs; memory aliases remain unknown.",
      description:
        "Compose a bounded backward definition traversal from explicit operation IDs. Native default operation rows are compact summaries; request detailed fields or use paged operand relations for wide nodes. Available over a complete recovered graph or bounded call-rooted projection. Missing defining bodies retain frontier reasons; complete use sets and CFG are unavailable for a projection. Default load/phi cutoffs keep boundaries visible; choose stop_kinds:[] to traverse beyond them. Complete reachability and memory aliases remain unknown.",
    },
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
    {
      summary:
        "Read selected lines of retained reconstructed code, including when graph capture is unavailable.",
      description:
        "Read reconstructed code from the same retained function capture, even when its graph facet is unavailable. offset is zero-based. A large limit reads the complete code inside Code Mode for local filtering. The bridge byte budget bounds the result. No additional decompilation.",
    },
    {
      snapshot,
      offset: page.offset,
      limit: z.number().int().positive().default(64),
    },
    "code",
    "await rea.code({snapshot:s,offset:100,limit:64})",
  ),
  evidence: definition(
    {
      summary:
        "Page complete retained source or decoded graph Evidence with source/view identities and freshness checks.",
      description:
        "Read complete retained native source in UTF-16-code-unit pages by evidence_id; no reanalysis. component:source preserves exact original wire JSON. component:recovered_ir reads the decoded graph source, including lossless compressed graphs; source hash remains the original capture and view has its own hash/byte count. This is source inspection, not a claim that malformed graph facts are valid. Available until close_binary.",
    },
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
export const reference = createReference(methods);
