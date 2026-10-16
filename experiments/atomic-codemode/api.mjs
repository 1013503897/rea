// One named contract registry shared by SDK, CLI, direct MCP and Code Mode.
import { z } from "zod";
import { KunaFactOwner } from "./provider.mjs";
import { FactFailure } from "./fact-error.mjs";
import { MAX_BYTE_BATCH_BYTES } from "./limits.mjs";

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
    ]),
  )
  .optional();
const definition = (description, input, method, example) => ({
  description,
  input: z.strictObject(input),
  method,
  example,
});
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
    "Analyze an explicit function entry once; return a retained capture handle, facets and coverage. Reuses the source within this target lease. A valid code facet remains available when recovered IR exceeds capacity or is malformed; inspect facets before graph reads.",
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
    "Select SSA operations by IDs, source instruction origins, block IDs, constant literal or kind. Filters intersect; identities and source lines are always retained. A literal match is not object identity. origin_addresses selects optimized recovered IR origins; use instructions for actual machine control transfers.",
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
  relations: definition(
    "Read definitions/uses for operation IDs, incoming/outgoing CFG edges or derived controllers for block IDs. Native IR includes exact operand/phi bindings and the complete recovered graph; diagnostic SSA has partial CFG and printed occurrences only. controllers requires native IR and concerns finite paths to recovered exits, not runtime feasibility.",
    {
      snapshot,
      kind: z.enum([
        "definitions",
        "uses",
        "incoming",
        "outgoing",
        "controllers",
      ]),
      seeds: z
        .array(z.union([z.string(), z.number().int().nonnegative()]))
        .min(1)
        .max(128),
      ...page,
    },
    "relations",
    'await rea.relations({snapshot:s,kind:"uses",seeds:[op.id]})',
  ),
  values: definition(
    "Read identified native SSA values in a batch; is_input filters retained operand/output values, not an original source signature. Offset is an address-space offset, not a computed arbitrary-width value. Width, constants, function inputs, annotation status and defining operation are separate facts. Requires native IR.",
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
    "Select structured recovered call sites and argument bindings. Target comes from native call specifications, never the fspec annotation offset or display text. Each argument separates its SSA value from its passing storage. Input slots are not original source parameter ordinals; missing storage and indirect/runtime targets remain unknown. To investigate across functions, snapshot the selected callee and select values with is_input:true, comparing exact space/offset/width. Requires native IR.",
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
          ]),
        )
        .optional(),
      ...page,
    },
    "calls",
    'await rea.calls({snapshot:s,origin_addresses:["0x1100"]})',
  ),
  blocks: definition(
    "Read native recovered blocks by stable snapshot-local ID, with ordered predecessors, successor edges and member operation IDs. origin_start describes optimized IR provenance, not a machine block extent. Requires native IR. Runtime successors remain unknown.",
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
    "Compose a bounded backward definition traversal from explicit operation IDs. Default load/phi cutoffs keep boundaries visible; choose stop_kinds:[] to traverse beyond them. Complete reachability and memory aliases remain unknown.",
    {
      snapshot,
      seeds: z.array(z.string()).min(1).max(64),
      max_operations: z.number().int().min(1).max(256).default(48),
      stop_at: z.array(z.string()).max(128).default([]),
      stop_kinds: z.array(kinds).default(["phi", "load"]),
      fields,
    },
    "slice",
    "await rea.slice({snapshot:s,seeds:branchIds,max_operations:48})",
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
    "Read complete retained native source in UTF-16-code-unit pages by its evidence_id; no reanalysis. Available until close_binary.",
    {
      evidence_id: z.string().startsWith("ev_"),
      offset: page.offset,
      limit: z.number().int().min(1).max(16384).default(4096),
    },
    "evidence",
    "await rea.evidence({evidence_id:id,offset:0,limit:4096})",
  ),
};

