# Real-model trials (ongoing)

The first trial used the committed `5aa1c5c64` runtime, requested model alias
`gpt-6.1-sol` with high reasoning, Codex CLI 0.161.0 and the zlib question in this
directory. The resolved server-side model build is not inferred. Its actual
registered MCP server name was `rea-codemode`, with only the four Code Mode tools.
The runner requests disabled shell/file tools, web search, delegation and client
Code Mode feature flags. Actual transcripts nevertheless contain the client's
`exec` dispatch surface in every lane. The earlier inference that these flags
established an executor-free client was too strong; it is corrected here. The
actual trace separately establishes server-side `execute_javascript` use.

The model independently found the string and xref, requested the owning function's
snapshot, used operations/relations/slices and inspected reconstructed C. Its
answer identifies both error-block branches, the message/STORE origins, wrapper
bit condition and modulo-31 check, and correctly distinguishes local guards from
runtime reachability. It names memory, phi, traversal-budget and CFG limitations.
It records the exact target digest and real source Evidence IDs and closes the
target. These observations agree with the previous independent machine-byte and
arithmetic oracles; this is one stochastic local-question trial, not evidence of
general RE superiority.

| Measurement                                  | First Code Mode trial |
| -------------------------------------------- | --------------------: |
| Completed outer MCP calls                    |                    14 |
| Actual API calls                             |                    30 |
| Reconstructed C page reads                   |                    16 |
| Native source captures                       |                     3 |
| Cumulative model input tokens                |               581,617 |
| Cached input tokens (included above)         |               530,176 |
| Output tokens                                |                 3,822 |
| Reasoning output tokens (included in output) |                   869 |
| Model runner wall seconds                    |               130.348 |
| Bounded family elapsed seconds               |               130.824 |
| Bounded family CPU seconds                   |                11.842 |
| Kernel process-family memory peak MiB        |                 540.7 |
| OOM kills                                    |                     0 |

Artifact bytes were unchanged. The copied-authentication profile was removed;
both owner/observer cleanup checks passed. Memory includes charged file cache.
Actual token usage is cumulative across turns, including discovery and retries,
not a tokenizer estimate of the final answer. Cached and uncached tokens are
reported separately without assigning an unverified price.

The first empty workspace was nested beneath the trial output directory in the
repository. No source or oracle was copied into it and shell/file tools were
disabled. Subsequent trials move the profile under `/tmp` to remove ancestor
repository-instruction discovery as a possible confound. The first trial must
not be silently relabeled as having that stronger isolation.

The trace exposes two design shortcomings. Reference lookup supplied parameters
but omitted result shapes, making initial calls sequential shape discovery.
The C reader's arbitrary 128-line maximum made code compose many page reads even
though the complete function easily fits guest memory. Return contracts and
byte-budgeted internal C reads are being tested next. The missing native CFG and
phi predecessor relationships remain capability gaps, not problems to conceal
with reconstructed-C guesses.

Private captures remain under `.cache/atomic-codemode/zlib-codemode-v1/`, with
`events.jsonl`, `codex-tool-context.jsonl`, `answer.txt`, `summary.json`, explicit
trial settings and cleanup proof. The adjacent trace retains actual model code
and inner API calls; the `*-evidence/` directory retains the three complete native
sources and their identity/digest metadata. Credentials and raw captures are not
committed.

The second round used the pinned `c5cefd622` runtime, the same target, question,
model alias/reasoning and client version, with the empty model profiles outside
the repository under `/tmp`. Both atomic modes use the same eight fact methods;
only the calling adapter changes. The traditional comparison forces the real
Kuna provider and selects nine relevant production tools in the client:
`open_binary`, `close_binary`, `binary_session`, `search_strings`, `xrefs`,
`procedure_address`, `procedure_pseudo_code`, `procedure_assembly`,
`analyze_function`. The production catalog remains complete. This is a favorable
focused baseline, not the default full-catalog experience.

| Measurement                            | Atomic direct v2 | Atomic + Code Mode v2 | Traditional v2 |
| -------------------------------------- | ---------------: | --------------------: | -------------: |
| Outer MCP attempts, including failures |               27 |                    12 |              9 |
| Completed / failed outer attempts      |           27 / 0 |                12 / 0 |          7 / 2 |
| Internal Code Mode API reads           |                — |                    21 |              — |
| Cumulative model input tokens          |          590,872 |               453,734 |        344,105 |
| Cached input tokens (included)         |          496,512 |               401,664 |        297,344 |
| Uncached input tokens                  |           94,360 |                52,070 |         46,761 |
| Output tokens                          |            5,874 |                 4,738 |          3,076 |
| Reasoning tokens (included in output)  |            2,228 |                 1,716 |            832 |
| Model runner wall seconds              |          170.813 |               148.397 |        106.352 |
| Bounded family elapsed seconds         |          171.801 |               149.585 |        106.747 |
| Bounded family CPU seconds             |           11.898 |                22.129 |         20.666 |
| Kernel process-family memory peak MiB  |            578.2 |                 544.3 |          843.4 |
| OOM kills                              |                0 |                     0 |              0 |

The traditional trace includes a client approval-policy rejection for
`binary_session` and a failed name lookup for `inflate`; the model recovered
through string/xref/address discovery. Both attempts and their costs remain in
the comparison. A completed transport call does not itself establish a valid
analysis result; answers and the retained calls were reviewed separately.

All three answers identify the same two local error branches and modulo-31
condition, with supporting addresses and limitations consistent with the
independent instruction/arithmetic checks. This establishes a completed local
task comparison. It does not prove global runtime reachability or correctness
on arbitrary binaries. All target digests remained unchanged, temporary model
profiles were removed, and observed payload cleanup succeeded.

