# Real-agent savepoint control investigation

The [question and oracle](savepoint-control-oracle.md) were committed at
`e2205313a` before either model launch. Both lanes have the same atomic facts,
target, engine, question and common envelope/stopping guidance. They start with
the function name and two messages, without supplied code addresses. This tests
the newly available full recovered graph, not provider parity or superiority
over a traditional RE interface.

## Initial pair: natural discovery

Both complete answers pass the frozen source/answer review:

- Incoming string references select `0xea6d0` from two same-name entries before
  one retained VM capture. Neither lane fetches the complete C report or graph.
- Both format pointers merge through `0xf238b:ceb7` and reach CALL
  `0xf238b:7130`, with the correct predecessor/edge bindings and RSI storage.
- Each answer supplies both successor edges for each nearest local conditional
  predecessor. The open guard is signed four-byte `0 < loaded32`; release is
  four-byte equality to one. Both trace one-byte Booleans to the right LOADs,
  preserve operand indexes/widths and stop before guessing loaded contents.
- Focused instruction windows check loads, the spill, signed JG/equality JZ,
  format setups and shared machine CALL. Independent GNU/ELF verification checks
  eleven instruction sites against the same target bytes. PHI/edge identities
  remain separate from machine instructions and transfers.
- Real source IDs and the target digest are present. Each answer limits itself
  to recovered graph/local guards and states machine-flow, alias,
  nontermination, earlier-path and runtime-feasibility limits. Neither uses
  derived controllers or claims a SQL trigger. Both close the lease.

Each answer cites ten observed source IDs. Both have one successful VM capture,
whose recovered graph equals the complete producer golden; facts come from the
preserved `677b9795...` engine. Full answers, events, tool context, traces and
resource receipts are retained locally under
`.cache/atomic-codemode/sqlite-savepoint-control-{direct,codemode}-v1*`.

| Whole-task measure                | Direct atomic | Code Mode |
| --------------------------------- | ------------: | --------: |
| Cumulative input tokens           |       515,024 |   610,715 |
| Included cached input             |       466,304 |   563,328 |
| Uncached input                    |        48,720 |    47,387 |
| Output tokens                     |         5,537 |     6,345 |
| Included reasoning output         |         1,344 |     1,502 |
| Observed model responses          |            17 |        18 |
| MCP attempts, including rejection |            24 |        15 |
| Successful atomic fact reads      |            20 |        21 |
| Model wall seconds                |       206.269 |   223.636 |
| Family wall seconds               |       207.427 |   224.133 |
| Family CPU seconds                |        53.794 |    52.777 |
| Kernel process-family peak MiB    |         874.9 |     883.2 |

Code Mode's fifteen attempts include a rejected `timeout_ms:200000` request;
the actual schema maximum is 120,000. It retries within that bound. The client
also initially tries to JSON-parse the validation error's text and gets a
SyntaxError. Both costs remain in the ledger. There are no recorded inner-API
failures or resource aborts. Direct has no failed MCP attempt. MCP attempts,
successful host reads, client execution calls and model responses are distinct
counts; the trace has no handler entry for the schema rejection.

In this one sample, Code Mode reduces uncached input by about 2.7% but increases
cumulative input by 18.6%, output by 14.6% and model wall time by 8.4%. Fewer MCP
requests do not establish a whole-task advantage. The lanes also choose slightly
different fact selections and output detail. This is an observational pair,
not a controlled estimate of a single dispatch mechanism's causal effect.

The first client discovery call in both lanes applies a broad `rea.*...` regular
expression to all tool names/descriptions. It matches unrelated tools, including
creation tools, and prints large, truncated metadata. This is a real observed
agent cost, not an analysis-provider failure; it also adds noise to comparing
the two interfaces. A repeat should give both lanes the same exact-name discovery
policy while retaining every advertised tool and charging that guidance to the
whole task. No analysis steps, addresses or answers should be added.

Both runs request `gpt-6.1-sol/high` through Codex 0.161.0; the resolved service
build is unknown. Per-response usage sums match the runner ledger. Cached input
is already included in input, and reasoning is included in output. One CPU,
4 GiB hard / 3 GiB early-stop limits apply. Kernel peak includes charged file
cache; it is not RSS. Both runs have OOM 0, verified payload/profile cleanup,
unchanged runtime fingerprints, engine and target digests. Each lease is fresh;
OS/provider-service caches and remote compute costs are uncontrolled/unmeasured.

## Discovery-controlled repeat