// Compact return contracts let code compose before first observing a response.
const returns = {
  bytes:
    "data:{results:[{ok,address,source:{evidence_id,sha256},hex,returned_bytes,end_address,coverage:{status,requested_bytes,provider_truncated,notes,original_file_mapping,runtime_memory}}|{ok:false,address,error}]}; ranges are [address,end_address). Completeness concerns requested bytes, not the provider truncation flag or adjacent bytes. Complete native hexdump and metadata remain in Evidence.",
  functions:
    "data:{source:{evidence_id,sha256},items:[{address,name,aliases,size}],total,next_offset,coverage}; size is an upper bound, or zero if unmeasured. Multiple matching addresses are retained, never selected by catalog order or display name alone.",
  instructions:
    "data:{results:[{ok,address,source:{evidence_id,sha256},items:[{address,size,status,bytes?,text?,mnemonic?,operands?}],resume_address,coverage}|{ok:false,address,error}]}; decoded rows describe selected machine bytes, not optimized IR branches. Partial batches retain successful windows.",
  strings:
    "data:{source:{evidence_id,sha256},items:[{address,value,string:{encoding,byte_length}}],total,next_offset,coverage}",
  references:
    "data:{results:[{ok,address,source:{evidence_id},items:[{source_row,from,to,kind,fromFunction:{address,name}|null,toFunction:{address,name}|null,instruction}],total,next_offset,coverage}|{ok:false,address,error}]}. source_row is the zero-based row in retained native xrefs; Evidence identity plus source_row identifies an occurrence. Coverage preserves examined/excluded/unattributed counts and unknown function scope/discovery. fields projects optional columns; endpoints/kind/source_row stay.",
  snapshot:
    "data:{snapshot:string,entry,source:{evidence_id,sha256},facets:{code:{availability},recovered_ir:{availability,error?}},coverage}. An unavailable graph has unknown/null counts, never a fabricated empty graph; code remains readable through the same handle.",
  operations:
    "data:{items:[{id,origin_address,block,source_line,kind,statement,definitions,constants,inputs?,output?,opcode?}],total,next_offset,evidence_id,coverage}. Native inputs:[{input_index,value_id,phi_predecessor,phi_predecessor_edge}], output:value_id|null; definitions:[{definition,use,input_index,value_id,phi_predecessor,phi_predecessor_edge}]. Diagnostic definitions use printed occurrence instead. fields projects columns; identity remains.",
  relations:
    "data:{items:definition/use edges OR CFG edges{from,to,operation,polarity?,condition_value?,condition_test?} OR controllers{controller,dependent,edge},total,next_offset,evidence_id,coverage,relation_coverage?}. definitions/uses seeds are operation-ID strings; incoming/outgoing/controllers seeds are numeric block IDs. Native def/use edges include input_index,value_id,phi_predecessor; diagnostic edges include occurrence only.",
  values:
    "data:{items:[{id,space,offset,size_bytes,is_constant,is_input,is_annotation,definition,type_name}],total,next_offset,evidence_id,coverage}; definitions are operation IDs, offsets are exact hex strings.",
  calls:
    "data:{items:[{id,origin_address,block,opcode,spec_available,target:{space,offset}|null,target_name,arguments:[{input_index,value_id,storage:{space,offset,size_bytes}|null,storage_authority}],output}],total,next_offset,missing,evidence_id,coverage}. fields selects target/target_name/arguments/output/prototype/stack_offset. Calls include all retained call operations; null facts are unknown, not proof of no arguments or runtime binding. Candidate cross-function links require matching target identity and exact passing/input storage; join/subregister/alias interpretation remains unknown.",
  blocks:
    "data:{items:[{id,origin_start,operations,predecessors,successors:[{target,index,polarity,condition_value,condition_test}]}],total,next_offset,evidence_id,coverage}; IDs are local to this snapshot.",
  slice:
    "data:{operations:[operation rows as above],coverage:{status,boundaries:[{id,reason}],missing,source_issues,runtime_reachability,memory_alias_dependencies},evidence_id}",
  code: "data:{evidence_id,start_line,language:string|null,text,total_lines,next_offset,coverage}; language is native-reported or unknown. Read/filter full reconstructed text within Code Mode without returning it all.",
  evidence:
    "data:{source:{evidence_id,sha256,bytes,arguments},text,total_code_units,next_offset}; source has complete native output, including code before the SSA graph.",
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
methods.relations.input = methods.relations.input.superRefine(
  (value, context) => {
    const type = ["incoming", "outgoing", "controllers"].includes(value.kind)
      ? "number"
      : "string";
    if (value.seeds.some((seed) => typeof seed !== type))
      context.addIssue({
        code: "custom",
        path: ["seeds"],
        message: `${value.kind} requires ${type} seeds`,
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

export const reference = (query = "") => {
  const keys = Object.keys(methods).filter(
    (key) =>
      query === "" ||
      key.includes(query) ||
      methods[key].description.toLowerCase().includes(query.toLowerCase()),
  );
  return {
    language:
      "JavaScript async function body; return a JSON value. All rea methods return {ok,context,data} or {ok:false,error}.",
    methods: keys.map((name) => ({
      name: `rea.${name}`,
      description: methods[name].description,
      input_schema: z.toJSONSchema(methods[name].input),
      returns: returns[name],
      example: methods[name].example,
    })),
    limits: {
      execution_heap_mib: 64,
      max_host_calls: 64,
      output_utf8_bytes: 32768,
    },
    notes: [
      "No process, filesystem, network, imports or Node globals in the execution environment.",
      "Select facts inside code, return only what the question needs, and keep real source IDs and unknowns.",
      "A fresh JavaScript environment is used per execute_javascript call; analysis snapshots live until close_binary.",
    ],
  };
};
