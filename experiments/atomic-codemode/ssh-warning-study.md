# Real-agent stripped OpenSSH comparison

The [question and machine oracle](ssh-warning-oracle.md) were frozen at
`09677946c` before the models ran. The target is the real stripped Debian SSH
client, with the same preserved `a9ca8a8a...` engine in every lane. The question
starts from two formats, without addresses, and accepts machine-supported
answers without requiring native-only SSA identities. This tests a local
cross-function warning/guard path, not reverse engineering the whole application.

A later [main refresh](main-refresh-study.md) has its own compatibility checks.
The model costs below still refer to the original frozen runtime; they were not
remeasured on the refreshed compiled REA runtime.

## Correctness and coverage

All four complete answers pass the frozen oracle/source review: both format
owners, the selected direct call, RDI pointer transport into the first helper,
the banner's pre-call stack slot and callee-entry `RSP+8`, the four-byte global
test, zero/nonzero machine successors, failure cleanup and low 32-bit
`0xffffffff` return. All preserve runtime values, aliases, logging and feasibility
limits and close the target. Banner selection is not proof of rejection; the
zero branch is not proof of acceptance.

Independent ELF file/program-header reads verify nineteen instruction sites,
ten relative call/branch/data targets and both formats. GNU decoding and unwind
FDEs corroborate the selected function starts. Later checks also verify the
formatting wrapper's incoming stack load and the reported RET. These local
checks do not prove complete machine semantics or actual runtime output.

Direct atomic cites thirteen observed source IDs; Code Mode cites fifteen;
the corrected traditional answer cites five. All cited IDs exist in the actual
delivered sources. The Code Mode warning/caller native records equal the earlier
complete graph/C/call goldens. Traditional Evidence subjects and native engine
digests match the same target/engine; derived views in the exploratory run link
to their retained native parents.

## Baseline correction

The initial traditional client allowlist had nine tools and accidentally omitted
`list_procedures`. Traditional `xrefs` returns instruction sites without owning
function identity; the model consequently guesses entry addresses, encounters
29 rejected attempts and even probes an unavailable Ghidra provider. Its final
answer is correct, but this was an under-equipped evaluator baseline. Its cost
is retained below and excluded from the primary efficiency comparison.

The corrected baseline exposes all thirteen declared Kuna native operations,
plus open/close and retained views: sixteen tools, matched against the actual
registered catalog. A public preflight reads 1,653 entries and successfully
resolves the warning entry by its observed inventory name. The repeat uses the
same frozen question/runtime and a separate fresh cache. Its two remaining
rejections are interior addresses passed to exact-entry lookup; the model then
uses the available inventory and completes the task.

`select-kuna-tools.mjs` now generates this baseline from the compiled provider
capability owner and the actual MCP catalog, following catalog pages and failing
on a missing/ambiguous named tool or a repeated cursor. It opens no target and
never replaces an existing artifact. Its name-only pass omits result schemas by
default while preserving an explicit caller profile. This prevents
another manually incomplete allowlist while preserving the runner's explicit
caller-selected manifests for other experiments:

```sh
node experiments/analysis-efficiency/select-kuna-tools.mjs \
  .cache/atomic-codemode/kuna-native-tools.json
```

The generated sixteen-tool list exactly matches the corrected measured manifest.
Its final actual MCP check takes 3.644 family wall / 3.491 CPU seconds with
441.8 MiB kernel peak, OOM 0 and verified cleanup. Generation happened after the
model batch; no result is retroactively attributed to a changed runtime.

## Completed-task costs

Execution order: Code Mode v1, under-equipped traditional v1, direct atomic v1,
then corrected traditional v2. Atomic catalogs are complete (18/4 tools), while
the corrected traditional client selects the complete declared Kuna native set
and shared session/views from its complete production catalog.

| Whole-task measure             | Direct atomic | Code Mode | Traditional, corrected |
| ------------------------------ | ------------: | --------: | ---------------------: |
| Cumulative input tokens        |       258,586 |   419,533 |                577,672 |
| Included cached input          |       221,568 |   380,928 |                536,192 |
| Uncached input                 |        37,018 |    38,605 |                 41,480 |
| Output tokens                  |         4,252 |     5,099 |                  4,698 |
| Included reasoning output      |         1,310 |       945 |                    952 |
| Observed model responses       |            11 |        14 |                     20 |
| Client executions / waits      |        10 / 0 |    13 / 0 |                 13 / 6 |
| MCP attempts                   |            11 |        14 |                     13 |
| Rejected MCP attempts          |             0 |         0 |                      2 |
| Model wall seconds             |       118.584 |   141.934 |                338.164 |
| Family wall seconds            |       119.140 |   142.946 |                338.707 |
| Family CPU seconds             |        13.220 |    24.203 |                179.062 |
| Kernel process-family peak MiB |         577.1 |     632.7 |                  977.6 |

The exploratory nine-tool traditional run takes 357.142 model / 357.663 family
wall seconds, 162.112 CPU seconds and 920.9 MiB kernel peak. Its cumulative input
is 770,290, including 700,928 cached (69,362 uncached), with 7,092 output including
2,736 reasoning tokens. It has 26 model responses, 22 executions / 3 waits and
49 MCP attempts / 29 rejections. Those costs are not silently dropped or used
to inflate the primary comparison.

All runs request `gpt-6.1-sol/high` through Codex 0.161.0; the resolved service
build and remote compute costs are unknown. Per-response usage sums match the
ledger. Cached input is included in input; reasoning is included in output.
Guidance, schemas, discovery, waiting and failures remain charged. Runtime,
target and engine fingerprints stay unchanged. One CPU, 4 GiB hard / 3 GiB
early-stop bounds apply; every run has OOM 0 and verified payload/profile cleanup.
Kernel peaks include charged file cache, not RSS. Fresh leases/private caches
do not control OS/model caches or host contention. Raw records remain local as
`ssh-warning-{direct,codemode}-v1*` and `ssh-warning-traditional-v{1,2}*` under
`.cache/atomic-codemode/`; `summarize-trials.py` reconstructs costs, not grades.

## What this changes

Direct atomic uses only two string, two reference and four instruction reads:
it answers the common question without an SSA capture or C read. Code Mode
performs 22 successful inner reads, including three snapshots and three C views.
It really uses both new exact-location and `value_uses` queries to connect the
warning input, but its additional native work and response rounds cost more.
The new queries are useful capabilities; this task does not require them.

The corrected traditional model performs four function dossiers. Its native
profile obtains assembly through a whole-program export, whereas selected
machine windows avoid that work. This is a real workflow difference, not an
isolated comparison of the server dispatch mechanism. Native timing variation
and different model choices also remain confounds. Each client already exposes
JavaScript composition, including the direct/traditional lanes.

In this one completed task, both atomic workflows use less cumulative/uncached
input, wall time, CPU and peak memory than the corrected traditional workflow.
Direct atomic also beats Code Mode on those measures. This supports making
machine facts and precise ownership available on demand; it does not establish
general provider parity, global complex-software superiority, a causal benefit
from the two new queries, or an inherent Code Mode advantage. Richer analysis
should remain available when the analyst question needs it.