Code Mode reduces direct atomic MCP requests on this trial, but traditional tools
win both cumulative input tokens and wall time. The prototype still makes the
model assemble incomplete CFG/phi/value relationships and repeatedly inspect
operations or C. Fixing the arbitrary C page cap reduced internal C reads from
16 to 2; the overall first-to-second trial changes are not a controlled causal
measurement because return contracts and profile placement changed too.

These are single stochastic samples, with fresh provider/session caches, warm
and uncontrolled OS file caches, and actual model prompt-cache usage reported.
No warm-session paired reruns, confidence interval, server-side model compute or
pricing was measured. Reproduce the ledger with `summarize-trials.py` over the
private trial directories; it reads actual model usage and the payload-exit
cgroup receipt and deliberately does not grade answers.

The first native-IR model trial pins `a7e9f8843`, the same zlib question and model
settings, with patched Kuna SHA-256
`7d357e75ff252d04913fe9e55f3d02c71bceb0fe5cbdac12e9a47ef84151cfcc`.
Its source is upstream v1.833 plus `kuna-native-ir.patch`, built at optimization
level 1 with embedded specs and a fresh owned per-lease engine cache. The prior
stock-release comparison is not an engine/profile-controlled native-IR ablation.

The real model uses `relations(kind:"controllers")`, incoming edges, blocks,
indexed definition slices and native values. The answer agrees with the local
guard oracle, and correctly identifies accumulator phi predecessors 42, 43 and
38 while retaining unknown concrete state, path selection, memory aliases and
runtime successor coverage. API/transport calls succeed, the runtime input digest
is unchanged across the trial, the target digest is unchanged, the copied model
profile is removed and observed payload cleanup succeeds.

| Measurement                           | Native IR + Code Mode v3 |
| ------------------------------------- | -----------------------: |
| Outer MCP attempts / failed           |                   15 / 0 |
| Internal API reads                    |                       24 |
| Cumulative model input tokens         |                  600,857 |
| Cached input tokens (included)        |                  534,784 |
| Uncached input tokens                 |                   66,073 |
| Output / included reasoning tokens    |              4,131 / 649 |
| Model runner wall seconds             |                  117.773 |
| Bounded family elapsed seconds        |                  119.211 |
| Bounded family CPU seconds            |                   15.339 |
| Kernel process-family memory peak MiB |                    560.1 |
| OOM kills                             |                        0 |

The capability gap is narrower, but this trial still does not beat the earlier
traditional workflow on whole-task costs. The model performs four slices and
eleven operation reads. More precise facts allow useful qualification of the
answer, but also invite further investigation after the local question is
already substantially supported. This is a reason to test task-specific value
tracing and small-function counterexamples, rather than to claim that more
granular tool catalogs are inherently efficient. Private artifacts are named
`zlib-native-codemode-v3*` beside the earlier trials.

The value-origin task uses the same patched engine in both lanes, with fresh
provider/session caches and the pinned `f2f029c5d` runtime. It asks about the
accumulator at the already identified instruction origin `0xd9c9`; this is a
seeded follow-up investigation, not a repeated string-discovery task. The
traditional client retains its nine selected tools. Both traces use the real
Kuna engine, complete without API errors, preserve the target/runtime digests
and verify profile/payload cleanup with no OOM kills.

| Measurement                           | Native IR + Code Mode | Traditional |
| ------------------------------------- | --------------------: | ----------: |
| Outer MCP attempts                    |                     8 |           5 |
| Cumulative model input tokens         |               284,638 |     390,557 |
| Included cached input tokens          |               220,672 |     326,016 |
| Uncached input tokens                 |                63,966 |      64,541 |
| Output / included reasoning tokens    |           2,601 / 309 | 2,614 / 531 |
| Model runner wall seconds             |                72.403 |      91.832 |
| Bounded family elapsed seconds        |                72.841 |      92.254 |
| Bounded family CPU seconds            |                11.896 |      20.866 |
| Kernel process-family memory peak MiB |                 461.6 |       846.0 |

Both answers recover the three accumulator alternatives, byte loads, shifts,
additions, local bit-count conditions and unknown state. The native answer,
however, says that the branch at `0xd97e` directly reaches `0xd9c9`. This describes
the optimized recovered CFG, but the actual bytes `0f87e9080000` encode
`JA 0xe26d`; `0xe270` then encodes `JMP 0xd9c9`. The traditional answer identifies
that machine predecessor and intervening copy/jump. This was checked separately
with the shipped machine bytes, rather than accepting either model's answer as
the oracle.

The native trace's lower cumulative input and wall time therefore do **not** yet
establish an equal-correctness completed-task win. Uncached input is also almost
equal; cached cumulative input alone is not an economic-cost measurement. The
representation ambiguity needs a structural fix: distinguish IR origin fields
from physical instruction facts and expose selected instruction windows, then
rerun the unchanged question. Private artifacts are `zlib-value-codemode-v1*`
and `zlib-value-traditional-v1*`.

After separating IR origins and adding instruction windows, the unchanged value
question was rerun at `4f13bd673`. The Code Mode answer now reads actual machine
bytes and correctly distinguishes recovered predecessor 38 from the intervening
`0xe26d` / `0xe270` machine path. Both answers recover the same local value
equations, byte-order conditions and unknown invariants. These remain individual
stochastic samples, not a general speedup guarantee.

