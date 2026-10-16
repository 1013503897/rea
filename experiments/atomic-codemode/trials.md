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

| Measurement | Atomic direct v2 | Atomic + Code Mode v2 | Traditional v2 |
| --- | ---: | ---: | ---: |
| Outer MCP attempts, including failures | 27 | 12 | 9 |
| Completed / failed outer attempts | 27 / 0 | 12 / 0 | 7 / 2 |
| Internal Code Mode API reads | — | 21 | — |
| Cumulative model input tokens | 590,872 | 453,734 | 344,105 |
| Cached input tokens (included) | 496,512 | 401,664 | 297,344 |
| Uncached input tokens | 94,360 | 52,070 | 46,761 |
| Output tokens | 5,874 | 4,738 | 3,076 |
| Reasoning tokens (included in output) | 2,228 | 1,716 | 832 |
| Model runner wall seconds | 170.813 | 148.397 | 106.352 |
| Bounded family elapsed seconds | 171.801 | 149.585 | 106.747 |
| Bounded family CPU seconds | 11.898 | 22.129 | 20.666 |
| Kernel process-family memory peak MiB | 578.2 | 544.3 | 843.4 |
| OOM kills | 0 | 0 | 0 |

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

| Measurement | Native IR + Code Mode v3 |
| --- | ---: |
| Outer MCP attempts / failed | 15 / 0 |
| Internal API reads | 24 |
| Cumulative model input tokens | 600,857 |
| Cached input tokens (included) | 534,784 |
| Uncached input tokens | 66,073 |
| Output / included reasoning tokens | 4,131 / 649 |
| Model runner wall seconds | 117.773 |
| Bounded family elapsed seconds | 119.211 |
| Bounded family CPU seconds | 15.339 |
| Kernel process-family memory peak MiB | 560.1 |
| OOM kills | 0 |

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

| Measurement | Native IR + Code Mode | Traditional |
| --- | ---: | ---: |
| Outer MCP attempts | 8 | 5 |
| Cumulative model input tokens | 284,638 | 390,557 |
| Included cached input tokens | 220,672 | 326,016 |
| Uncached input tokens | 63,966 | 64,541 |
| Output / included reasoning tokens | 2,601 / 309 | 2,614 / 531 |
| Model runner wall seconds | 72.403 | 91.832 |
| Bounded family elapsed seconds | 72.841 | 92.254 |
| Bounded family CPU seconds | 11.896 | 20.866 |
| Kernel process-family memory peak MiB | 461.6 | 846.0 |

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

| Measurement | Code Mode value v2 | Traditional value v2 |
| --- | ---: | ---: |
| MCP attempts / failures | 7 / 0 | 6 / 1 |
| Cumulative input tokens | 296,888 | 573,881 |
| Included cached input | 252,160 | 512,128 |
| Uncached input | 44,728 | 61,753 |
| Output / included reasoning | 3,176 / 594 | 2,830 / 547 |
| Model wall seconds | 96.662 | 124.754 |
| Family wall seconds | 97.654 | 125.410 |
| Family CPU seconds | 19.495 | 44.143 |
| Kernel family peak MiB | 534.4 | 797.4 |

The traditional failure is the client policy rejection of `binary_session`.
Its cost remains included. Both runtime/target digests stay unchanged, cleanup
is verified and OOM kills are zero. This is evidence of a useful seeded
value-tracing case for the revised interface, with the selected-tool and
single-sample qualifications retained.

The initial SQLite diagnostic comparison, also at `4f13bd673`, exposes a further
capability/comparison gap:

| Measurement | Code Mode SQLite v1 | Traditional SQLite v1 |
| --- | ---: | ---: |
| MCP attempts / failures | 14 / 0 | 17 / 8 |
| Cumulative input tokens | 601,445 | 934,237 |
| Included cached input | 535,296 | 831,744 |
| Uncached input | 66,149 | 102,493 |
| Output / included reasoning | 4,790 / 1,668 | 3,878 / 1,121 |
| Model wall seconds | 143.469 | 231.469 |
| Family CPU seconds | 18.996 | 154.132 |
| Kernel family peak MiB | 586.6 | 1,200.2 |

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

