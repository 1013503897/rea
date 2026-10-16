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
