# Native cases as composable facts

The SQLite VM has 182 table entries and 149 distinct targets. Its native
jump-table owner already knows labels and exact row-to-out-edge mappings;
the experiment previously exported only the optimized CFG. This closes that
export/query gap without deriving labels from edge order or block addresses.
It remains an opt-in experiment, not stock-provider parity or integration.

## Owners and contracts

`atomic_membership` gathers BRANCHIND identities during its existing checked
membership scan. Read-only `JumpTable` accessors borrow native address/label
rows and edge positions. `atomic_switches` checks the exact linked operation,
indexes mappings once and exports an independent version-1 facet alongside
unchanged graph schema 3 and its optional schema-4 compression envelope.
Ordinary non-opt-in analysis and target executable bytes are unchanged.

Native limits are 12,000 switches, 100,000 rows/mappings and a shared 2 MiB
selector/type/address-space text budget, within the existing supervised process
and 8 MiB document bounds. Source labels stay exact hex strings. Missing tables,
labels, targets/mappings and the native reserved no-label marker remain explicit.
No-label status comes from the native owner; it is not guessed from an integer.

`native-switch-contract` admits rows before expanding validation errors;
`native-switch-views` owns identity checks, partial coverage and indexes. A full
graph cross-checks operation/value/edge ownership; without it, shared values are
checked against available calls/projection facts. Bad switch data makes that
facet unavailable while preserving independently valid graph/calls/C.

`switches` returns metadata and selector facts, never an embedded case inventory.
`relations(kind:cases)` selects labels or original row indexes and pages
individual case-to-edge relations. A case has a stable case_id; distinct edges
have distinct relation IDs. Unmapped cases produce one explicit unknown-edge
row. Relation totals are separate from native row and mapping counts. This
avoids an unbounded edge array even when limit=1; a regression reads a late
two-edge page from a 4,096-mapping case in under 1 KiB of returned items.

Raw rows are retained once. Row lookup is direct, labels have an index, and
prefix offsets permit paging without constructing all relation projections.
Single-label offsets are cached only for existing labels, bounded by the
retained source; arbitrary missing labels and filter combinations do not grow
that cache. The validated model/lease owns its lifetime. Both MCP adapters and
the JavaScript CLI consume these same owners.

The native writer keeps old graph/call coverage ahead of the new facet when
space is scarce. A source review found that a later projection omission could
free space without restoring saved switch facts. `bounded_reclaiming` retries
that saved facet whenever a preferred smaller combination fits. It moves trees,
does not clone them, and bounds both encoded string alternatives. A focused
native regression and real 2 MiB CLI captures verify the restored facts.

## Real provider evidence

Upstream: `fe01d6294eb0d1053ce343c8943646df88e143fc`.
Final preserved engine:
`a9ca8a8ac224936afb08a9d4be9c1225feb69473ad9f35764e8d1c4f04875b5b`.
Patch SHA-256:
`9b6642f498f3c9f356b253a2b8b14daf2154cde8eae2d4ab0696f018566e9b73`.
The initial public checks used preserved `ac6bc7ab...`, before the formatter
reclamation fix. Binaries are copied outside mutable Cargo outputs and not
committed. Target/digest and independent machine oracle are in
[switch-oracle.md](switch-oracle.md).

Both final actual MCP paths compare every one of the 182 labelled original
targets with independently reconstructed ELF table entries. Selected loaded
bytes and dispatch instructions also agree. The native mappings cross-check
against the full recovered graph; graph and ordinary C/metadata/calls match the
prior complete golden. That producer comparison does not independently prove
whole machine/IR equivalence. Each route executes fourteen MCP requests.

The final wire document is 3,818,818 bytes. Two real native CLI processes with
an explicit 2 MiB output budget instead produce identical 823,908-byte records:
graph and projection are explicitly unavailable, while C, 416 calls and all
182 cases survive. Replaying their retained source through the shared decoder
again verifies every original target. This establishes the native CLI/decoder
boundary, not a public MCP no-graph run; the MCP owner keeps its 8 MiB budget.