| Measurement | Code Mode v2 | Atomic direct v1 | Traditional cold v2 | Traditional reused-cache v1 |
| --- | ---: | ---: | ---: | ---: |
| MCP attempts / failures | 12 / 0 | 24 / 0 | 14 / 2 | 11 / 1 |
| Unique model responses | 14 | 14 | 33 | 13 |
| Client `exec` / `wait` calls | 13 / 0 | 13 / 0 | 15 / 17 | 12 / 0 |
| Internal Code Mode API reads | 15 | — | — | — |
| Cumulative input tokens | 454,914 | 464,979 | 1,093,061 | 432,446 |
| Included cached input | 414,080 | 371,712 | 1,036,928 | 377,600 |
| Uncached input | 40,834 | 93,267 | 56,133 | 54,846 |
| Output / included reasoning | 3,636 / 1,129 | 4,591 / 1,482 | 4,056 / 787 | 2,889 / 488 |
| Model wall seconds | 126.250 | 146.656 | 346.051 | 98.210 |
| Family wall seconds | 127.171 | 147.151 | 346.491 | 98.690 |
| Family CPU seconds | 16.199 | 18.445 | 219.655 | 15.601 |
| Kernel family peak MiB | 598.2 | 565.0 | 1,128.7 | 779.2 |

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

| Measurement | Code Mode VM v1 | Atomic direct VM v1 | Traditional cold VM v1 | Traditional reused-cache VM v1 |
| --- | ---: | ---: | ---: | ---: |
| MCP attempts / failures | 14 / 0 | 20 / 0 | 10 / 2 | 14 / 5 |
| Unique model responses | 18 | 17 | 27 | 18 |
| Client `exec` / `wait` calls | 15 / 2 | 13 / 3 | 12 / 14 | 17 / 0 |
| Cumulative input tokens | 729,420 | 594,606 | 698,971 | 617,340 |
| Included cached input | 664,960 | 526,720 | 625,152 | 543,616 |
| Uncached input | 64,460 | 67,886 | 73,819 | 73,724 |
| Output / included reasoning | 4,474 / 975 | 4,287 / 1,045 | 4,565 / 999 | 4,446 / 1,290 |
| Model wall seconds | 243.082 | 218.541 | 342.966 | 185.580 |
| Family wall seconds | 244.298 | 219.062 | 343.367 | 186.321 |
| Family CPU seconds | 89.693 | 79.343 | 207.596 | 28.162 |
| Kernel family peak MiB | 871.2 | 858.9 | 1,408.6 | 783.2 |

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

| Measurement | Code Mode Pragma v1 | Atomic direct Pragma v1 |
| --- | ---: | ---: |
| MCP attempts / failures | 11 / 0 | 14 / 0 |
| Unique model responses | 13 | 12 |
| Client `exec` / `wait` calls | 12 / 0 | 11 / 0 |
| Cumulative input tokens | 370,307 | 353,364 |
| Included cached input | 333,184 | 278,272 |
| Uncached input | 37,123 | 75,092 |
| Output / included reasoning | 3,612 / 803 | 2,830 / 326 |
| Model wall seconds | 121.459 | 107.625 |
| Family wall seconds | 122.256 | 108.066 |
| Family CPU seconds | 20.003 | 20.261 |
| Kernel family peak MiB | 590.1 | 560.6 |

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

| Measurement | Atomic direct table v1 | Code Mode table v1 |
| --- | ---: | ---: |
| MCP attempts / failures | 8 / 0 | 7 / 0 |
| Unique model responses | 10 | 9 |
| Client `exec` / `wait` calls | 9 / 0 | 8 / 0 |
| Cumulative input tokens | 244,235 | 225,673 |
| Included cached input | 200,704 | 190,848 |
| Uncached input | 43,531 | 34,825 |
| Output / included reasoning | 3,055 / 1,024 | 2,765 / 355 |
| Model wall seconds | 108.774 | 101.033 |
| Family wall seconds | 109.281 | 101.523 |
| Family CPU seconds | 9.683 | 9.606 |
| Kernel family peak MiB | 490.5 | 495.3 |

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
