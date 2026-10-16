# Atomic RE through Code Mode

This is an **in-progress experiment**, not an integrated provider release. Branch
`experiment/atomic-codemode-20261016` starts at main
`42fc6c53ae188978deb3bedfe88287b6b316ba22` and carries the previous atomic-facts
prototype. Historical measurements in `../atomic-re-tools/` retain their original
baselines. No PR or merge is intended.

The goal is a real model completing reverse-engineering questions through
composable facts, with Code Mode as the calling adapter. A configured feature flag,
a scripted verifier or a small response does not prove that goal.

The reference is [Hex-Rays IDA MCP](https://github.com/HexRaysSA/ida-mcp/blob/df6de7985b534a964c125d5a86e41b26b17b14f6/ida_mcp/mcp.py):
an on-demand `reference` lookup and an execution entrypoint over a richer analysis
API. This experiment uses JavaScript and a QuickJS WASM environment rather than
Python in the host process. It exposes only declared static analysis capabilities.
It does not add target execution, patching or GUI control.

Three boundaries own the implementation:

- `provider.mjs`, `native-ir.mjs`: existing REA native target/process owners and parsed Kuna
  string/reference/SSA facts, retained sources, freshness and cleanup.
- `api.mjs`: named, validated fact/relationship contracts and session admission.
  SDK callers, CLI scripts and both MCP adapters use these same methods.
- `executor.mjs`, `server.mjs`, `cli.mjs`: bounded JavaScript composition and
  presentation. No analysis is reimplemented in the execution environment.

The complete Code Mode MCP catalog is `open_binary`, `reference`,
`execute_javascript`, `close_binary`. Setting `REA_ATOMIC_ADAPTER=direct` exposes
the same fact API as `facts_*` MCP operations for comparison. This is a distinct
experimental server; the production REA catalog is not filtered or replaced.

Use the pinned Node, an existing REA build and a caller-supplied Kuna 1.833:

```sh
npm ci --prefix experiments/atomic-codemode --ignore-scripts
node --test experiments/atomic-codemode/*.test.mjs
REA_KUNA_COMMAND=/absolute/path/to/kuna node experiments/atomic-codemode/server.mjs
```

The local MCP registration for real model trials is named `rea-codemode`.
`agent-trial.py --mcp-entrypoint /absolute/path/to/server.mjs
--server-name rea-codemode --protocol-profile atomic --profile-parent /tmp` creates an isolated
configuration, home and empty working directory for the model. Shell/file tools,
web search and delegation are disabled. No repository or oracle is placed in that
workspace. The copied authentication file is removed with the isolated profile.
Model output, actual MCP calls, original errors and usage remain in the trial
directory. `REA_ATOMIC_TRACE` and `REA_ATOMIC_EVIDENCE_DIR` retain actual API calls
and complete sources outside the model workspace when explicitly selected by the
evaluator. The ambient environment and credentials are not logged.

Current bounds: 64 MiB guest heap, 32 KiB code/output, 64 host calls per execution,
120 seconds wall deadline and 2 seconds of guest synchronous execution; native requests have existing supervision, an 8 MiB
capture budget and 1 GiB function-memory limit. Retained source storage is 64 MiB
per target, with two resident indexes (at most 2 MiB diagnostic or 8 MiB native
source each). Sources are
content-digested and retained until close; explicit evaluator copies survive
close. Capacity failures are explicit, not clipped facts. Leases and snapshot
handles prevent cross-session joins.

The diagnostic SSA format still has incomplete CFG and phi predecessor coverage.
The opt-in [native recovered IR experiment](native-engine.md) adds full recovered
CFG edges, exact value/operand identities, phi incoming-edge bindings, selected
`values`/`blocks` reads and derived control dependence. It requires an explicitly
pinned patched engine; stock Kuna does not gain those capabilities from a wrapper.
Runtime successors, memory aliases and machine-semantic equivalence remain
unknown. Other providers are not yet wired to this experimental service.

The initial [actual model comparison](trials.md) favors the focused traditional
workflow. The seeded value-origin task has lower cumulative input and wall time
through Code Mode, but initially exposes an IR-to-machine-path error. The revised
trial correctly explains that machine path with lower observed task costs;
broader claims still require more than this single seeded task.

The large SQLite VM diagnostic task also completes when its native graph exceeds
capacity. Atomic direct beats Code Mode on cumulative input and wall time in
that sample, and a traditional reused-project run is fastest. The actual CLI
client already exposes JavaScript dispatch in every lane, regardless of requested
feature flags. MCP request counts therefore do not establish fewer model rounds;
the ledger now records actual model responses and client dispatch/wait calls.

`instructions` reads selected machine byte/decode windows through the same
owner. Recovered operations use `origin_address` and blocks `origin_start`;
these locations cannot be substituted for machine branch destinations. The
value-origin trial demonstrates why this boundary matters. The experiment
currently has twelve fact methods, still behind the same four-tool Code Mode
catalog.

`functions` provides selected name/alias/entry reads. Native snapshots report
code and recovered-IR facets separately, preserving readable code when graph
extraction is unavailable. Real capacity and cold/warm MCP checks are documented
in [native-engine.md](native-engine.md). Whole-model costs and unequal-depth
comparisons remain separate in the trial report.

The corrected SQLite comparison reaches the formatter implementation in all
three interfaces. Code Mode uses fewer calls than atomic direct in that sample;
a traditional run reusing its persistent whole-project cache is faster than
Code Mode's fresh lease. Cache state, completed-answer coverage and actual
uncached tokens must therefore accompany any cost comparison.

SDK views share immutable parsed inventories with their owner. A real SDK probe
initially changed a returned string and made the next query disappear under the
same Evidence ID. Freezing at the cache boundary fixes that producing rule,
without copying or parsing the entire inventory for each read. `verify-sdk.mjs`
checks the real provider's string/metadata/function views and complete retained
source digest. The fixed probe passes under the bounded runner (1.328 seconds,
1.144 family CPU seconds, 110.6 MiB kernel family peak, zero OOM kills and verified
payload cleanup); it is a correctness check, not a model-cost measurement.

Encoded size is another real coverage boundary: two SQLite functions initially
lose even their C because pretty JSON exceeds transport capacity. The native
patch now uses bounded compact serialization and a graph-only failure when
needed. Parser's full graph fits; Pragma retains identical C with an explicit
missing graph. The 8 MiB bound remains. See the exact sizes, rebuilt engine digest
and verification scope in [native-engine.md](native-engine.md).

Completion requires actual model Code Mode use, independently checked task
answers, shared atomic/direct/Code Mode semantics, needed relation coverage,
failure/cancellation/identity tests, and equivalent completed-task measurements
including discovery/retries, actual model usage, cold/warm analysis, CPU and
process-family peak memory. Negative cases such as the small SQLite function
must remain in the comparison.
