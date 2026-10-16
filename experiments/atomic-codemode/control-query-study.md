# Correct and reusable control queries

Retained-source inspection exposed a correctness gap: a nonexistent CFG seed
returned an empty set without saying that the block was unretained. Source-wide
control coverage could be mistaken for proof that the requested block had no
controllers. Incoming/outgoing queries shared this selection boundary. They now
deduplicate seeds and return `unretained_seeds`, distinguishing a retained block
with no relations. Incoming/outgoing order follows caller seeds then native
edges; controller order stays native controller/edge then postdominator ancestor.

`createControlDependenceIndex` replaces the one-shot implementation. The native
graph owner constructs it lazily and retains it only with that resident snapshot.
It holds linear-size postdominator/coverage state, without query keys or a
potentially quadratic complete relation set. Page reads generate relations,
count the entire selected set and retain only the requested page. Construction
and each relation walk have separate two-million-step budgets; capacity failure
is explicit. Coverage/edges are immutable; fresh reply row containers cannot
change subsequent reads. The index follows the existing two-resident-model
lifetime. CLI, SDK and both adapters use this owner; no native rebuild or new
public method is required.

Semantics remain finite paths to recovered zero-successor exits. Loop
self-dependence is possible; exit-unreachable blocks are explicit. Runtime
feasibility, memory aliases and nontermination remain unknown.

## Independent verification

The test/evaluator-only `control-path-oracle.mjs` removes each candidate node
and searches backward from exits. It independently verifies all 512 three-node
directed graphs, including cycles, alongside the existing 64 four-node DAGs,
multiple exits, unreachable regions and work-capacity checks. Single-row paging,
unknown/duplicate seeds and immutable coverage/edges pass. The related suite
passes 82 tests; the final added edge-mutation assertion also passes its focused
ten-test suite. Experiment lint has no warnings; formatting passes.

The real Debian SQLite VM has 1,229 blocks, 2,061 edges and 2,845 derived control
triples. Both actual MCP adapters page every triple and match the independent
oracle, including exact native edge metadata. Each executes 52 MCP requests.
Full graph, ordinary function/call records and Evidence views equal the earlier
golden; former projection frontiers remain readable. All three CFG relation
kinds correctly report unknown-only and mixed/duplicate seeds. Target and
preserved `a9ca8a8a...` engine match the [switch study](switch-study.md). No target
execution or modification occurs.

## Executed costs

| Scope                       | Family wall s | Family CPU s | Kernel peak MiB |
| --------------------------- | ------------: | -----------: | --------------: |
| Related 82 tests            |        20.342 |       13.857 |            93.5 |
| Real Code Mode MCP          |       103.417 |       78.642 |           713.2 |
| Real direct MCP             |        42.702 |       42.301 |           725.4 |
| Equivalent-query diagnostic |         2.636 |        2.482 |           309.0 |

One CPU, 4 GiB hard / 3 GiB early-stop bounds apply. All have OOM/kill 0 and
verified payload cleanup. Kernel family peak includes charged file cache, not
RSS. Code Mode's fresh native capture takes 95.068 wall / 72.758 CPU seconds;
direct's takes 39.432 / 39.408. This native/host variation is not a dispatch
measurement. The first selected eight-row query takes 61.2 ms / 0.0616 CPU
seconds Code Mode, 15.0 ms / 0.0157 direct. The identical same-lease warm query
takes 3.2 ms / 0.00384 and 1.8 ms / 0.00242. Paging all triples takes 274.9/224.2
ms. Cumulative peaks only upper-bound warm memory. Private native caches are
fresh; OS caches and host contention are uncontrolled. Receipts remain local
as `controls-{code,direct}-v1*`.

`profile-controls.mjs` compares baseline
`d7d95c7dcc824cc90f63de7a8e2efa2237c53d8f` with the current owner on the same
validated retained graph. The complete task returns eight relations for blocks
1154/1159 in four two-row pages. Both return identical facts:

| Core task                     | Reads | Elapsed ms | Process CPU s |
| ----------------------------- | ----: | ---------: | ------------: |
| Previous implementation       |     4 |      75.33 |        0.0751 |
| First indexed task            |     4 |      23.33 |        0.0233 |
| Identical complete task, warm |     4 |       1.27 |        0.0013 |
| Previous, 50 complete tasks   |   200 |     420.03 |        0.4174 |
| Indexed, 50 complete tasks    |   200 |      60.27 |        0.0603 |

