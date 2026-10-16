# Atomic RE through Code Mode

This is an **in-progress experiment**, not an integrated provider release. Branch
`experiment/atomic-codemode-20261016` starts at main
`42fc6c53ae188978deb3bedfe88287b6b316ba22` and carries the previous atomic-facts
prototype. Historical measurements in `../atomic-re-tools/` retain their original
baselines. No PR or merge is intended.

The goal is a real model completing reverse-engineering questions through
composable facts, with Code Mode as the calling adapter. A configured feature flag,
a scripted verifier or a small response does not prove that goal.

The reference is [Hex-Rays IDA MCP](https://github.com/HexRaysSA/ida-mcp/blob/df6de7985b534a964c125d5a86e41b26b17b14f6/ida_mcp/mcp.py):
an on-demand `reference` lookup and an execution entrypoint over a richer analysis
API. This experiment uses JavaScript and a QuickJS WASM environment rather than
Python in the host process. It exposes only declared static analysis capabilities.
It does not add target execution, patching or GUI control.

Three boundaries own the implementation:

- `provider.mjs`, `native-ir.mjs`: existing REA native target/process owners and parsed Kuna
  string/reference/SSA facts, retained sources, freshness and cleanup.
- `api.mjs`: named, validated fact/relationship contracts and session admission.
  SDK callers, CLI scripts and both MCP adapters use these same methods.
- `executor.mjs`, `server.mjs`, `cli.mjs`: bounded JavaScript composition and
  presentation. No analysis is reimplemented in the execution environment.

The complete Code Mode MCP catalog is `open_binary`, `reference`,
`execute_javascript`, `close_binary`. Setting `REA_ATOMIC_ADAPTER=direct` exposes
the same fact API as `facts_*` MCP operations for comparison. This is a distinct
experimental server; the production REA catalog is not filtered or replaced.

Use the pinned Node, an existing REA build and a caller-supplied Kuna 1.833:

```sh
npm ci --prefix experiments/atomic-codemode --ignore-scripts
node --test experiments/atomic-codemode/*.test.mjs
REA_KUNA_COMMAND=/absolute/path/to/kuna node experiments/atomic-codemode/server.mjs
```

The local MCP registration for real model trials is named `rea-codemode`.
`agent-trial.py --mcp-entrypoint /absolute/path/to/server.mjs
--server-name rea-codemode --protocol-profile atomic --profile-parent /tmp` creates an isolated
configuration, home and empty working directory for the model. Shell/file tools,
web search and delegation are disabled. No repository or oracle is placed in that
workspace. The copied authentication file is removed with the isolated profile.
Model output, actual MCP calls, original errors and usage remain in the trial
directory. `REA_ATOMIC_TRACE` and `REA_ATOMIC_EVIDENCE_DIR` retain actual API calls
and complete sources outside the model workspace when explicitly selected by the
evaluator. The ambient environment and credentials are not logged.

Current bounds: 64 MiB guest heap, 32 KiB code and script value/error payloads, 64 host calls per execution,
120 seconds wall deadline and 2 seconds of guest synchronous execution; native requests have existing supervision, an 8 MiB
capture budget and 1 GiB function-memory limit. Retained source storage is 64 MiB
per target, with two resident indexes (each derived from at most 2 MiB diagnostic
or 8 MiB native wire source). Compressed native graphs admit at most 32 MiB decoded
JSON plus independent row/text/relationship bounds. One decoded Evidence text view
up to 32 MiB is also retained per lease; these source bounds are not parsed-heap
size guarantees. Sources are
content-digested and retained until close; explicit evaluator copies survive
close. Capacity failures are explicit, not clipped facts. Leases and snapshot
handles prevent cross-session joins.

Invocation context and observed source IDs are additional bounded receipt
metadata; the script payload bound is not a 32 KiB whole-MCP-wire limit. A real
MCP probe found that a 40,000-byte guest exception bypassed that payload policy
and produced a 40,183-byte response. Oversized errors now return explicit
`output_budget` with omission metadata. Escaping expansion is checked too;
ordinary smaller errors remain intact. `verify-executor.mjs` confirms real MCP
delivery and continued access to source Evidence collected before the exception.
It measures response bytes, not model tokens or an analysis speedup. Targeted JS
tests at this stage totaled 42, alongside the separate real-provider and native-writer checks.

The diagnostic SSA format still has incomplete CFG and phi predecessor coverage.
The opt-in [native recovered IR experiment](native-engine.md) adds full recovered
CFG edges, exact value/operand identities, phi incoming-edge bindings, selected
`values`/`blocks` reads and derived control dependence. It requires an explicitly
pinned patched engine; stock Kuna does not gain those capabilities from a wrapper.
Runtime successors, memory aliases and machine-semantic equivalence remain
unknown. Other providers are not yet wired to this experimental service.

The initial [actual model comparison](trials.md) favors the focused traditional
workflow. The seeded value-origin task has lower cumulative input and wall time
through Code Mode, but initially exposes an IR-to-machine-path error. The revised
trial correctly explains that machine path with lower observed task costs;
broader claims still require more than this single seeded task.

The large SQLite VM diagnostic task also completes when its native graph exceeds
capacity. Atomic direct beats Code Mode on cumulative input and wall time in
that sample, and a traditional reused-project run is fastest. The actual CLI
client already exposes JavaScript dispatch in every lane, regardless of requested
feature flags. MCP request counts therefore do not establish fewer model rounds;
the ledger now records actual model responses and client dispatch/wait calls.

`instructions` reads selected machine byte/decode windows through the same
owner. Recovered operations use `origin_address` and blocks `origin_start`;
these locations cannot be substituted for machine branch destinations. The
value-origin trial demonstrates why this boundary matters. The experiment
now has fifteen fact methods, still behind the same four-tool Code Mode
catalog.

`calls` connects recovered call operations to native target specifications and
separates argument SSA values from passing storage. `values(is_input:true)`
selects retained callee inputs for exact storage comparisons. These candidate
links preserve snapshot identities, missing specifications, unknown storage and
runtime-binding limits. The [cross-function task and oracle](call-oracle.md)
are fixed before its real-model trials; the graph wire format is version 3, with independent version-1 call facts.

`references` now selects incoming exact-address references or outgoing
instruction/function references, with native kind filtering, field selection and
paging. Source Evidence plus `source_row` identifies an occurrence. Function
applicability, excluded/unattributed rows, indirect targets and discovery stay
explicit. `fields:[]` requests only the always-retained identity columns across
projection contracts. The [reference question and independent oracle](reference-oracle.md)
cover real SQLite VM aggregates and a machine call omitted from optimized IR.

`bytes` reads explicit virtual-address ranges as native loaded-image hex without
decoding them as instructions. Batched reads preserve short reads and individual
failures, with 64 KiB aggregate selected-byte capacity to bound hex/bridge growth.
Complete hexdumps remain in Evidence. The original-file-offset mapping and live
runtime memory remain unknown. This closes a direct byte-reading contract gap
for data tables; it does not establish arbitrary memory-alias analysis.

`functions` provides selected name/alias/entry reads. Native snapshots report
code and recovered-IR facets separately, preserving readable code when graph
extraction is unavailable. Real capacity and cold/warm MCP checks are documented
in [native-engine.md](native-engine.md). Whole-model costs and unequal-depth
comparisons remain separate in the trial report.

The corrected SQLite comparison reaches the formatter implementation in all
three interfaces. Code Mode uses fewer calls than atomic direct in that sample;
a traditional run reusing its persistent whole-project cache is faster than
Code Mode's fresh lease. Cache state, completed-answer coverage and actual
uncached tokens must therefore accompany any cost comparison.

SDK views share immutable parsed inventories with their owner. A real SDK probe
initially changed a returned string and made the next query disappear under the
same Evidence ID. Freezing at the cache boundary fixes that producing rule,
without copying or parsing the entire inventory for each read. `verify-sdk.mjs`
checks the real provider's string/metadata/function views and complete retained
source digest. The fixed probe passes under the bounded runner (1.328 seconds,
1.144 family CPU seconds, 110.6 MiB kernel family peak, zero OOM kills and verified
payload cleanup); it is a correctness check, not a model-cost measurement.

Encoded size is another real coverage boundary: two SQLite functions initially
lose even their C because pretty JSON exceeds transport capacity. The native
patch now uses bounded compact serialization and a graph-only failure when
needed. Parser's full graph fits; Pragma retains identical C with an explicit
missing graph. The 8 MiB bound remains. See the exact sizes, rebuilt engine digest
and verification scope in [native-engine.md](native-engine.md).

Completion requires actual model Code Mode use, independently checked task
answers, shared atomic/direct/Code Mode semantics, needed relation coverage,
failure/cancellation/identity tests, and equivalent completed-task measurements
including discovery/retries, actual model usage, cold/warm analysis, CPU and
process-family peak memory. Negative cases such as the small SQLite function
must remain in the comparison.

The outgoing-reference real-model pair now completes with identical required
facts and explicit coverage limits. In its single sample, Code Mode uses 264,680
cumulative input / 93.837 seconds versus direct's 285,086 / 106.183. The shared
CLI/API also verifies the VM aggregates on unpatched stock Kuna 1.833. These are
scoped positive results alongside the earlier mixed adapter comparisons, not
proof of general superiority. Details and retained failed/partial attempts are
in [trials.md](trials.md).

Recovered calls and their boundary values now survive full-graph capacity
failure. The real VM capture preserves 416 call operations and 1,294 boundary
values while its graph remains unavailable. Values clearly state their partial
scope; definition IDs do not imply readable defining operations. See the
[boundary question and oracle](boundary-oracle.md) and its completed real-model
pair in [trials.md](trials.md). Both answers pass, using one VM capture each.
Code Mode's single-sample latency is lower, with mixed context costs; broader
efficiency remains unproven. The focused JS suite at that stage passes 49 tests.

Available snapshot call facets now include `by_opcode` known/unknown-target
counts and their own coverage. The owner derives them once from the same
validated immutable calls used by selected reads, including dead operations;
target knowledge is independent of opcode. Empty available facets report zeros,
while unavailable facets omit counts. This small aggregate addresses an observed
cost in the real boundary pair: paging the entire call set just to count it.
Both subsequent real-model answers satisfy the unchanged question/oracle without
that paging. In the new sample direct is faster and lower on cumulative/uncached
input than Code Mode, reversing the preceding latency ordering. Whole-task
effects remain mixed; see [the complete results](trials.md). This aggregate is a
shared fact-layer improvement, available to either adapter.

The shared owner also checks the native cleanup `Result` before releasing its
lease or clearing retained state. A tagged cleanup failure now stays retryable;
MCP errors retain the lease context and reported resources. The real SDK
failure-injection verifier first reproduces the old false success, then verifies
both close and target replacement retain the staged file/owner until a successful
retry. Both public MCP adapters preserve that error and retry successfully.
These use an injected tagged failure, not an observed engine cleanup incident;
native reads and subsequent cleanup use the real provider. See the recorded
scope and resource receipts in [native-engine.md](native-engine.md).

A [subsequent diagnostic probe](projection-experiment.md) measures the VM's full
17 MB recovered graph and much smaller selected definition neighborhoods. It
supports trying a bounded operation/value facet, while preserving unresolved
definitions and unavailable CFG. The following implementation now makes that
facet callable; the original diagnostic remains separate from public results.

`snapshot.facets.operations` distinguishes a complete recovered graph from a
bounded call-rooted definition projection. `operations`, `values`, selected
definition/use `relations` and `slice` share the same parsed operation owner in
either case. Projection coverage preserves unexpanded definition counts and
selected slice frontier reasons; CFG/controller reads remain unavailable.
Native operation reads retain `is_dead` and literal operand/value identities.
Coverage returns compact counts and bounded issue text, with complete native
details retained in Evidence. [The new question/oracle](projection-oracle.md)
are fixed before real-model trials of the PHI format alternatives.

Both first PHI-format model answers pass the full oracle using one VM analysis
and a six-operation selected trace, with the global graph/use limits intact.
The trace reveals two format sources at each shared call, verified against byte
and machine evidence. [Costs and source review](trials.md) also record a direct
documentation-lookup miss; named discovery needs fixing before rerunning the
same task. No general adapter speedup follows from that first pair.

Named reference lookup now accepts canonical IDs or exact displayed names,
including space/comma-separated lists. One presentation map supplies direct
registration and documentation names; unmatched terms remain explicit. Selected
schemas come from named contracts, use input semantics (defaulted fields stay
optional), and are cached immutably by Zod schema identity for the process.
Validation stays in the API registry; documentation has its own module. Both
actual MCP catalogs and all fourteen reference schemas validate. The unchanged
PHI question/oracle were rerun: both answers pass again, but direct has a native
timeout followed by a successful retry. Complete costs and the unknown timeout
cause remain in [trials.md](trials.md); this does not isolate an adapter speedup.

The next observed atom boundary is a wide PHI. One real VM operation has 156
inputs; its old default single-node slice is about 44 KB and exceeds the guest's
32 KiB result budget. Native operation/slice defaults now return opcode, output
and exact input/definition/constant counts. Explicit detailed fields still work.
`relations({kind:"operands",seeds:[id],input_indices:[0,105,155]})` reads selected
slots; omitting the selector pages all slots. Each slot retains value/definition
and phi predecessor/edge identity, including null values and definition-free
constants/inputs. Counts concern recovered facts, not source function arity.

Full and projected native operations use the same owner. Relationship paging
counts existing groups before materializing only the requested page; identity
reads deduplicate requested IDs in caller order. Diagnostic SSA explicitly lacks
native operand relations. The discriminated relation schema advertises the same
seed types and selector applicability enforced at runtime. The fourteen-method
API and both adapters remain shared; no new engine or output-budget increase is
needed. The [seeded wide-operand task/oracle](operands-oracle.md) is separate from
the earlier PHI-format question and is pinned before model trials.

Both actual wide-operand model answers now pass that fixed oracle, including
distinct edges sharing a value and absent-slot versus unretained-seed semantics.
Each performs one native analysis and reads only selected slots, distinct values
and their immediate definitions. Code Mode takes 95.699 seconds versus direct's
91.817, with nearly equal cumulative input and lower uncached input. Its four
discovery lookups prevent fewer MCP requests from becoming fewer model responses.
These [mixed costs](trials.md#selected-wide-phi-input-relationships) validate the
fact boundary while leaving broad efficiency unproven. The current shared JS
suite passes 57 tests; the Python cost-ledger suite passes three.

Discovery now also offers `reference({view:"index"})`: the complete fourteen
method names and descriptions, without schemas or return contracts. Follow with
`view:"contracts"` and exact names for only the needed inputs. The default
contract view and named/topic lookup stay compatible. Both views use the same
registry and presentation map; index access never constructs unrequested schemas.
The index describes declared methods, while `snapshot` remains the live coverage
authority. This addresses observed blind discovery without inventing aliases or
changing analysis facts; its whole-task effect must be measured on the unchanged
wide-operand question.

The identical question now completes correctly through both indexed adapters.
Code Mode uses the intended index plus one named lookup; discovery drops from
four calls to two, without changing the seven fact reads. The new pair takes
about 98.8 seconds each; cumulative input favors direct, uncached input favors
Code Mode. All four wide-operand answers pass, with no retry or OOM. Costs remain
mixed. A selected-slot read still incurs whole-function native decompilation on
a fresh lease; phase profiling is the next computation question, separate from
the now finer fact/query boundary.

The [native phase study](native-compute-study.md) now measures the VM drive at
about 34 seconds, C rendering at 0.22 seconds and projection at 0.03 seconds.
Repeated new native processes do not gain the API owner's warm result reuse.
Its subsequent [bounded codec implementation](native-graph-transport-study.md)
now returns the complete 21,349-operation VM graph in about 3.79 MB, inside the
unchanged 8 MiB wire budget. Selected definitions/CFG reads and decoded Evidence
work through both real MCP adapters; all graph fields and ordinary C/calls match
the prior complete golden. Same-lease reuse is about 67 ms after a 39.7-second
fresh capture, with resource limits and no OOM. The [next question/oracle](savepoint-control-oracle.md)
start from names/error messages and exercise the new condition/CFG coverage.
Two [real-model pairs](savepoint-control-study.md), including a discovery-guided
repeat, answer both local guards correctly without a whole-report fetch. Code
Mode uses fewer MCP requests, but whole-task costs are mixed and a large capture
time variation remains unexplained. Both clients already provide JavaScript
orchestration. Source fidelity is not machine equivalence, provider parity or a
general speedup. The [native switch experiment](switch-study.md) now exports and independently checks
182 labels over those 149 targets, exposes selected case-to-edge relations and
keeps them readable when a 2 MiB native output budget omits the full graph.
Both real models now answer the selected-case/default question correctly using
one retained capture and focused case/byte reads. Code Mode uses fewer tokens
in this pair, but unequal native capture time and extra client polling confound
the comparison. Whole-task costs and limits are in the same study; a general
efficiency advantage remains unproved. A common
[long-wait repeat](client-wait-study.md) reduces polling to one wait per lane;
both answers remain correct, but direct wins cumulative input and wall time
while Code Mode uses less uncached input. Runtime correctness, discovery,
composition choices and waiting all matter to the completed task.
