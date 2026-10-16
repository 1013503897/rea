# Recovered graph paths as composable evidence

The frozen controller question already completes correctly in both adapters.
However, answering four path-witness subquestions makes the model read many
neighbourhoods or the entire 1,229-block inventory. The missing query is graph
reachability under explicit exclusions, not a SQLite-specific investigation.

`path({snapshot,from,target:{kind:"block",id}|{kind:"exit"},avoid,offset,limit})`
returns one shortest edge-count witness. Equal-length choices keep native edge
order. An exit is a zero-successor recovered block. Rows retain their original
edge identity, native successor `index`, source operation, condition and polarity;
`step_index` separately identifies the position in this path. Snapshot-local IDs
plus Evidence identify the source. Complete native Evidence remains accessible.
This derived view composes identified blocks/edges; it is not a runtime execution
or a proof that predicates are jointly satisfiable.

The validated graph owner supplies its existing block/outgoing indexes to a
provider-independent reader. Shared session contracts expose the same method
through SDK, CLI, direct MCP and Code Mode. There are sixteen fact methods,
nineteen direct tools and four Code Mode tools. No native exporter change is
needed. Projection-only/malformed graphs keep their typed recovered-IR failure
and retained Evidence. Unknown start, destination or excluded identities return
`unknown`, an explicit missing selection and a null total. A known excluded
endpoint gives `not-found` under that exclusion. A zero-edge found path and an
empty page remain distinct from absence.

Iterative BFS uses O(V+E) time and O(V) transient state. The graph is already
admitted at at most 12,000 blocks and 50,000 edges; the avoidance selection shares
that block bound. One last-query cache per resident immutable graph includes
start, target and normalized exclusions, independent of paging. It replaces on
query change, disappears with graph eviction/lease close, and does not retain
arbitrary missing-query keys. The existing owner retains at most two graphs.

## Executed correctness and local costs

An independent Floyd-Warshall oracle checks all 512 three-node directed graphs,
all eight exclusion sets and all start/block-or-exit requests: 49,152 queries.
Separate cases cover parallel edges/native ordinals, loops/no exits, missing
identities, exclusions, zero-edge paths, paging, immutable rows, cache replacement,
fresh owners and a 12,000-block chain. The atomic JS suite passes 74 tests.
Native-boundary tests preserve code/facet errors for malformed/projection-only
captures. Both actual SDK-converted MCP catalogs/schema sets pass Draft 2020-12
compilation and good/bad named path inputs; every declared tool is advertised.
Lint has no warnings and formatting passes.

Both real SQLite MCP adapters return the four expected witnesses in the
[unchanged question/oracle](controller-oracle.md), including both bypasses that
avoid block 1159. Every returned edge field equals the retained native graph;
the complete function equals the previous compressed-graph golden. Paging,
zero-edge success, graph-relative absence and unknown exclusions pass. This
establishes producer fidelity and recovered-graph correctness, not full machine
flow, feasibility, termination, memory aliases or provider parity.

| Same-capture phase                               | Direct wall / CPU ms | Code Mode wall / CPU ms |
| ------------------------------------------------ | -------------------: | ----------------------: |
| First four path queries                          |        64.00 / 64.01 |           60.73 / 60.77 |
| Repeat all four (last-query cache churn)         |          9.54 / 9.50 |           26.58 / 26.50 |
| Same-query cached page                           |          2.70 / 2.71 |           10.79 / 10.80 |
| Historical all-block read + consumer composition |        27.67 / 27.66 |           47.40 / 47.39 |

The historical verifier completes the same four witnesses with ten fact reads;
the new method needs four. Direct MCP returns 271,535 bytes across ten calls for
the baseline and 9,309 bytes across four for the new queries. Code Mode composes
each group in one MCP call; its old witness-only result is 1,031 bytes versus
7,539 for the new complete path/provenance replies. Fields/envelopes differ, and
bytes are not tokens. First-query/JIT effects and fixed execution order are not
controlled. In particular the first new-query group is slower than the later
baseline in both lanes: these observations do not establish a speedup.

