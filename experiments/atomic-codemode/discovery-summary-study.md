# Intent discovery without duplicated full contracts

The [two-level control pair](control-query-study.md) exposed a concrete metadata
cost. Code Mode first received a 9,890-byte method index, then 26,614 bytes of
selected contracts; the index already repeated substantial full descriptions.
Its uncached input exceeded direct's despite lower cumulative input. Metadata
bytes alone cannot explain that token difference: selected contracts, returned
facts and analysis choices also differed.

The shared registry now owns an explicit intent summary beside each full
method description. `reference(view:"index")` returns those summaries and every
matching method/name, without schemas or return contracts. It labels the result
as intent discovery, not complete semantics or live availability. Full contracts
remain on demand, including an explicit all-contracts request. Topic matching
still searches the full descriptions, so a detail omitted from a summary remains
searchable. No automatic sentence cutting, schema truncation or catalog filtering
is introduced. Caller selection/order and unmatched queries remain explicit.

The definition helper takes named summary/description metadata. `api.mjs` owns
contracts; `session.mjs` owns shared application admission and file/lease cleanup.
The default session factory imports the native provider only on open. All known
consumers now import `AtomicSession` from `session.mjs`; no compatibility wrapper
or second analysis implementation remains. CLI, SDK and both MCP adapters share
that owner. This changes metadata/loading, not native arguments, analysis caching
or retained-fact semantics.

## Actual contract and runtime checks

The complete SDK reference object is deeply equal to the saved before object:
all fifteen input schemas, full descriptions, return contracts, examples, limits
and notes match. Both actual MCP lanes preserve their selected full contracts
exactly. Every advertised schema compiles against Draft 2020-12; named handlers
match their contract identities. Actual catalogs still contain all eighteen
direct tools or four Code Mode tools. Topic/all/named selection, unknown queries,
caller order and timeout rejection/recovery pass.

| Actual MCP lane | Previous index bytes | Intent index bytes | Full-contract bytes, unchanged |
| --------------- | -------------------: | -----------------: | -----------------------------: |
| Code Mode       |                9,890 |              2,849 |                         31,804 |
| Direct          |                9,920 |              2,879 |                         30,116 |

Those are serialized JSON bytes, not model tokens. No token improvement follows
from that table alone. The all-contract size difference between lanes is their
existing naming/examples/execution presentation, not missing methods.

The related 82 tests pass after the module split. Real zlib SDK reads preserve
immutable cached strings/aliases and the complete source digest. The real CLI
composes function/string reads through the moved application owner. SDK cleanup
and replacement retry pass on SSH. Both MCP adapters retain and retry failed
engine-inspection descriptors and native-close owners. The faults are injected,
not observed OS/engine failures; native reads and successful cleanup use real
providers. Lint reports no warnings and formatting passes.

| Executed scope                                  | Family wall s | Family CPU s | Kernel peak MiB |
| ----------------------------------------------- | ------------: | -----------: | --------------: |
| Before actual metadata verification, both lanes |         2.032 |        1.869 |           141.3 |
| Final actual metadata verification, both lanes  |         1.831 |        1.592 |           130.0 |
| Final related 82 tests                          |         3.948 |        3.788 |            82.9 |
| Real zlib SDK                                   |         1.528 |        1.297 |           124.6 |
| Real zlib CLI                                   |         1.629 |        1.365 |           122.1 |
| SDK cleanup/replacement retry                   |         1.731 |        1.551 |           120.4 |
| Engine descriptor retry, Code Mode              |         1.932 |        1.717 |           199.1 |
| Engine descriptor retry, direct                 |         1.831 |        1.645 |           191.4 |
| Native close retry, Code Mode                   |         1.832 |        1.610 |           187.8 |
| Native close retry, direct                      |         1.730 |        1.566 |           181.4 |

All run with one CPU, 4 GiB hard / 3 GiB early-stop memory, OOM/kill 0 and verified
payload cleanup. Kernel family peaks include charged file cache, not RSS. An
intermediate metadata check costs 1.731 wall / 1.503 CPU seconds and 129.5 MiB;
the preliminary 82-test run before module separation costs 19.536 / 13.950
seconds and 90.9 MiB. These are implementation/check stages with uncontrolled
host/JIT/cache conditions, not a causal analysis-speed benchmark. Raw receipts
remain local as `discovery-summary-*` under `.cache/atomic-codemode/`.

## Real-model repeat protocol

Reuse the unchanged [question and oracle](controller-oracle.md), frozen at
`8d13c67e7`, and its same pinned SQLite artifact and `a9ca8a8a...` engine. The
interface revision is a separate stratum; preserve both earlier completed answers
and all costs. Freeze runtime/HEAD before running, with the same complete tool
manifests, model/client/settings and common discovery/envelope/stopping/wait
guidance. Reverse the prior order: direct first, Code Mode second. Use fresh
isolated leases/private caches; OS/model caches and host contention remain
uncontrolled. Review complete answers and paths before comparing whole-task
usage, CPU and family memory. Module loading and model choices also change, so
the result cannot isolate a pure byte-count effect.