Parsing/validation separately takes 1,013.4 ms / 1.0127 CPU seconds. Order,
JIT and caches are uncontrolled within the shared process. This diagnostic
excludes fresh native work, MCP discovery/serialization and model tokens;
it does not establish a whole-agent speedup or fewer reads/tokens. Source/module
hashes and facts are retained in `controls-profile-v1.json`.

## Real-agent two-level investigation

The [question and oracle](controller-oracle.md) and runtime were frozen at
`8d13c67e7` before either model launch, Code Mode first and direct second.
Both complete answers pass the frozen oracle/source review: format ownership,
PHI/call binding, both complete controller levels, all four Boolean guards and
operand widths/LOADs, exact shared/distinct SSA identities, alternative predicates,
valid recovered witnesses, machine corroboration and explicit limits. Both close
the lease. The relation list is correctly distinguished from a conjunction.

Direct chooses longer bypass witnesses than the oracle examples. Every reported
edge is valid; both paths end at zero-successor block 1207 and avoid block 1159.
Including the initial controller edge, direct uses nine/twelve edges, Code Mode
six/six; shortest paths were not required. Both full native function records equal
the earlier golden. All thirteen Code Mode and ten direct cited source IDs exist
with matching artifact/engine identities. Code Mode's extra pointer/spill facts
also match the retained IR and selected GNU decoding. The cost summarizer does
not automatically grade natural language.

| Whole-task measure             | Direct atomic | Code Mode |
| ------------------------------ | ------------: | --------: |
| Cumulative input tokens        |       935,185 |   503,113 |
| Included cached input          |       878,592 |   436,736 |
| Uncached input                 |        56,593 |    66,377 |
| Output tokens                  |         7,320 |     7,450 |
| Included reasoning output      |           757 |       835 |
| Observed model responses       |            24 |        17 |
| Client executions / waits      |        22 / 1 |    15 / 1 |
| MCP attempts                   |            36 |        15 |
| Rejected MCP / inner API reads |         0 / 0 |     0 / 0 |
| Successful atomic fact reads   |            32 |        33 |
| Model wall seconds             |       230.280 |   246.479 |
| Family wall seconds            |       230.755 |   248.500 |
| Family CPU seconds             |        52.458 |    72.837 |
| Kernel process-family peak MiB |         876.5 |     944.3 |
| Native source-capture wall s   |        37.852 |    52.471 |

Both request `gpt-6.1-sol/high` via Codex 0.161.0, with complete 18/4-tool catalogs
and common exact-name/envelope/stopping/long-wait guidance. Actual client calls
use JavaScript `exec`/`wait` in both lanes despite false client Code Mode flags.
This compares server Code Mode with direct atomic MCP on that host, not
composition against its absence. Resolved service build and remote compute are
unknown. Per-response usage sums match the ledger; cached input is included in
input, reasoning in output. Discovery, schemas, waits and all calls are charged.
Runtime, target and engine remain unchanged; both profiles/payloads have verified
cleanup, OOM/kill 0 and no resource abort under the same one-CPU / 4 GiB / 3 GiB
bounds. No new warm real-agent task was run.

Both actually query `controllers` at both levels. Neither uses the C tool or
fetches the complete raw IR report. Code Mode reads the complete block-successor
inventory internally for path search and does extra pointer/spill analysis:
fourteen block, six operation and three instruction API reads. Direct uses ten
block, five operation, two instruction reads, two bounded slices and more selected
CFG reads. Different strategies and native capture times remain confounds;
source-capture time is not an isolated native-drive interval and must not be
subtracted to manufacture a dispatch-only effect.

In this single pair, Code Mode reduces cumulative input by about 46% and uses
fewer model rounds, but increases uncached input, output, elapsed time, CPU and
peak memory. The index's core-query improvement does not establish a causal
whole-agent benefit. Correct composable facts support both strategies; there is
still no stable overall Code Mode advantage or broad complex-software superiority
claim. No traditional-provider cell is invented for this native-identity question.

Local records: `sqlite-controller-{direct,codemode}-v1*`,
`controller-matrix-costs.json` and `controller-answer-checks.json` under
`.cache/atomic-codemode/`. `summarize-trials.py` reconstructs costs. Fresh leases
and private native caches do not control OS/model-service caches; kernel peaks
include charged file cache, not RSS. Scripted warm/core results stay separate.
