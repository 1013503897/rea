// Named documentation selection; adapters supply their exact registered labels.
import { z } from "zod";
import { FactFailure } from "./fact-error.mjs";
import { freezeFacts } from "./fact-reads.mjs";

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
    "data:{snapshot:string,entry,source:{evidence_id,sha256},facets:{code:{availability},recovered_ir:{availability,error?},operations:{availability,scope?,count?,root_count?,definition_frontier_count?,error?},calls:{availability,count?,by_opcode?:[{opcode,known_target_count,unknown_target_count}],coverage?,error?},values:{availability,scope?,count?,error?}},coverage}. Call counts cover all retained recovered calls, including is_dead rows, not complete machine/runtime calls; target knowledge comes from a non-null native target, independent of opcode. An unavailable facet omits counts; an available empty call facet reports zeros. The complete graph can be unavailable while operations reports a bounded projection count; an unavailable operation facet has unknown/null counts, never a fabricated empty set; code remains readable through the same handle.",
  operations:
    "data:{items:[{id,origin_address,block,source_line,kind,statement,definitions,constants,inputs?,output?,opcode?,is_dead?}],total,next_offset,evidence_id,coverage}. Native inputs:[{input_index,value_id,phi_predecessor,phi_predecessor_edge}], output:value_id|null; native constants include value_id/input_index and exact u64 value offset with printed_size_bytes (native width), not arbitrary-width computed values; definitions:[{definition,use,input_index,value_id,phi_predecessor,phi_predecessor_edge}]. Diagnostic definitions use printed occurrence instead. fields projects columns; identity and native is_dead remain. A call-rooted projection reports retained facts only, with unknown CFG and explicit definition frontier coverage.",
  relations:
    "data:{items:definition/use edges OR CFG edges{from,to,operation,polarity?,condition_value?,condition_test?} OR controllers{controller,dependent,edge},total,next_offset,evidence_id,coverage,relation_coverage?,unretained_seeds?}. definitions/uses seeds are operation-ID strings; incoming/outgoing/controllers seeds are numeric block IDs. Native def/use edges include input_index,value_id,phi_predecessor; diagnostic edges include occurrence only.",
  values:
    "data:{items:[{id,space,offset,size_bytes,is_constant,is_input,is_annotation,definition,type_name}],total,next_offset,evidence_id,coverage}; definitions are operation IDs, offsets are exact hex strings. When the graph is unavailable, values may come from a bounded definition projection or only the call boundary; coverage states that scope and operations/definitions may be unreadable.",
  calls:
    "data:{items:[{id,origin_address,block,opcode,spec_available,is_dead,target:{space,offset}|null,target_name,arguments:[{input_index,value_id,storage:{space,offset,size_bytes}|null,storage_authority}],output}],total,next_offset,missing,evidence_id,coverage}. fields selects target/target_name/arguments/output/prototype/stack_offset/target_value_id/is_dead. Values may come from a bounded call-rooted definition projection or call-boundary set when the graph is unavailable; coverage states that scope. Calls include all retained call operations; null facts are unknown, not proof of no arguments or runtime binding. Candidate cross-function links require matching target identity and exact passing/input storage; join/subregister/alias interpretation remains unknown.",
  blocks:
    "data:{items:[{id,origin_start,operations,predecessors,successors:[{target,index,polarity,condition_value,condition_test}]}],total,next_offset,evidence_id,coverage}; IDs are local to this snapshot.",
  slice:
    "data:{operations:[operation rows as above],coverage:{status,boundaries:[{id,reason}],missing,missing_reasons?,source_scope?,source_issues,runtime_reachability,memory_alias_dependencies},value_frontier?:[{value_id?|operation?,input_index?,reason}],evidence_id}",
  code: "data:{evidence_id,start_line,language:string|null,text,total_lines,next_offset,coverage}; language is native-reported or unknown. Read/filter full reconstructed text within Code Mode without returning it all.",
  evidence:
    "data:{source:{evidence_id,sha256,bytes,arguments},text,total_code_units,next_offset}; source has complete native output, including code before the SSA graph.",
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
  (query = "", { names = {}, language, includeExamples = true } = {}) => {
    const { lookup, labels } = referenceNames(methods, names),
      selected = selectReference(methods, query, lookup);
    return {
      language:
        language ??
        "JavaScript async function body; return a JSON value. All rea methods return {ok,context,data} or {ok:false,error}.",
      methods: selected.keys.map((method) => ({
        method,
        name: labels[method],
        description: methods[method].description,
        input_schema: schemaFor(methods[method].input),
        returns: returns[method],
        ...(includeExamples ? { example: methods[method].example } : {}),
      })),
      coverage: {
        declared_methods: Object.keys(methods).length,
        matched_methods: selected.keys.length,
        selection: selected.selection,
      },
      unmatched_queries: selected.unmatched,
      limits: {
        execution_heap_mib: 64,
        max_host_calls: 64,
        output_utf8_bytes: 32768,
      },
      notes: [
        "Select exact displayed method names or canonical method IDs, separated by spaces/commas; a topic query searches descriptions. Empty query returns all contracts.",
        "No process, filesystem, network, imports or Node globals in the execution environment.",
        "Select facts inside code, return only what the question needs, and keep real source IDs and unknowns.",
        "A fresh JavaScript environment is used per execute_javascript call; analysis snapshots live until close_binary.",
      ],
    };
  };