## Completed real-model repeat

Runtime was frozen at `65b701df5`; the question/oracle remain byte-unchanged from
`8d13c67e7`. Both complete answers again pass the frozen source/oracle review:
ownership, PHI/call binding, both controller levels, four guards and widths,
exact shared/distinct SSA identities, valid avoidance witnesses, selected machine
checks and explicit unknowns. Both use one retained VM capture and close the
lease. Direct factors a longer common path suffix; every expanded edge is valid.
Code Mode gives the shorter witnesses. Each cites ten observed source IDs with
matching target/engine identity; both complete native function records equal the
prior golden. The cost summarizer does not perform natural-language grading.

| Whole-task measure             | Direct atomic v2 | Code Mode v2 |
| ------------------------------ | ---------------: | -----------: |
| Cumulative input tokens        |          834,800 |      546,797 |
| Included cached input          |          768,000 |      482,560 |
| Uncached input                 |           66,800 |       64,237 |
| Output tokens                  |            7,782 |        7,917 |
| Included reasoning output      |            1,002 |        1,322 |
| Observed model responses       |               25 |           19 |
| Client executions / waits      |           23 / 1 |       17 / 1 |
| MCP attempts                   |               38 |           18 |
| Rejected MCP / inner API reads |            0 / 0 |        0 / 0 |
| Successful atomic fact reads   |               35 |           32 |
| Model wall seconds             |          251.325 |      422.804 |
| Family wall seconds            |          251.925 |      423.457 |
| Family CPU seconds             |           51.979 |       54.169 |
| Kernel process-family peak MiB |            922.7 |        937.3 |
| Native source-capture wall s   |           37.061 |       36.472 |

Both request `gpt-6.1-sol/high` through Codex 0.161.0 with the unchanged complete
18/4-tool manifests and common guidance. Both actually use client JavaScript
`exec`/`wait`; feature flags do not establish absence of that surface. Per-response
usage sums agree. Cached input is included in input, reasoning in output.
Runtime, engine and artifact fingerprints remain unchanged. Both profiles and
payloads have verified cleanup, OOM/kill 0 and no resource abort under the same
bounds. Resolved service build, remote compute and OS/model cache effects remain
unknown. These are fresh leases/private native caches, not warm task results.

Actual help use matters. Direct v2 skips the index and reads selected complete
contracts once (24,238 bytes), versus two calls/24,733 bytes in v1. Code Mode v2
uses the 2,849-byte index, then two contract calls: three help calls/30,520 bytes
total, versus two/36,504 in v1. Thus the complete Code Mode help path shrinks by
about 16%, with one extra call; the index's 71% byte reduction is not a 71%
whole-task token reduction.

Compared with its own v1 run, Code Mode v2 has slightly lower uncached input
(66,377 to 64,237), but higher cumulative input (503,113 to 546,797), output and
elapsed time. Direct v2 has lower cumulative input but higher uncached input and
elapsed time than direct v1. Neither before/after pair proves a consistent overall
benefit. Different model choices, module loading, reversed order and uncontrolled
service/host/cache behavior prevent attributing changes solely to summaries.

Captured client call/output timestamps locate a 189.366-second Code Mode gap
between two executions that both report `Script completed`; the executions
themselves last approximately 0.171/0.154 seconds. Matched client-tool interval
unions are 45.909 seconds direct and 50.383 Code Mode. Such intervals are not pure
native work, network or model latency, and gaps after yielded calls can overlap
background work. Here the large gap follows a completed call/PHI read. Its cause
is not established; stderr has no retry/reconnect/timeout diagnostic. The gap
remains charged in the reported wall time. Similar native-capture times and local
CPU do not establish a cause for the end-to-end latency difference.

Both models avoid the C tool. They still read numerous CFG neighborhoods to
construct a few path witnesses; Code Mode again searches an internally collected
successor inventory. This recurring composition cost motivates testing a shared,
bounded recovered-path query next. It is not implemented by this metadata change.
Availability behavior under a stock/unconfigured provider is not newly established
by this native-IR model pair. No broad complex-software superiority or stable
Code Mode advantage is claimed.

The earlier [v1 results](control-query-study.md) are retained rather than replaced.
Local v2 records are `sqlite-controller-{direct,codemode}-v2*`,
`controller-summary-repeat-costs.json`, `discovery-summary-answer-source-checks.json`
and `discovery-summary-client-timing.json`. Kernel peaks include charged file
cache, not RSS; startup/final generation outside the first/last client call is
not covered by the interval union. All whole-task costs remain in the main table.