Executed at `7a7c4a6d7`, Code Mode first, then direct. The repeat keeps the same
question, oracle, native engine and all atomic methods, and uses the runner's existing
`--enabled-tools` / `--guide-enabled-tools` options with server name `rea`.
Each manifest lists that lane's complete catalog: seventeen direct tools or four
Code Mode tools. No analysis method is removed. Captured first client calls
select these exact function names; neither repeats the broad metadata spill.
This changes discovery guidance and namespace together for both lanes; it is a
separate stratum from the natural-discovery pair, not a retroactive replacement.

Both complete answers again pass the same oracle: correct format ownership,
PHI/call and native edges, signed-positive versus equality guards, Boolean/load
widths and operand indexes, independent selected machine bytes, real provenance
and explicit static/alias/runtime limits. Both use one retained VM capture and
close the lease. Direct cites ten observed source IDs; Code Mode cites nine,
combining some instruction windows. All recovered graph and ordinary function
fields equal the earlier full golden in both lanes. Neither fetches a whole C
report or graph. Neither uses derived controllers; both keep local guards
separate from all earlier conditions and runtime feasibility.

| Whole-task measure             | Direct atomic | Code Mode |
| ------------------------------ | ------------: | --------: |
| Cumulative input tokens        |       538,013 |   608,622 |
| Included cached input          |       457,088 |   530,688 |
| Uncached input                 |        80,925 |    77,934 |
| Output tokens                  |         5,150 |     5,989 |
| Included reasoning output      |           697 |     1,462 |
| Observed model responses       |            19 |        25 |
| MCP attempts                   |            24 |        13 |
| Successful atomic fact reads   |            20 |        18 |
| Model wall seconds             |       187.544 |   266.141 |
| Family wall seconds            |       188.086 |   266.650 |
| Family CPU seconds             |        52.113 |   102.739 |
| Kernel process-family peak MiB |         859.1 |     883.1 |
| VM source-capture wall seconds |        37.026 |   107.804 |

There are no failed MCP attempts, recorded inner-API failures or resource aborts.
Per-response usage sums agree; OOM is zero, cleanup is verified, and target,
engine and runtime fingerprints remain unchanged. Full records use suffix `-v2`
under the same local artifact directory. Request/model settings and resource
bounds are unchanged from the first pair.

Code Mode again has slightly lower uncached input (3.7%) and fewer MCP requests,
but more cumulative input, output, model responses, wall time and family CPU in
this sample. It has twelve client waits versus three for direct. Discovery
guidance alone has not established an overall improvement across strata.

The VM capture is a substantial confound: its 107.804 seconds differs from
37.026 in direct and 38.013/38.871 in the first pair. Source elapsed time includes
command supervision and retention; it is not an isolated native drive interval.
No per-command CPU or phase diagnostic was captured during these model trials.
The additional instruction-window API call overlapped the pending Code Mode
snapshot; its own wall time also includes waiting beyond the retained native
source times. Whether concurrency, host contention or another lower boundary
caused the variation is unresolved. CPU affinity/quota do not give an exclusive
core. Do not subtract these intervals from whole-task time to manufacture a
Code Mode speedup or attribute the difference to dispatch alone.

Both lanes actually use the client's `exec`/`wait` JavaScript surface, despite
the recorded client Code Mode feature flags being false. Direct atomic already
composes MCP calls through that client executor. These results compare a server
Code Mode boundary against directly called atomic MCP tools in that environment;
they do not compare JavaScript composition against its absence. Tool counts and
configured feature flags cannot establish the client's actual available surface.

## Remaining questions

Four real runs establish this scoped control/data-flow task on the full recovered
graph, without a stable overall efficiency win. There is no traditional-provider
cell for this graph-identity question and no general complex-software superiority
claim. Whole-task cumulative input across all four runs is 2,272,374 tokens,
including 2,017,408 cached and 254,966 uncached; output is 23,021 including 5,005
reasoning tokens. Total model wall is 883.590 seconds. These totals retain the
initial failed request and discovery costs, not a pooled treatment estimate.

The retained graph also exposes the next coverage question: `0xea801:fe` is one
`CPUI_BRANCHIND` in block 8 with 149 recovered successors. Current edges expose
identities/destinations but no case values. The native jump-table owner should
be examined before exporting case-to-edge/target relations; a successor ordinal
is not a case value. This is a fact-export limitation, not evidence that Kuna
itself cannot recover the labels. The source-capture/concurrent-read cost
variation also needs a bounded, matched diagnostic before further speed claims.
The [subsequent four-case public MCP diagnostic](overlap-study.md) confirms
provider admission is serialized and does not reproduce the long capture;
the original cause remains unknown rather than being declared fixed.
