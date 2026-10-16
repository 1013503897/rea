# Client waiting and whole-task cost

The [selected-case pair](switch-study.md) exposes one-second client polls after
the snapshot execution yields. Direct makes six waits (three one-second then
three ten-second requests); Code Mode makes three one-second requests. Five
direct and two Code Mode wait responses still report a running cell. Initial
execution yields after about 31 seconds in both lanes. This is observed client
behavior, separate from MCP attempts and native source-capture time.

Native latency remains variable, including in sequential scripted MCP runs
without models. The [overlap canary](overlap-study.md) did not establish a cause.
No analysis acceleration or cache invalidation change is proposed here.

## Frozen diagnostic

The opt-in runner flag `--guide-long-waits` appends exactly the same client wait
policy in both lanes: resume an already-running cell with a 30,000 ms wait,
respect the advertised schema, and do not sleep or duplicate analysis merely
to check progress. It changes neither the initial execution yield policy nor
the provider/Code Mode deadlines. It supplies no analysis facts. The policy,
flag and instruction digest are recorded in each trial's settings. Older runs
without this flag remain a separate stratum.

Run Code Mode first, then direct, with the unchanged
[question](sqlite-switch-question.txt) and [oracle](switch-oracle.md), final
`a9ca8a8a...` engine, complete four/eighteen-tool catalogs and the same exact
discovery/envelope guidance as the first pair. Use fresh leases and isolated
model workspaces, requested `gpt-6.1-sol/high`, Codex 0.161.0 and the same one-CPU,
4 GiB hard / 3 GiB early-stop resource policy. No runtime edits during the pair.
Local records use `sqlite-switch-{codemode,direct}-v2*`.

Review complete answers against the frozen independent machine oracle and
retained source, including selector widths, all requested cases, signed target
arithmetic, case/edge identities, native default versus machine out-of-range
guard, provenance and unknown runtime behavior. Require one VM capture and
focused reads; a lower token count without a correct answer is not a win.

Record actual wait arguments and running/completed responses, model responses,
all input/cached/uncached/output/reasoning tokens, MCP/API attempts, wall time,
family CPU, kernel family peak, native source-capture time, identity/freshness
and cleanup/OOM status. Count discovery, guidance and unsuccessful waits in
whole-task usage. Fewer polls would establish adherence in this client, not
causally lower tokens or native latency. A before/after pair remains subject to
model choices, prompt caches, host contention and run order; do not subtract
native or polling intervals to manufacture an adapter speedup.

The [official Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference)
documents client configuration but does not establish the `wait` contract used
here. The actual captured client calls and subsequent run establish behavior;
no configuration feature flag is treated as proof of the available surface.
The native/API contracts are unchanged.

## Executed repeat

Both runs pin `790cdfdef`, with Code Mode first and direct second. Both complete
answers again pass the frozen oracle: format ownership before capture, selector
widths, all five selected case identities/edges/targets, signed table arithmetic,
the absent explicit `0xb6` case and distinct native-default/machine-guard
destinations. Direct cites eleven observed source IDs; Code Mode cites ten.
Each has one VM source, equal to the full prior graph/ordinary-field golden,
and no complete case/C/graph fetch. Both close the lease and retain the stated
static/alias/runtime limits. Source fidelity does not prove global equivalence.

| Whole-task measure             | Direct atomic | Code Mode |
| ------------------------------ | ------------: | --------: |
| Cumulative input tokens        |       280,035 |   372,288 |
| Included cached input          |       221,312 |   343,168 |
| Uncached input                 |        58,723 |    29,120 |
| Output tokens                  |         4,648 |     5,384 |
| Included reasoning output      |         1,122 |       862 |
| Observed model responses       |            12 |        16 |
| Client execution / wait calls  |        10 / 1 |    14 / 1 |
| MCP attempts, including reject |            17 |        15 |
| Successful atomic fact reads   |            14 |        19 |
| Model wall seconds             |       175.908 |   196.640 |
| Family wall seconds            |       176.382 |   197.767 |
| Family CPU seconds             |        66.735 |    56.081 |
| Kernel process-family peak MiB |         786.6 |     870.3 |
| VM source-capture wall seconds |        47.010 |    39.828 |

Both request `yield_time_ms:30000` once, resuming their pending snapshot cell;
the waits return completed results after 16.5 seconds direct and 6.5 Code Mode.
Neither adds an unsuccessful running-cell poll. This establishes adherence,
and reduces waits from six/three to one/one in these samples. It does not
establish a causal token/latency reduction: native capture times and subsequent
investigation choices differ, and the Code Mode repeat makes more fact reads.

Code Mode's attempts include a schema-rejected `timeout_ms:200000` (maximum
120,000), then a valid retry. Later a script returns complete input arrays from
operations at a PHI-heavy origin and exceeds the 32 KiB result budget. Its three
host reads succeed and source Evidence survives; the next script returns a
smaller projection successfully. Both costs stay in the ledger. Direct has no
failed attempts. The timeout mistake also occurred in the earlier control task:
the next interface check should make the default/maximum explicit in discovery,
using the execution owner's policy rather than another copied constant.

Within this repeat, Code Mode uses 32.9% more cumulative input, 15.8% more output
and 11.8% more model wall time, while using 50.4% less uncached input and less
family CPU. Relative to the first pair, direct cumulative input falls but its
uncached input rises; Code Mode cumulative and uncached input both rise despite
fewer waits. There is no stable whole-task winner across these strata.

Per-response usage matches the ledger; guidance is included in token usage.
Runtime, engine and target fingerprints remain unchanged. OOM is zero and
payload/profile cleanup is verified. Resource/model settings and the cold-lease,
uncontrolled-cache/host and unmeasured-remote-compute limitations remain as above.
Kernel peaks include charged file cache, not RSS. Both clients already provide
JavaScript composition. Full records use the declared `-v2` local paths; the
unchanged summarizer reconstructs actual usage but does not grade correctness.