Fresh native captures take 38.499 seconds in Code Mode and 42.556 direct; this
query does not accelerate native analysis. Entire verifier families cost
40.406 wall / 40.185 CPU seconds / 656.4 MiB and 44.419 / 40.033 / 653.7 MiB,
respectively. Final 74 tests cost 8.376 wall / 4.098 CPU seconds / 83.5 MiB;
metadata verification costs 1.730 / 1.560 / 135.9 MiB. All have OOM/kill zero
and verified cleanup. Family kernel peaks include charged file cache, not RSS.

Main was refreshed to `8116dc065` before this feature. Its cached runtime build
passes (39.075 wall / 37.676 CPU seconds, 3,073.9 MiB kernel peak, OOM/kill zero,
verified cleanup); the peak includes charged cache and crossed the soft memory
high watermark under the 4 GiB hard bound. An earlier unpinned Node 20 build
attempt failed on `node:sqlite` before this pinned build; it is not counted as a
passing check. Full repository/native gates were not run. Raw evidence remains
local as `path-*` under `.cache/atomic-codemode/`; no binaries are committed.

## Frozen model protocol

Reuse the exact controller question/oracle frozen at `8d13c67e7`, the same SQLite
artifact and `a9ca8a8a...` engine, requested model/client/settings and common
non-answer-bearing discovery/wait guidance. Freeze the complete runtime before
both isolated model calls. Generate both enabled-tool manifests from the actual
catalog, including the new direct method. Run Code Mode then direct with fresh
leases/caches. Preserve prior pairs and every attempt; review full answers and
source/witness identity before interpreting cumulative/cached/uncached tokens,
output, reasoning, elapsed time, CPU and family peak memory. OS/model caches and
host contention remain uncontrolled. The new shared method may help either lane;
no preferred adapter or broad complex-software superiority is presumed.

## Completed real-model pair

Both isolated models complete the unchanged question correctly at frozen runtime
`e990feeb7c77755525af7411ea0d6a8dd734413d`, Code Mode first, direct second.
The runtime source digest is identical between lanes, as are the actual prompt
and original question-template digests. The original oracle's eighteen-tool
statement describes its first runtime; this separate stratum uses verified,
complete nineteen/four-tool manifests generated from the actual current catalog.
No answer addresses, native IDs or witness paths are added to either prompt.

Both models discover and use `path` four times. Each reads only three explicit
block selections and two controller queries (`1159`, then `1141/1157`); neither
reads the whole block inventory or calls `code`. Both complete answers pass
agent review against every frozen criterion: owner/stub, shared CALL/PHI/storage,
both controller levels, four guard definitions and LOAD identities/widths,
shared versus merely co-located SSA, disjunctive alternatives, all witnesses,
focused machine checks and explicit unknowns. Each cites ten real observed
sources. Scripted checks verify every cited source digest and target/engine
identity, the complete native function against the prior golden, and all fields
of every delivered path edge. The natural-language grading is agent review,
not a human declaration or a scripted language grader.

| Whole-task measure                | Direct atomic v3 | Code Mode v3 |
| --------------------------------- | ---------------: | -----------: |
| Cumulative input tokens           |          495,895 |      554,477 |
| Included cached input             |          442,880 |      508,288 |
| Uncached input                    |           53,015 |       46,189 |
| Output tokens                     |            6,889 |        7,425 |
| Included reasoning output         |              964 |          930 |
| Observed model responses          |               16 |           18 |
| Client executions / waits         |           14 / 1 |       16 / 1 |
| MCP attempts                      |               33 |           17 |
| Fact reads                        |               29 |           28 |
| Path reads, included above        |                4 |            4 |
| Rejected MCP / inner API reads    |            0 / 0 |        0 / 0 |
| Model wall seconds                |          200.817 |      203.276 |
| Family wall seconds               |          201.298 |      203.802 |
| Family CPU seconds                |           52.430 |       51.648 |
| Kernel process-family peak MiB    |            939.2 |        918.2 |
| Fresh native capture wall seconds |           38.127 |       37.990 |