| Measurement                 | Code Mode value v2 | Traditional value v2 |
| --------------------------- | -----------------: | -------------------: |
| MCP attempts / failures     |              7 / 0 |                6 / 1 |
| Cumulative input tokens     |            296,888 |              573,881 |
| Included cached input       |            252,160 |              512,128 |
| Uncached input              |             44,728 |               61,753 |
| Output / included reasoning |        3,176 / 594 |          2,830 / 547 |
| Model wall seconds          |             96.662 |              124.754 |
| Family wall seconds         |             97.654 |              125.410 |
| Family CPU seconds          |             19.495 |               44.143 |
| Kernel family peak MiB      |              534.4 |                797.4 |

The traditional failure is the client policy rejection of `binary_session`.
Its cost remains included. Both runtime/target digests stay unchanged, cleanup
is verified and OOM kills are zero. This is evidence of a useful seeded
value-tracing case for the revised interface, with the selected-tool and
single-sample qualifications retained.

The initial SQLite diagnostic comparison, also at `4f13bd673`, exposes a further
capability/comparison gap:

| Measurement                 | Code Mode SQLite v1 | Traditional SQLite v1 |
| --------------------------- | ------------------: | --------------------: |
| MCP attempts / failures     |              14 / 0 |                17 / 8 |
| Cumulative input tokens     |             601,445 |               934,237 |
| Included cached input       |             535,296 |               831,744 |
| Uncached input              |              66,149 |               102,493 |
| Output / included reasoning |       4,790 / 1,668 |         3,878 / 1,121 |
| Model wall seconds          |             143.469 |               231.469 |
| Family CPU seconds          |              18.996 |               154.132 |
| Kernel family peak MiB      |               586.6 |               1,200.2 |

Both answers find the two malformed-message conditions and distinguish the
depth-error, other-status and success paths. The traditional answer additionally
resolves the named formatter implementation at `0x5efc0`, tracing free,
`sqlite3_vmprintf` and pointer storage; Code Mode stops at its PLT stub and
correctly leaves delivery/allocation unknown. These are unequal-depth answers,
so the cost difference is not an equal-completion win.

The selected traditional catalog also omitted `list_procedures`, despite errors
advertising it as the discovery route. The trace retains interior-entry failures,
failed resource discovery, a client approval-policy rejection and ambiguous name
lookups. This selection confound must be corrected in the next focused baseline;
the failed attempts and their costs are not discarded. Both runs still preserve
target/runtime identity, clean up their profiles/payloads and have zero OOM kills.

The corrected SQLite comparison pins `e9b9a8dd0`, the same question and patched
engine, and the same requested model alias/reasoning. Both experimental adapters
now expose twelve identical fact methods, including the missing function-entry
lookup. The direct lane uses explicit direct-API instructions rather than being
told to call a nonexistent Code Mode entrypoint. The traditional selected
catalog replaces `binary_session` with `list_procedures`; exact-name discovery
guidance is enabled. These instruction/catalog changes are recorded and are not
retroactively applied to earlier trials.

| Measurement                  |  Code Mode v2 | Atomic direct v1 | Traditional cold v2 | Traditional reused-cache v1 |
| ---------------------------- | ------------: | ---------------: | ------------------: | --------------------------: |
| MCP attempts / failures      |        12 / 0 |           24 / 0 |              14 / 2 |                      11 / 1 |
| Unique model responses       |            14 |               14 |                  33 |                          13 |
| Client `exec` / `wait` calls |        13 / 0 |           13 / 0 |             15 / 17 |                      12 / 0 |
| Internal Code Mode API reads |            15 |                — |                   — |                           — |
| Cumulative input tokens      |       454,914 |          464,979 |           1,093,061 |                     432,446 |
| Included cached input        |       414,080 |          371,712 |           1,036,928 |                     377,600 |
| Uncached input               |        40,834 |           93,267 |              56,133 |                      54,846 |
| Output / included reasoning  | 3,636 / 1,129 |    4,591 / 1,482 |         4,056 / 787 |                 2,889 / 488 |
| Model wall seconds           |       126.250 |          146.656 |             346.051 |                      98.210 |
| Family wall seconds          |       127.171 |          147.151 |             346.491 |                      98.690 |
| Family CPU seconds           |        16.199 |           18.445 |             219.655 |                      15.601 |
| Kernel family peak MiB       |         598.2 |            565.0 |             1,128.7 |                       779.2 |

All four answers cover the two malformed-message selectors, original expression
argument, formatter implementation, free/`vmprintf`/pointer store, missing local
allocation-success check, separate depth/status/success paths, and static-only
limitations. They agree with the independent instruction checks recorded below.
The reused-cache traditional answer supports the closing-parenthesis decrement
with reconstructed C; its returned assembly excerpt omits that destination. The
other three obtain the decrement's actual instructions. This evidentiary-depth
difference is retained rather than claiming byte-for-byte identical answers.

The remaining traditional failures are an interior-address `analyze_function`
request in both runs and an ambiguous function-name lookup in the cold run.
`list_procedures` is available and used. Neither is a policy rejection or a
deliberately missing discovery tool. Errors and retries stay in total costs.

Traditional cold analysis creates a validated persistent project containing
3,923 decompiled functions, a 4.4 MB C export and a 17.5 MB assembly export. The
next fresh model profile uses the same explicit project cache. Its retained
manifest binds the target digest, patched engine digest and one-job setting.
The large cold/warm CPU difference is consistent with avoiding this project
creation; model strategies also differ, so it is not a controlled measurement
of cache speedup alone. Experimental Code Mode/direct analyze selected functions
and reuse captures only within a lease; cross-session result caching is absent.
Comparing their cold run with the traditional reused-cache run cannot establish
an adapter speedup. In this sample, the latter is faster and has fewer cumulative
input tokens than Code Mode. All four target/runtime identities, profile/payload
cleanup checks pass, with no OOM kills. The private ledger is
`round-e9b9a8d-ledger.json`; each table cell remains one stochastic trial.

