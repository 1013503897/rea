// One named contract registry shared by SDK, CLI, direct MCP and Code Mode.
import { z } from "zod";
import { KunaFactOwner, FactFailure } from "./provider.mjs";

const hex = z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u);
const snapshot = z.string().startsWith("snap_");
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
  .array(z.enum(["kind", "statement", "definitions", "constants"]))
  .min(1)
  .optional();
const definition = (description, input, method, example) => ({
  description,
  input: z.strictObject(input),
  method,
  example,
});
export const methods = {
  strings: definition(
    "Search retained string inventory by literal text. Paging does not establish artifact completeness.",
    { query: z.string(), ...page },
    "strings",
    'await rea.strings({query:"incorrect header check"})',
  ),
  references: definition(
    "Batch exact-address incoming xrefs, preserving kinds and owning-function identities. Interior string uses require a separate extent query.",
    { addresses: z.array(hex).min(1).max(16), ...page },
    "references",
    'await rea.references({addresses:["0x2000"]})',
  ),
  snapshot: definition(
    "Analyze an explicit function entry once; retain native C and SSA, return its handle and coverage. Reuses the same source within this target lease.",
    { entry: hex },
    "snapshot",
    'await rea.snapshot({entry:"0x1000"})',
  ),
  operations: definition(
    "Select SSA operations by IDs, instruction origins, block IDs, constant literal or kind. Filters intersect; identities and source lines are always retained. A literal match is not object identity.",
    {
      snapshot,
      ids: z.array(z.string()).max(128).optional(),
      addresses: z.array(hex).max(128).optional(),
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
    "Read explicit definitions/uses for operation IDs, or incoming/outgoing CFG edges for block IDs. Branch polarity refers to the printed predicate. CFG is partial; printed occurrences are not p-code input indexes or phi predecessor bindings.",
    {
      snapshot,
      kind: z.enum(["definitions", "uses", "incoming", "outgoing"]),
      seeds: z
        .array(z.union([z.string(), z.number().int().nonnegative()]))
        .min(1)
        .max(128),
      ...page,
    },
    "relations",
    'await rea.relations({snapshot:s,kind:"uses",seeds:[op.id]})',
  ),
  slice: definition(
    "Compose a bounded backward definition traversal from explicit operation IDs. Default load/phi cutoffs keep boundaries visible; choose stop_kinds:[] to traverse beyond them. Complete reachability and memory aliases remain unknown.",
    {
      snapshot,
      seeds: z.array(z.string()).min(1).max(64),
      max_operations: z.number().int().min(1).max(256).default(48),
      stop_at: z.array(z.string()).max(128).default([]),
      stop_kinds: z.array(kinds).default(["phi", "load"]),
    },
    "slice",
    "await rea.slice({snapshot:s,seeds:branchIds,max_operations:48})",
  ),
  code: definition(
    "Read native reconstructed C retained with this exact SSA source; offset is zero-based. A large limit can read the complete function inside Code Mode: filter locally before returning text. The bridge byte budget, not an arbitrary line count, bounds the result. No additional decompilation.",
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
  strings:
    "data:{source:{evidence_id,sha256},items:[{address,value,string:{encoding,byte_length}}],total,next_offset,coverage}",
  references:
    "data:{results:[{ok,address,source:{evidence_id},items:[{from,to,kind,fromFunction:{address,name}|null,toFunction:{address,name}|null,instruction}],total,next_offset,coverage}|{ok:false,address,error}]}",
  snapshot:
    "data:{snapshot:string,entry,source:{evidence_id,sha256},coverage:{operations,blocks,control_flow,unrepresented_outgoing_blocks,issues}}",
  operations:
    "data:{items:[{id,address,block,source_line,kind,statement,definitions:[{definition,use,occurrence}],constants:[{value,printed_size_bytes}]}],total,next_offset,evidence_id,coverage}. fields projects optional columns; identity fields remain.",
  relations:
    "data:{items:[{definition,use,occurrence}] for definitions/uses OR [{from:number,to:number,operation:string|null,kind,polarity?,predicate?,source_line}] for incoming/outgoing,total,next_offset,evidence_id,coverage}. definitions/uses seeds are operation-ID strings; incoming/outgoing seeds are numeric block IDs.",
  slice:
    "data:{operations:[operation rows as above],coverage:{status,boundaries:[{id,reason}],missing,source_issues,runtime_reachability,memory_alias_dependencies},evidence_id}",
  code: "data:{evidence_id,start_line,text,total_lines,next_offset,coverage}; text is reconstructed C. Use a large limit to inspect/filter the full text within code without returning it all.",
  evidence:
    "data:{source:{evidence_id,sha256,bytes,arguments},text,total_code_units,next_offset}; source has complete native output, including code before the SSA graph.",
};
methods.relations.input = methods.relations.input.superRefine(
  (value, context) => {
    const type = ["incoming", "outgoing"].includes(value.kind)
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
        return { ok: true, context: this.context, data };
      } catch (error) {
        return {
          ok: false,
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
