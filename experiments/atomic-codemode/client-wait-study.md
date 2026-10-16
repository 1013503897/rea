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
The native/API contracts are unchanged. Results are pending.
