# Real-model trials (ongoing)

The first trial used the committed `5aa1c5c64` runtime, requested model alias
`gpt-6.1-sol` with high reasoning, Codex CLI 0.161.0 and the zlib question in this
directory. The resolved server-side model build is not inferred. Its actual
registered MCP server name was `rea-codemode`, with only the four Code Mode tools.
Shell/file tools, web search, delegation and client-side Code Mode were disabled;
the actual trace establishes server-side `execute_javascript` use.

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

Code Mode reduces direct atomic round trips on this trial, but traditional tools
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