The recovered selector is eight bytes but comes from a one-byte LOAD/ZEXT. The
machine computes its jump address in a different register. Native default edge
`8:42` points to block 778, origin `0xeacf0`; the unsigned machine out-of-range
guard instead jumps to `0xea998`. Defaults, original addresses and optimized
edge identities have separate authority, now stated in the contracts.

## Executed checks and costs

The shared JS suites pass 73 cases. Selected native CLI tests pass thirteen;
one native jump-table test separately checks nonmatching ordinals/labels/edges,
missing labels and inconsistent row lengths. Focused source lint passes without
warnings; upstream compiler warnings are outside this patch. Full native corpus,
stages/workspace and whole-REA gates remain unexecuted or previously resource
limited; no integration readiness is claimed.

| Executed scope                            | Family wall s | Family CPU s | Kernel peak MiB |
| ----------------------------------------- | ------------: | -----------: | --------------: |
| First native export build                 |       397.637 |      366.618 |         2,169.6 |
| Identity/text-budget build                |       432.413 |      388.136 |         2,130.6 |
| Initial twelve CLI tests                  |       100.723 |       99.982 |           647.3 |
| Native jump-table test, including compile |       277.247 |      276.646 |         2,855.5 |
| Final thirteen CLI tests                  |        52.204 |       40.984 |           476.4 |
| Formatter-fix build                       |        63.414 |       50.208 |           524.5 |
| Cached final build                        |         0.522 |        0.189 |            30.1 |
| Initial Code MCP, ac6bc7ab                |        41.698 |       41.415 |           656.5 |
| Initial direct MCP, ac6bc7ab              |        96.920 |       75.949 |           639.2 |
| Two 2 MiB native CLI captures             |        79.377 |       79.060 |           514.7 |
| Final direct MCP                          |        44.440 |       44.201 |           635.0 |
| Final Code MCP                            |        43.828 |       43.504 |           643.0 |
| Both catalog/reference checks             |         2.033 |        1.839 |           144.4 |
| Real CLI empty switch/ID selection        |         3.646 |        3.397 |           188.8 |

All resource runs use one CPU, 4 GiB hard / 3 GiB early-stop memory bounds,
verified cleanup and OOM 0. Peaks include charged file cache, not RSS. Final
same-lease snapshot plus selected-case reuse takes 4.8 ms / 0.006 CPU seconds
direct and 8.2 ms / 0.009 Code; cumulative memory peaks only upper-bound isolated
warm memory. OS caches and host contention are uncontrolled. These scripted
measurements do not establish token savings or model outcomes.

The initial direct capture also ran slowly (about 90 seconds), despite
sequential requests and no model. This shows the earlier long capture is not
unique to Code Mode or model interaction. The [overlap diagnostic](overlap-study.md)
did not reproduce it. Its native/host cause remains unresolved; no speed fix or
causal dispatch comparison is claimed.

## Model question

The [question](sqlite-switch-question.txt) and [oracle](switch-oracle.md) must be
committed before either real model launch. They ask for selected labels,
source-byte/normalized-selector widths, signed relative target arithmetic and
the native-default versus machine-guard distinction, starting from function
name/messages. Both lanes get the full catalog and the same exact discovery,
envelope and stopping guidance; reverse engineering facts are not precomputed
for the measured models.

## Real-model selected-case investigation

The question and oracle were frozen at `f44dca9c3` before both launches. Direct
ran first, then Code Mode, with the preserved final engine above, fresh leases,
and isolated model workspaces outside the repository. Both receive their full
catalog: eighteen direct tools or four Code Mode tools. Exact-name discovery
guidance is identical in policy, with no precomputed analysis facts.

Both complete answers pass the frozen oracle/source review:

