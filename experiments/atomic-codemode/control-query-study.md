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

The [two-level question and oracle](controller-oracle.md) require actual model
composition of control, values, operands, PHIs, CFG witnesses and machine facts.
Real-agent results must remain separate from these scripted checks.