The task oracle for this SQLite artifact (SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`)
is the shipped machine code, checked independently of model answers: wrapper
entry `0x65180`; status comparisons `0x65230` / `0x65239`; context-field load/test
`0x65268` / `0x65270`; format load `0x65284`; emission call `0x65290`;
parenthesis increment `0x64699` and decrement `0x64c92`; formatter implementation
`0x5efc0`, free call `0x5f031`, formatting call `0x5f062` and pointer store
`0x5f067`. Named PLT entries and runtime binding remain separate from that local
static implementation evidence. No SQL input was executed to prove feasibility.

Coverage must be sufficient for the particular question before reporting an
equal-completion cost comparison. More tools or a successful MCP transport do
not establish this. Current gaps include exact-address-only xrefs, a minimum-five
string inventory, unknown runtime successors and memory aliases, and bounded IR
extraction. In particular, real `sqlite3VdbeExec` exceeds the graph limit while
retaining 3,654 lines of C. A local successful diagnostic task does not prove
full Kuna/Ghidra/IDA parity or arbitrary complex-function coverage.

The separate large-VM diagnostic task pins `5aa78c873`, with question and
independent instruction anchors committed before running the models in
[evaluation.md](evaluation.md). It uses the corrected traditional selection and
guidance, the same patched engine and model settings, and serial bounded trials.
The fresh traditional project cache is reused only for its explicitly labeled
fourth run. None of these trials uses the later opt-in envelope/stopping guidance.

| Measurement                  | Code Mode VM v1 | Atomic direct VM v1 | Traditional cold VM v1 | Traditional reused-cache VM v1 |
| ---------------------------- | --------------: | ------------------: | ---------------------: | -----------------------------: |
| MCP attempts / failures      |          14 / 0 |              20 / 0 |                 10 / 2 |                         14 / 5 |
| Unique model responses       |              18 |                  17 |                     27 |                             18 |
| Client `exec` / `wait` calls |          15 / 2 |              13 / 3 |                12 / 14 |                         17 / 0 |
| Cumulative input tokens      |         729,420 |             594,606 |                698,971 |                        617,340 |
| Included cached input        |         664,960 |             526,720 |                625,152 |                        543,616 |
| Uncached input               |          64,460 |              67,886 |                 73,819 |                         73,724 |
| Output / included reasoning  |     4,474 / 975 |       4,287 / 1,045 |            4,565 / 999 |                  4,446 / 1,290 |
| Model wall seconds           |         243.082 |             218.541 |                342.966 |                        185.580 |
| Family wall seconds          |         244.298 |             219.062 |                343.367 |                        186.321 |
| Family CPU seconds           |          89.693 |              79.343 |                207.596 |                         28.162 |
| Kernel family peak MiB       |           871.2 |               858.9 |                1,408.6 |                          783.2 |

All four answers correctly distinguish selector zero plus signed positive
`db+0xd8` for open, found name plus selector one plus the same positive counter
for release, the shared `0xf238b` emission / local status five, and missing-name
precedence with status one. They preserve offsets, real source references and
static-only limitations. None falsely promotes local status five into an
unconditional final return. Both atomic answers explicitly name the VM's
unavailable graph facet while using its valid C and selected machine windows.
The cold traditional answer omits the optional formatter implementation detail;
the other three include it. The fixed question concerns local message selection
and joins, so that extra detail is not required for its completion.

The traditional failures are ambiguous procedure names (and consequent
name-selected assembly/pseudocode failures in the reused-cache run), not missing
discovery tools or client approval rejections. Costs are retained. The final
traditional model does not explicitly call `close_binary`; teardown still
verifies payload/profile cleanup. Both target/runtime identities remain unchanged
in all four runs, and OOM kills are zero. These are four single stochastic
observations, not confidence intervals.

This larger local task is a useful counterexample to an automatic Code Mode
win: atomic direct has fewer cumulative input tokens and lower wall time than
Code Mode despite making more MCP requests; traditional with a reused project
is fastest. Uncached input is closer across the lanes. Source review shows that
the models choose different investigation sequences and optional helper depth.
The prototype can complete this task through an unavailable IR facet; a claim
of general complex-software superiority is still unsupported.

Actual client dispatch matters to interpreting **all** these tables. The direct
atomic SQLite run performs 24 MCP requests inside 13 client `exec` calls; Code
Mode performs 12 MCP requests inside the same 13 client `exec` calls. Both have
14 observed model responses. Thus halving MCP requests does not halve model
round trips here. The traditional client can also combine calls and filter
results in JavaScript. These lanes compare server-side Code Mode with direct MCP
surfaces under that same capable client, not JavaScript versus a client incapable
of composition. `summarize-trials.py` now counts unique response/call identities
from actual retained events and verifies that per-response usage sums to the
runner's declared totals. Missing captures remain unknown. Client waiting during
long analysis is part of completed-task cost, not additional analysis facts.

After repairing encoded-output capacity, a model task over the restored Pragma
code pins `9e1b39358` and the rebuilt `2290e8b1…` engine. Both experimental lanes
have identical fact capabilities and common envelope/stopping guidance enabled;
this is not a rerun with only one changed variable relative to older tasks.
The question and independent instruction anchors were committed before the runs.
No traditional cell was run for this new question.

| Measurement                  | Code Mode Pragma v1 | Atomic direct Pragma v1 |
| ---------------------------- | ------------------: | ----------------------: |
| MCP attempts / failures      |              11 / 0 |                  14 / 0 |
| Unique model responses       |                  13 |                      12 |
| Client `exec` / `wait` calls |              12 / 0 |                  11 / 0 |
| Cumulative input tokens      |             370,307 |                 353,364 |
| Included cached input        |             333,184 |                 278,272 |
| Uncached input               |              37,123 |                  75,092 |
| Output / included reasoning  |         3,612 / 803 |             2,830 / 326 |
| Model wall seconds           |             121.459 |                 107.625 |
| Family wall seconds          |             122.256 |                 108.066 |
| Family CPU seconds           |              20.003 |                  20.261 |
| Kernel family peak MiB       |               590.1 |                   560.6 |

Both answers match the machine oracle: null value pointer reads without the
state check; a supplied value plus zero `D+0x65` selects the diagnostic before
the selector-one bypass; allowed updates write the transformed byte at `S+0x10`
and one at `S+0x11`; the diagnostic and shared cleanup have the correct physical
addresses. Both avoid inventing source member names or a numeric return from the
void reconstruction, preserve Evidence/target identity, and explicitly state
the unavailable graph and unknown runtime feasibility/binding. Cleanup is
verified, runtime/target bytes stay unchanged and OOM kills are zero.

The restored C now supports a completed real-model task in both interfaces.
Code Mode has fewer MCP requests and fewer uncached input tokens here; direct
atomic has fewer model responses, lower cumulative input/output and shorter wall
time. Prompt-cache state and model strategy remain uncontrolled, so no economic
or general adapter ranking follows. The native byte-budget repair is a coverage
fix, not a demonstrated Code Mode speedup. Private captures and the separate
`round-9e1b393-ledger.json` retain these observations.

The table-dispatch task pins `73db4fad5`, the same rebuilt engine and thirteen
shared fact methods. This time direct runs first, followed serially by Code
Mode; both use common envelope/stopping guidance, fresh analysis leases and
isolated empty model profiles. Independent machine instructions and direct file
table reads were committed as the oracle before model execution.

| Measurement                  | Atomic direct table v1 | Code Mode table v1 |
| ---------------------------- | ---------------------: | -----------------: |
| MCP attempts / failures      |                  8 / 0 |              7 / 0 |
| Unique model responses       |                     10 |                  9 |
| Client `exec` / `wait` calls |                  9 / 0 |              8 / 0 |
| Cumulative input tokens      |                244,235 |            225,673 |
| Included cached input        |                200,704 |            190,848 |
| Uncached input               |                 43,531 |             34,825 |
| Output / included reasoning  |          3,055 / 1,024 |        2,765 / 355 |
| Model wall seconds           |                108.774 |            101.033 |
| Family wall seconds          |                109.281 |            101.523 |
| Family CPU seconds           |                  9.683 |              9.606 |
| Kernel family peak MiB       |                  490.5 |              495.3 |

Both models actually read the class and relative-jump tables through `bytes`.
All six class values and destinations match the independent artifact oracle,
including unsigned indexing for `0x80`, signed 32-bit displacement extension,
the correct table base and the shared destination for `0x22` / `0x27`. They keep
source IDs and complete-for-requested-range coverage, distinguish loaded-image
observations from arithmetic derivations, and do not infer final token types,
lengths or runtime feasibility. No decompilation is needed for these answers.
Code Mode composes `functions`, `instructions` and two `bytes` reads.

This is a successful example of composing small RE facts into a useful answer.
Its Code Mode sample has lower observed task token counts and wall time; CPU is
almost the same and memory is slightly higher. Each cell is still one stochastic
sample, with uncontrolled prompt/OS caches and no traditional cell. It establishes
neither a general cost ranking nor complex-program completeness. Target/runtime
identities stay unchanged, cleanup verifies and OOM kills are zero. The private
ledger is `round-73db4fa-ledger.json`.

## Cross-function call task: preserved rejected launch

Question/oracle and fourteen shared fact methods were fixed at `33c4282b8`.
The initial `sqlite-call-codemode-v1` model sees `engine_profile_mismatch` at
`open_binary`, then closes and reports that analysis is unavailable. Cargo's
non-embedded test build had overwritten the selected mutable executable; the
engine digest guard correctly rejects it. No target digest or Evidence is
returned. This is an experimental setup failure, not a completed analysis or an
accuracy/speed win. Runtime JS and target bytes remain unchanged.

Actual requested `gpt-6.1-sol/high` usage is 107,489 input (81,280 cached,
26,209 uncached), 565 output including 101 reasoning tokens; five observed model
responses, four client exec calls and three MCP requests. MCP transport requests
complete, but the open API result is a failure. Model wall time is 40.205 seconds,
family CPU 3.619 seconds and memory peak 436.6 MiB. Cleanup is verified, OOM 0.
The failed sample and raw receipts remain under `.cache/atomic-codemode/` and
are excluded from correctness-equal paired costs. Subsequent attempts use an
independent preserved executable and explicit pre/post engine validation.

## Cross-function call task: initial question pair

`sqlite-call-codemode-v2` and `sqlite-call-atomic-direct-v2` both run at
`01e5c5955`, with engine `64c6b3f...` from an independent preserved executable.
The fourteen fact methods, native profile, artifact, requested model/effort and
common guidance match; Code Mode runs first. Runtime, engine and target bytes
remain unchanged, per-response usage matches runner totals, cleanup is verified
and OOM kills are zero. Both fresh target leases use uncontrolled warm OS caches.

| Measurement                          | Code Mode call v2 | Atomic direct call v2 |
| ------------------------------------ | ----------------: | --------------------: |
| MCP requests / transport failures    |            10 / 0 |                27 / 0 |
| Observed model responses             |                13 |                    16 |
| Client exec calls                    |                12 |                    15 |
| Model wall seconds                   |           168.622 |               156.033 |
| Family wall seconds                  |           169.190 |               156.570 |
| Family CPU seconds                   |            16.096 |                15.854 |
| Family memory peak MiB               |             514.0 |                 608.1 |
| Cumulative input tokens              |           454,199 |               564,158 |
| Cached input tokens                  |           377,216 |               497,408 |
| Uncached input tokens                |            76,983 |                66,750 |
| Output tokens, including reasoning   |             4,987 |                 4,838 |
| Reasoning tokens, included in output |             1,301 |                   935 |

Both answers correctly connect call `0x65211 -> 0x64060`, caller SSA
`v100000118`, passing storage `register:0x38/8`, and callee input `v300000042`.
They verify caller LEA, helper pointer preservation, character dispatch,
field increment/decrement and the caller's post-success field check against
selected machine bytes. They preserve storage-match/alias and runtime
limitations. Code Mode actually composes `calls`, `values`, operations and machine
reads; direct uses the same primitives, including a bounded slice. All ten/nine
cited Evidence sources respectively have matching retained-source SHA-256 and
artifact identity.

Neither final answer includes the original oracle's required separate routing
for helper return 1 and 18. The question only explicitly asked to distinguish
successful/malformed paths; the oracle was stricter than that wording. Do not
retroactively delete this requirement or mark either sample a full-oracle pass.
The task wording is now clarified before the next paired round, retaining the
same oracle and adding no solution addresses. The table is an observed partial
coverage result, not a completed-task efficiency claim. Its mixed costs also
do not show a general Code Mode advantage: cumulative input is lower while
uncached input and wall time are higher in this sample.

Raw ledger: `.cache/atomic-codemode/ledger-call-round-01e5c59.json`. Each cell is
one stochastic sample. The complete client already provides JavaScript dispatch
in both lanes. No new traditional-provider cell is being claimed.

## Cross-function call task: explicit return-path pair

Both `sqlite-call-atomic-direct-v3` and `sqlite-call-codemode-v3` use `e9348df0c`
and the clarified question, fixed before either lane starts. This time direct
runs first. Engine, fourteen fact methods, model/effort request and common
instruction settings match the prior pair. Runtime, selected engine and target
bytes remain unchanged. Target leases and native caches are fresh; OS/page and
remote prompt caches are not reset. Per-response token totals match runner usage,
process/profile cleanup is verified, and OOM kills are zero.

| Measurement                            | Atomic direct call v3 | Code Mode call v3 |
| -------------------------------------- | --------------------: | ----------------: |
| MCP requests / transport failures      |                30 / 0 |            12 / 0 |
| Observed model responses               |                    16 |                14 |
| Client exec calls                      |                    15 |                13 |
| Model wall seconds                     |               147.424 |           156.821 |
| Family wall seconds                    |               147.922 |           157.307 |
| Family CPU seconds                     |                15.678 |            17.514 |
| Family memory peak MiB                 |                 537.9 |             478.0 |
| Cumulative input tokens                |               611,321 |           596,978 |
| Cached input tokens                    |               544,256 |           528,768 |
| Uncached input tokens                  |                67,065 |            68,210 |
| Output tokens, including reasoning     |                 4,405 |             4,954 |
| Reasoning tokens, included in output   |                   673 |             1,046 |
| Largest observed response input tokens |                64,471 |            65,964 |

Both answers meet the clarified question's context/field/control-flow and
return-code requirements. They identify the exact caller/callee SSA and passing
storage, independently verify the actual call/pointer setup, field updates and
counter test, and distinguish helper returns 0, 1 and 18. Both correctly separate
the wrapper depth diagnostic (argument 12) from the helper nesting limit 1000.
They preserve memory-alias/traversal and runtime-feasibility uncertainty.
The fspec ownership regression is separately verified at the producer/MCP
boundary; neither answer claims a machine target from an annotation offset.
All eight/nine cited sources respectively have matching retained-source digests,
target identity and selected engine digest.

This is a successful, correctness-equal example of the new call/input facts in
real model work. It is not a general Code Mode efficiency win: cumulative input
is only about 2.3% lower, while uncached input, output, maximum observed response
input, CPU and elapsed time are higher. MCP requests fall 60%, but actual model
responses fall only 12.5%. Peak process-family memory is lower in this sample.
One stochastic cell per lane, differing chosen excerpts and uncontrolled caches
cannot establish causality or a repeatable effect. The existing client offers
JavaScript dispatch in both lanes; no new traditional-provider cell was run.

Raw ledger: `.cache/atomic-codemode/ledger-call-round-e9348df.json`; independent
answer/source review: `.cache/atomic-codemode/call-v3-answer-review.json`. The
largest-response metric is the maximum observed per-response input usage,
including cached tokens, rather than an estimate from serialized bytes. Memory
is the kernel cgroup process-family peak, including charged file cache. Remote
model CPU/memory, resolved server model build and monetary cost are unmeasured.

## Shallow reference aggregation: real-model pair

Both runs use `3aa685db3`, the pre-pinned reference question/oracle, the same
preserved `64c6b3f...` engine and fourteen fact methods. Code Mode runs first;
all other model/effort and common-guidance settings match. Each lease/native
cache is fresh; OS/page and remote prompt caches remain uncontrolled. Both have
unchanged runtime, engine and target bytes; per-response token totals match the
runner. Source capture, process/profile cleanup and OOM-zero receipts verify.

| Measurement                            | Code Mode references v1 | Atomic direct references v1 |
| -------------------------------------- | ----------------------: | --------------------------: |
| MCP requests / transport failures      |                   8 / 0 |                      20 / 0 |
| Observed model responses               |                      10 |                          11 |
| Client exec calls                      |                       9 |                          10 |
| Model wall seconds                     |                  93.837 |                     106.183 |
| Family wall seconds                    |                  94.371 |                     106.799 |
| Family CPU seconds                     |                  12.504 |                      15.934 |
| Family memory peak MiB                 |                   518.7 |                       523.5 |
| Cumulative input tokens                |                 264,680 |                     285,086 |
| Cached input tokens                    |                 238,720 |                     247,424 |
| Uncached input tokens                  |                  25,960 |                      37,662 |
| Output tokens, including reasoning     |                   2,766 |                       3,204 |
| Reasoning tokens, included in output   |                     420 |                         533 |
| Largest observed response input tokens |                  33,716 |                      33,798 |

Both answers satisfy all question requirements: parser implementation rather than
same-name PLT entry; nine lifted references versus eight IR calls; verified
`0x6534b -> 0x29370` stack-canary failure call and guard; VM aggregates
396/171/16; and verified `0xf238b -> 0x296c0`. Both compose all four VM pages
locally with no full VM decompilation or instruction/source report. Both preserve
unknown indirect/discovery coverage, static symbol-binding limits and the
non-equivalence of optimized IR to the executable.

Each answer cites six source IDs. Every retained source digest, target digest
and selected engine digest verifies. The VM reference pairs in both real-model
captures exactly match all independent GNU objdump direct-call pairs. Both
reference pages cover source rows 0–395 with a terminal null continuation. Raw
Evidence remains in the explicit capture directory after the API lease closes;
its IDs are not live handles in a newly opened lease.

This is one positive aggregation sample: Code Mode uses about 7.2% fewer
cumulative input tokens and 11.6% less wall time. Uncached input, output and CPU
are also lower here; observed peak input context and memory are close. Reducing
MCP requests 60% yields only one fewer observed model response. The client's own
JavaScript dispatcher lets direct calls aggregate locally too. With one
stochastic sample per lane and no reset of remote/file caches, these numbers do
not establish a general causal advantage. Earlier cross-function pairs remain
mixed; the questions have different required work and must not be treated as a
before/after speedup comparison.

Ledger: `.cache/atomic-codemode/ledger-reference-round-3aa685d.json`; manual
answer/source review: `reference-answer-review-v1.json` in the same cache root.
The measured artifact belongs to Debian `libsqlite3-0:amd64` version
`3.40.1-2+deb12u2`. Remote model CPU/memory, resolved server model build, pricing
and development/parent-conversation token costs remain unmeasured here.

Across this continuation's seven model launches (one setup rejection, two
initial partial-oracle answers, four completed answers), cumulative usage is
2,883,911 input, including 2,515,072 cached and 368,839 uncached; output is 25,719,
including 5,009 reasoning. Summed model wall time is 869.125 seconds. This
research-attempt cost is separate from the successful paired tables and excludes
native builds, scripted verifiers and development conversation. Failed/partial
attempts are retained rather than hidden in a selected success result.

## Calls beyond graph capacity: real-model pair

The question and acceptance oracle are committed before either launch in
`f9f9dc209`. Both lanes use its fourteen shared fact methods and the preserved
`e7d3f0cc...` embedded-spec engine. Direct runs first this time. Both request
`gpt-6.1-sol/high`, identical common envelope/stopping guidance, fresh leases and
native caches, one CPU and the same 4 GiB hard / 3 GiB early-stop bounds. OS and
remote prompt caches are uncontrolled. This question requires one VM analysis;
the preceding shallow-reference task does not, so their elapsed times are not
a before/after adapter comparison.

| Measurement                            | Atomic direct boundary v1 | Code Mode boundary v1 |
| -------------------------------------- | ------------------------: | --------------------: |
| MCP requests / transport failures      |                    18 / 0 |                 9 / 0 |
| Observed model responses               |                        13 |                    12 |
| Client exec / wait calls               |                    10 / 2 |                 9 / 2 |
| Model wall seconds                     |                   146.865 |               127.791 |
| Family wall seconds                    |                   148.137 |               128.304 |
| Family CPU seconds                     |                    44.640 |                43.600 |
| Family memory peak MiB                 |                     869.2 |                 865.0 |
| Cumulative input tokens                |                   332,318 |               321,922 |
| Cached input tokens                    |                   304,768 |               294,144 |
| Uncached input tokens                  |                    27,550 |                27,778 |
| Output tokens, including reasoning     |                     3,927 |                 3,188 |
| Reasoning tokens, included in output   |                       870 |                   439 |
| Largest observed response input tokens |                    34,549 |                35,170 |

Both complete answers satisfy the fixed oracle. They select implementation entry
`0xea6d0`, distinguish available C/calls/boundary values from the unavailable
graph, aggregate 395 known direct and 21 unresolved indirect recovered calls,
and identify the two selected targets, distinct fspec annotations, argument
slots/passing storage and shared input value `v30000004b`. Focused machine
windows verify the selected CALL bytes and essential argument setup. Both state
that retained definition IDs do not provide operation bodies, full def/use,
aliases or runtime coverage. The Code Mode answer additionally inspects the PLT
stub; independent GNU disassembly verifies its `JMP [0x15a2f8]` at `0x296c0`.

Each lane performs exactly one VM decompilation and reuses that source for its
call/value reads. Direct composes four count pages and a selected call read;
Code Mode retains the selected rows while aggregating its four pages locally.
All six/seven captured sources respectively verify their hashes, target and
engine identities; all three/four cited IDs exist. The full retained VM function
records are identical across lanes. Every recovered direct pair belongs to the
independent 396-pair machine oracle, with only `0xf2493 -> 0x29370` absent; all
21 indirect origins match. This corroborates the stated coverage, not complete
machine/IR or runtime equivalence.

Runtime/engine/target fingerprints remain unchanged; per-response usage totals
match the runner; profile/process cleanup and OOM-zero receipts verify. Code
Mode uses about 3.1% less cumulative input and 13.0% less model wall time in this
single sample, but slightly more uncached input and a larger maximum response
context. Memory peaks are close. Both clients have JavaScript dispatch; halving
MCP requests saves only one model response. This is a useful capability result
with mixed context costs, not a repeatable causal efficiency claim or provider
parity result.

Ledger: `.cache/atomic-codemode/ledger-boundary-round-f9f9dc2.json`; full-answer
and source review: `boundary-answer-review-v1.json` beside it. Pair totals are
654,240 input tokens (598,912 cached, 55,328 uncached), 7,115 output tokens
(1,309 included reasoning) and 274.656 model wall seconds. These totals include
discovery and extra reads. Builds, scripted verification, development/parent
conversation, resolved server model build, remote CPU/memory and monetary cost
remain unmeasured by this pair. Lease/native analysis is cold; subsequent reads
are warm within the same lease, not a cross-session result-cache benchmark.

## Shared compact counts: same question, new pair

Revision `da6f5470b` adds snapshot call-count metadata through the shared owner.
The question, acceptance oracle, artifact, preserved engine, fourteen methods,
model/effort request, common guidance and resource policy remain the same as the
preceding pair. Code Mode runs first, direct second; both use fresh leases/native
caches. No runtime source or HEAD changes occur during either pair. These are
single stochastic runs, with uncontrolled OS and remote prompt caches.

| Measurement                            | Code Mode boundary v2 | Atomic direct boundary v2 |
| -------------------------------------- | --------------------: | ------------------------: |
| MCP requests / transport failures      |                 7 / 0 |                    14 / 0 |
| Observed model responses               |                    12 |                        12 |
| Client exec / wait calls               |                 8 / 3 |                     9 / 2 |
| Model wall seconds                     |               149.559 |                   137.633 |
| Family wall seconds                    |               150.643 |                   138.180 |
| Family CPU seconds                     |                46.984 |                    45.417 |
| Family memory peak MiB                 |                 849.8 |                     838.2 |
| Cumulative input tokens                |               268,377 |                   235,640 |
| Cached input tokens                    |               235,136 |                   215,552 |
| Uncached input tokens                  |                33,241 |                    20,088 |
| Output tokens, including reasoning     |                 3,726 |                     3,541 |
| Reasoning tokens, included in output   |                   919 |                       620 |
| Largest observed response input tokens |                31,307 |                    27,410 |

Both answers pass the unchanged full oracle, including selected machine checks,
annotation/target separation, input identity, partial value scope and unreadable
definition/use/runtime limits. Each uses the shared aggregate and makes only one
call read for the two selected origins: neither pages the full 416-call set.
Each still makes exactly one VM decompilation. All four cited sources per answer
exist; all seven retained sources per lane verify their digests and target/engine
contexts. The complete native VM function records equal each other and the v1
captures, so the metadata change preserves the observed native facts. Independent
machine-pair/indirect-origin checks retain the same 395/21 coverage and single
omitted stack-check call. Runtime/target/engine fingerprints, per-response usage,
process/profile cleanup and OOM-zero receipts verify.

Compared with its own v1 sample, direct uses about 29.1% less cumulative input,
27.1% less uncached input and 6.3% less model wall time; its CPU is slightly
higher. Code Mode uses about 16.6% less cumulative input, but 19.7% more uncached
input and 17.0% more model wall time. Its model-response count stays twelve.
The summary eliminates the observed paging work in both lanes, but these runs
do not establish a general latency or uncached-token improvement. Across the two
new cells, cumulative input is 23.0% lower than v1, while summed model wall time
is 4.6% higher. These are observations, not isolated causal effects.

Within v2, direct is lower on every reported token category, elapsed time, CPU,
peak response input and family memory, despite twice the MCP requests and the
same number of model responses. This reverses the preceding sample's latency
ordering. A useful shared aggregate can change the adapter comparison; keeping
the underlying direct tools needlessly granular would bias it. Neither RPC count
nor smaller cumulative input alone establishes whole-task efficiency. The client
has JavaScript dispatch in both modes; no new traditional-provider cell or
general complex-software superiority claim follows.

Ledger: `.cache/atomic-codemode/ledger-boundary-counts-round-da6f547.json`;
full-answer/source review: `boundary-counts-answer-review-v2.json` beside it.
Pair totals are 504,017 input (450,688 cached, 53,329 uncached), 7,267 output
(1,539 included reasoning) and 287.192 model wall seconds. The four boundary
launches together cost 1,158,257 input (1,049,600 cached, 108,657 uncached),
14,382 output (2,848 included reasoning) and 561.848 model wall seconds.
Failed/partial earlier experiments remain recorded above. Builds, public
scripted checks, development conversation, server model build, remote compute
and money remain outside these model-pair totals. The unresolved capability is
selected definition bodies/relationships after full-graph failure, not call
counting or selected argument identity.