Requested model/settings are `gpt-6.1-sol/high`, Codex 0.161.0. Per-response
usage sums match the ledger. All schemas, discovery, extra calls and waits remain
charged. Input includes cached input; output includes reasoning. Both actual
clients expose JavaScript execution/wait, despite their configured feature flags;
this compares two MCP adapters inside that common client surface. Fresh isolated
leases/caches do not control OS/model caches or host contention. Both have
unchanged runtime/target/engine fingerprints, OOM/kill zero, verified payload
cleanup and removed isolated profiles. Remote compute and resolved model build
remain unknown. Kernel peaks include charged file cache, not RSS.

The new pair does not prefer Code Mode: it has lower uncached input and slightly
lower local CPU/memory, but more cumulative input/output/responses and similar
wall time. Fewer MCP requests are not fewer model responses. Relative to the
[previous pair](discovery-summary-study.md), direct cumulative/uncached input and
wall time all decrease; Code Mode uncached input decreases but cumulative input
slightly increases. Its wall improvement also includes the disappearance of the
previous unexplained 189-second inter-call gap, which stays charged to that run.
The earlier Code Mode v1 had still lower cumulative input than this v3. Changed
model choices, the main refresh and uncontrolled caches preclude attributing the
whole difference to this one query. Preserve all pairs; no causal speedup,
universal tool completeness, provider parity or broad complex-software
superiority follows. The observed benefit is that both models can obtain the
required witnesses directly with the same qualified fact query.

## Additional real-provider and regression checks

The real zlib CLI composes `snapshot`, one selected block and `path`, returning
edge `0:0` from block 0 to recovered exit 7. This uses the same experimental
engine and shared application owner as the MCP checks. Separately, stock upstream
Kuna 1.833 (SHA-256
`d858918b0766435cd96b999a77f2d5a31a0cc4f07256421c883b5b9dc4dd58e4`)
produces diagnostic SSA through the SDK. Calling `path` explicitly returns
`capability_unavailable` linked to that snapshot's Evidence; code/source remain
readable and the complete source hash verifies. The stock binary is copied into
an immutable local cache with a verified hash; no setup/global config is changed.
This is a real SDK negative check, not a stock real-agent task or native-CFG
availability claim. Experimental capabilities remain explicitly pinned.

| Additional executed scope                       | Family wall s | CPU s | Kernel peak MiB |
| ----------------------------------------------- | ------------: | ----: | --------------: |
| Combined atomic/shared fact JS suite, 89 passed |         4.548 | 4.299 |            80.8 |
| Python cost-ledger suite, three passed          |         0.323 | 0.090 |            14.2 |
| Real zlib CLI composition                       |         1.428 | 1.232 |           117.5 |
| Stock 1.833 SDK unavailable-path check          |         1.531 | 1.326 |            99.6 |

All have OOM/kill zero and verified payload cleanup. Two ancillary harness
attempts failed before the corrected passing checks: stock verification used an
invalid `code.start_line` key after successfully checking the unavailable path
(1.629 wall / 1.255 CPU seconds / 189.5 MiB), and an initial CLI invocation omitted
the explicit provider environment (0.523 / 0.339 / 50.7 MiB). Both failures are
retained with cleanup verified; neither is a product fix or a model attempt.
The corrected stock call uses the declared zero-based `offset`, and the CLI
uses the prepared explicit pinned configuration.

Lint has no warnings; formatting passes for every changed file. An experiment-
wide formatting check reports two unchanged historical projection documents
(`projection-experiment.md`, `projection-oracle.md`); they are outside this diff.
Full repository/native gates remain unexecuted. Local receipts include
`path-model-costs.json`, `path-answer-checks.json`, `path-answer-review.json`,
`sqlite-controller-{direct,codemode}-v3*`, `path-related-tests.log`,
`path-ledger-tests.log`, `path-cli*` and `path-stock-unavailable*`. Raw captures,
binaries, installed dependencies and local check scripts are not committed.