- Two format references select implementation `0xea6d0` over the other callable
  entry before a single retained VM capture. Neither fetches a full case
  inventory, C report or recovered graph.
- The one-byte loaded selector, eight-byte normalized ZEXT and computed machine
  jump address remain distinct. Both verify unsigned `JA`, the table base and
  signed little-endian four-byte displacement arithmetic with selected bytes.
- All five requested in-range labels have the correct original row, native
  edge/block and recovered target. Labels `0x34`/`0x39` retain distinct case IDs
  despite sharing a destination/edge. Querying six labels returns five rows;
  `0xb6` has no captured explicit case in this nonpartial table.
- Both distinguish native default `8:42` / `0xeacf0` from the machine guard
  destination `0xea998`, and do not equate default index 42 with label `0x2a`.
- Real source IDs and the target digest support the answers. Both preserve
  machine-flow, memory-alias, nontermination and runtime-feasibility limits and
  close the lease. Direct cites twelve observed source IDs; Code Mode cites nine.

Both retained VM sources decode to the full prior graph golden, with ordinary
C/metadata/calls unchanged. This establishes producer fidelity separately from
the independent selected machine checks; it does not prove global equivalence.
The 3,818,818-byte native document stays outside model context. Full answers,
events, source Evidence, client tool context and resource receipts are retained
locally under `.cache/atomic-codemode/sqlite-switch-{direct,codemode}-v1*`.

| Whole-task measure             | Direct atomic | Code Mode |
| ------------------------------ | ------------: | --------: |
| Cumulative input tokens        |       423,153 |   335,309 |
| Included cached input          |       367,104 |   308,352 |
| Uncached input                 |        56,049 |    26,957 |
| Output tokens                  |         5,135 |     4,947 |
| Included reasoning output      |         1,311 |       964 |
| Observed model responses       |            18 |        15 |
| Client execution / wait calls  |        11 / 6 |    11 / 3 |
| MCP attempts                   |            17 |        13 |
| Successful atomic fact reads   |            13 |        14 |
| Model wall seconds             |       220.581 |   180.656 |
| Family wall seconds            |       222.275 |   181.173 |
| Family CPU seconds             |        93.003 |    57.957 |
| Kernel process-family peak MiB |         722.4 |     782.3 |
| VM source-capture wall seconds |        78.026 |    41.741 |

There are no failed MCP/API attempts or resource aborts. Per-response usage
sums match the ledger. Both request `gpt-6.1-sol/high` through Codex 0.161.0;
the resolved service build and remote compute costs are unknown. Cached input
is included in input; reasoning is included in output. Runtime, engine and
target fingerprints remain unchanged. One CPU, 4 GiB hard / 3 GiB early-stop
bounds apply, with OOM 0 and verified payload/profile cleanup. Peaks include
charged file cache, not RSS. Leases/provider caches start fresh; OS caches,
model prompt caches and host contention are uncontrolled.

Code Mode uses 20.8% less cumulative input, 51.9% less uncached input and 18.1%
less model wall time in this one sample. Native capture takes 78.0 versus 41.7
seconds, a substantial confound already observed without models or overlap.
The lanes also select different details and discovery contracts. Both clients
already compose calls through their JavaScript executor. This is not evidence
of a general Code Mode speedup or traditional-provider superiority/parity.

Client waiting is another observed whole-task cost: each initial snapshot
execution yields after about 31 seconds. Both then request one-second waits;
direct tries three before switching to longer waits, while Code Mode completes
on its third. A slower capture can therefore add model responses and token
usage as well as wall time. Those costs remain in the table; subtracting them
would not produce a controlled comparison. The next diagnostic should test
the same longer-wait guidance in both lanes without changing the question,
analysis facts or completeness requirements. That
[executed repeat](client-wait-study.md#executed-repeat) now completes correctly
in both lanes with one wait each, while whole-task costs remain mixed.
