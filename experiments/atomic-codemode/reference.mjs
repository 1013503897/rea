// Named documentation selection; adapters supply their exact registered labels.
import { z } from "zod";
import { FactFailure } from "./fact-error.mjs";
import { freezeFacts } from "./fact-reads.mjs";
import { EXECUTION_LIMITS } from "./limits.mjs";
const referenceViews = ["index", "contracts"];
export const referenceInput = z.strictObject({
  query: z.string().default(""),
  view: z.enum(referenceViews).default("contracts"),
});

// Compact return contracts let code compose before first observing a response.
const returns = {
  switches:
    "data:{items:[{id,origin_address,block,selector:{native value fields}|null,table:{partial,labelled,consumed_mask,signed_render_hint,default_raw_index,default_edge:{id,index,target}|null,default_is_folded,case_count,mapping_count,relation_count,known_label_count,missing_label_count,no_label_count,unmapped_row_count,unknown_target_count}|null}],total,next_offset,missing,evidence_id,coverage}. No case inventory is embedded. selector is the native current BRANCHIND input and can be normalized; default_raw_index=-1/default_edge:null means undefined, not proof of no default. signed_render_hint does not establish general signedness. default_edge is the native model default, not necessarily the machine out-of-range guard destination. relations kind:cases reads selected original rows and mappings, even without a full graph if the independent switch facet exists.",
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
    "data:{snapshot:string,entry,source:{evidence_id,sha256},facets:{code:{availability},recovered_ir:{availability,error?},operations:{availability,scope?,count?,root_count?,definition_frontier_count?,error?},calls:{availability,count?,by_opcode?:[{opcode,known_target_count,unknown_target_count}],coverage?,error?},values:{availability,scope?,count?,error?},switches?:{availability,count?,table_count?,partial_table_count?,case_count?,relation_count?,error?}},coverage}. Call counts cover all retained recovered calls, including is_dead rows, not complete machine/runtime calls; target knowledge comes from a non-null native target, independent of opcode. An unavailable facet omits counts; an available empty call facet reports zeros. The complete graph can be unavailable while operations reports a bounded projection count; an unavailable operation facet has unknown/null counts, never a fabricated empty set; code remains readable through the same handle.",
  operations:
    "data:{items:[{id,origin_address,block,is_dead,kind,opcode,output,input_count,definition_count,constant_count}],total,next_offset,evidence_id,coverage}. Native defaults are compact summaries; fields optionally selects statement,inputs,definitions,constants or summary columns; identity/is_dead stay. Native inputs:[{input_index,value_id,phi_predecessor,phi_predecessor_edge}], output:value_id|null; constants:[{value_id,input_index,value,printed_size_bytes,is_annotation}] retain exact u64 offsets, not arbitrary-width computed values; definitions:[{definition,use,input_index,value_id,phi_predecessor,phi_predecessor_edge}]. Page large input lists with relations kind:operands. Diagnostic rows retain legacy printed statements/occurrences and omit unavailable native counts. Projection scope is partial, with unknown CFG and definition frontier coverage.",
  relations:
    "data:{items:operands/value_uses{operation,input_index,value_id,definition,phi_predecessor,phi_predecessor_edge} OR definition/use edges OR CFG edges{from,to,operation,polarity?,condition_value?,condition_test?} OR controllers{controller,dependent,edge} OR cases{id,case_id,switch,block,case_index,label:{status:value|no-label,raw_bits}|null,recovered_target:{space,offset}|null,edge:{id,index,target}|null},total,next_offset,evidence_id,coverage,relation_coverage?,unretained_seeds?}. Cases page individual case/out-edge relations; unmapped cases contribute one unknown-edge row. case_id stays the same across multiple edges and total counts relations, not native table rows. Cases use switch operation-ID seeds; case_values selects native labels tagged value, case_indices selects original row ordinals. Filters intersect; seeds are deduplicated in caller order and rows keep native table order. Missing/no-label/unmapped and partial/unavailable tables stay explicit in relation_coverage, not proof of absent runtime cases. value_uses seeds are value-ID strings, including constants/function inputs with null definition; rows retain every selected operand occurrence. operands/definitions/uses seeds are operation-ID strings; CFG/controller seeds are numeric block IDs. Native CFG/controller reads report unretained_seeds and deduplicate seeds; an empty result for an unretained block does not establish absence. Incoming/outgoing order is caller seed then native edge; controllers order is native controller/edge then postdominator ancestor. operands accepts optional input_indices; deduplicates seeds/indices in caller order, otherwise keeps native slot order. All selected slots include constants/function inputs/nulls; values provides their metadata. For retained seeds, a requested out-of-range slot is absent; unretained seeds remain unknown. total is the filtered relation count before paging. Native def/use edges retain exact input/value/phi bindings; diagnostic edges include printed occurrence only.",
  values:
    "data:{items:[{id,space,offset,size_bytes,is_constant,is_input,is_annotation,definition,type_name}],total,next_offset,missing,unretained_locations?,location_coverage?,evidence_id,coverage}; definitions are operation IDs, offsets are exact hex strings. Optional locations selects exact space/offset/size_bytes tuples, not overlapping aliases or pointee contents; filters intersect, IDs keep caller order, otherwise distinct locations keep caller order then native value order. Empty locations selects none. unretained_locations and location_coverage:{scope,unknown_space_count} accompany location selection; unretained locations are determined before ID/input filters; null spaces remain unresolved (unknown_space_count is null for empty location selection), and these matches do not prove machine storage absence. When the graph is unavailable, values may come from a bounded definition projection or only the call boundary; coverage states that scope and operations/definitions may be unreadable.",
  calls:
    "data:{items:[{id,origin_address,block,opcode,spec_available,is_dead,target:{space,offset}|null,target_name,arguments:[{input_index,value_id,storage:{space,offset,size_bytes}|null,storage_authority}],output}],total,next_offset,missing,evidence_id,coverage}. fields selects target/target_name/arguments/output/prototype/stack_offset/target_value_id/is_dead. Values may come from a bounded call-rooted definition projection or call-boundary set when the graph is unavailable; coverage states that scope. Calls include all retained call operations; null facts are unknown, not proof of no arguments or runtime binding. Candidate cross-function links require matching target identity and exact passing/input storage; join/subregister/alias interpretation remains unknown.",
  blocks:
    "data:{items:[{id,origin_start,operations,predecessors,successors:[{target,index,polarity,condition_value,condition_test}]}],total,next_offset,evidence_id,coverage}; IDs are local to this snapshot.",
  slice:
    "data:{operations:[operation rows as above],coverage:{status,boundaries:[{id,reason}],missing,missing_reasons?,source_scope?,source_issues,runtime_reachability,memory_alias_dependencies},value_frontier?:[{value_id?|operation?,input_index?,reason}],evidence_id}",
  code: "data:{evidence_id,start_line,language:string|null,text,total_lines,next_offset,coverage}; language is native-reported or unknown. Read/filter full reconstructed text within Code Mode without returning it all.",
  evidence:
    "data:{source:{evidence_id,sha256,bytes,arguments},view?:{component,encoding,sha256,bytes,authority},text,total_code_units,next_offset}. Default component:source preserves exact native wire output. component:recovered_ir exposes complete decoded graph JSON with a separate view hash, including compressed graphs; source hash still identifies the original wire capture. This source view preserves malformed logical facts without asserting their validity. One decoded Evidence view up to 32 MiB is cached per lease and source freshness is checked on reads.",
};
const referenceSchemas = new WeakMap();
const schemaFor = (input) => {
  if (!referenceSchemas.has(input))
    referenceSchemas.set(
      input,
      freezeFacts(z.toJSONSchema(input, { io: "input" })),
    );
  return referenceSchemas.get(input);
};
function referenceNames(methods, names) {
  const keys = Object.keys(methods),
    lookup = new Map(keys.map((key) => [key, key])),
    labels = {};
  if (Object.keys(names).some((key) => !Object.hasOwn(methods, key)))
    throw new FactFailure(
      "invalid_input",
      "Unknown method in reference presentation",
    );
  for (const key of keys) {
    const label = names[key] ?? `rea.${key}`;
    if (
      typeof label !== "string" ||
      !label ||
      (lookup.has(label) && lookup.get(label) !== key)
    )
      throw new FactFailure(
        "invalid_input",
        "Ambiguous or invalid reference method name",
      );
    lookup.set(label, key);
    labels[key] = label;
  }
  return { lookup, labels };
}
function selectReference(methods, query, lookup) {
  const normalized = query.trim();
  if (!normalized)
    return { keys: Object.keys(methods), selection: "all", unmatched: [] };
  const terms = normalized.split(/[\s,]+/u),
    named = terms.map((term) => lookup.get(term));
  if (named.some(Boolean))
    return {
      keys: [...new Set(named.filter(Boolean))],
      selection: "named",
      unmatched: terms.filter((term) => !lookup.has(term)),
    };
  const topic = normalized.toLowerCase();
  const keys = Object.keys(methods).filter(
    (key) =>
      key.includes(topic) ||
      methods[key].description.toLowerCase().includes(topic),
  );
  return { keys, selection: "topic", unmatched: keys.length ? [] : [query] };
}
export const createReference =
  (methods) =>
  (
    query = "",
    {
      names = {},
      language,
      includeExamples = true,
      view = "contracts",
      execution = true,
    } = {},
  ) => {
    if (!referenceViews.includes(view))
      throw new FactFailure("invalid_input", "Unknown reference view");
    const { lookup, labels } = referenceNames(methods, names),
      selected = selectReference(methods, query, lookup);
    const catalog = selected.keys.map((method) => ({
      method,
      name: labels[method],
      description:
        view === "index"
          ? methods[method].summary
          : methods[method].description,
    }));
    const coverage = {
      declared_methods: Object.keys(methods).length,
      matched_methods: selected.keys.length,
      selection: selected.selection,
      view,
    };
    if (view === "index")
      return {
        methods: catalog,
        coverage,
        unmatched_queries: selected.unmatched,
        notes: [
          "Intent summaries of static declared methods, not full contracts or live availability. Request exact displayed names with view:contracts for schemas and semantics; inspect snapshot facets for runtime coverage.",
        ],
      };
    return {
      language:
        language ??
        "JavaScript async function body; return a JSON value. All rea methods return {ok,context,data} or {ok:false,error}.",
      methods: catalog.map((entry) => ({
        ...entry,
        input_schema: schemaFor(methods[entry.method].input),
        returns: returns[entry.method],
        ...(includeExamples ? { example: methods[entry.method].example } : {}),
      })),
      coverage,
      unmatched_queries: selected.unmatched,
      ...(execution ? { limits: EXECUTION_LIMITS } : {}),
      notes: [
        "Select exact displayed method names or canonical method IDs, separated by spaces/commas; a topic query searches descriptions. Empty query returns all contracts.",
        "Return only the facts the question needs, and keep real source IDs and unknowns.",
        ...(execution
          ? [
              "No process, filesystem, network, imports or Node globals in the execution environment.",
              `Omit timeout_ms to use the ${EXECUTION_LIMITS.timeout_ms.default} ms wall deadline (also the MCP maximum); guest CPU has a separate ${EXECUTION_LIMITS.execution_cpu_ms} ms budget.`,
              "A fresh JavaScript environment is used per execute_javascript call; analysis snapshots live until close_binary.",
            ]
          : []),
      ],
    };
  };
