# Browser and Electron code-mode pilot

This isolated experiment asks whether model-written JavaScript composition of
the same REA tools improves actual investigation outcomes, model usage and
latency. It does not add a production tool, change a provider or authorize
new target execution. This directory is outside the package's `files` list.

See [the measured pilot results](results-2026-10-15.md) before interpreting
this harness as evidence of a code-mode benefit.

## Decision and preregistration

Primary comparison: the best supported current REA workflow, including source
selection, summaries and retained views, versus the **same** backend, artifacts,
tool allowlist and analyst question accessed through client code execution.
The model writes its own loops, filtering and joins; canned author-written
projection scripts are not credited as agent code-mode results.

Requested model: **gpt-5.6-terra**, reasoning **high**, local Codex CLI. Preserve
the requested alias and separately observe what the client actually does.
Do not silently substitute another model or interpret a feature flag as proof
of execution mode. Existing REA experiments found executor use in trials
labelled direct, and direct MCP calls in trials labelled code-mode.

Hypothesis: code mode reduces total and uncached model input plus end-to-end
latency for questions requiring multiple dependent reads or aggregation,
without reducing claim correctness, provenance or coverage honesty. Simple
lookups may instead cost more because of discovery, code generation and
debugging. A null, negative or inconclusive result is valid.

Use shipped applications and real public-web observations, not CTFs, synthetic
applications or source-owned demonstration targets in the scored cohort:

- Obsidian 1.14.4's published Electron ASAR, pinned by the existing corpus
  acquisition and artifact digests; static investigation only.
- A frozen capture of the actual public Excalidraw application in an owned
  empty-profile browser. Reuse the exact recorded bytes across treatments;
  do not compare independently changing live sessions as equivalent inputs.

Questions cover a small exact lookup, a cross-record/IPC or source join,
network aggregation, and a claim the available evidence cannot establish.
Score exact requested facts and evidence-supported unknowns. Do not count
keyword mentions, fluent prose or a smaller response as correctness.

Before scored trials, establish a native treatment-validity gate: direct runs
must contain actual direct MCP calls and no JavaScript executor. That gate
failed with Codex 0.161.0: the requested direct configuration invoked `exec`,
which failed when its host was disabled. The enabled host successfully called
the same session tool. These are retained infrastructure observations, not
scored application comparisons.

The scored pilot therefore uses a common **external JSON action protocol**.
The same Codex CLI samples one action at a time, with native tools disabled;
the same REA SDK client executes each action. Direct actions invoke one
production tool; code actions run model-written synchronous JavaScript in
QuickJS and expose the same production tools through `rea.call(name,args)`.
Both can discover original contracts on demand. No author-written answer
projection is inserted into either treatment. Any observed native tool call
invalidates the controlled trial. This measures organization under this
protocol, not native Codex direct-MCP versus native Codex code-mode latency.

Every model round starts a new CLI invocation with the full common question
and accumulated action/observation history. Count all actual usage, including
repeated client instructions and generated JSON escaping. Common client
startup and context replay can amplify a difference in model round count;
this is a limitation of the pilot, not a production speedup claim.

Use the same relevant minimal tool allowlist in both primary arms, rather
than charging one arm the complete unrelated REA catalog. Measure discovery
separately. Dossier versus primitive versus retained-view organization is a
secondary question: it must not be confounded with backend quality, task
selection, tool count or extra information available only to one arm.

Freeze the task set and expected facts before model trials. Run counterbalanced pairs
serially, retain all planned outcomes, and separate development smoke checks
from the scored cohort. Report this as a pilot, not a population-level result.

## Resource and data controls

Reuse `../analysis-efficiency/resource-run.py --memory-gib 8 --observe-payload-exit`:
one CPU, 8 GiB whole-process-tree hard memory, no swap, a 6 GiB early stop,
192 tasks (browser acquisition may explicitly use the verified 256-task
ceiling), at least 12 GiB host available memory to start, and a stop below
4 GiB available. Earlier build/native preflights used the unchanged 4 GiB
default; the user subsequently authorized 8 GiB total. Run builds,
acquisition, analysis and model trials one at a time. Retain limit and cleanup
failures. Payload-exit counters are not final whole-scope counters.

Reuse `agent-trial.py`'s isolated account/configuration, authentication-only
copy and guaranteed credential removal. Disable shell, browser driving,
unrelated tools and multi-agent delegation during static trials. Analyze data
in code without evaluating target JavaScript. Downloads, runtime artifacts,
original Evidence and transcripts stay outside the checkout. Persist only
explicit selected settings, never ambient environment or credentials. Guest
code has a 128 MiB heap, 5 seconds compute per cell excluding backend waits,
64 KiB source and 512 KiB printed output; both arms share a 64 backend-call
trial limit including preparation. Model rounds time out after 180 seconds;
the trial has a 960-second watchdog and at most ten actions.

Preparation uses a fresh production REA process per trial, a 512 MiB parent
Node old-generation heap and production worker limits. This can truncate the
semantic graph; retain and report the original coverage. Selected task facts
must agree with the frozen oracle. Do not generalize this cohort to complete
semantic reconstruction. Both treatments use identical settings.

Report model input/cached/uncached/output/reasoning usage when observed,
per-response context observations, discovery and printed intermediate output,
errors and retries, wall time, CPU and process-family/cgroup memory. Label
BPE estimates separately from actual model usage and unknown physical counters
explicitly. Keep startup/preparation versus question-only costs separate;
do not claim a cache speedup from warmed client schema validation.

## Reuse ledger

- Reuse unchanged: REA production analysis and evidence tools; the artifact
  corpus identities; owned cgroup resource supervisor; selected Codex rollout
  capture; isolated profile and authentication cleanup.
- Adapt: the existing agent runner gains an opt-in executor-host switch; its
  default remains `inherit` so earlier studies retain their original behavior.
- Learn: whether this installed Codex/model combination can genuinely expose
  distinct direct and code execution treatments, and whether benefits survive
  actual shipped-application tasks.
- Prototype boundary: no new runtime authority, no IDA database mutation,
  production integration, global configuration changes or upstream code copied.

## Running the pilot

Use the pinned Node/npm toolchain and an already built runtime. Install
`quickjs-emscripten@0.31.0` in an isolated temporary prefix; do not add a
production dependency. Acquire and verify the Obsidian corpus artifact using
`../analysis-efficiency/corpus.json`. `capture-web.mjs NEW_ABS_DIR ABS_CHROMIUM`
captures the actual public Excalidraw application in an owned sandboxed
browser, using the configured HTTPS proxy without logging its credentials.

`prepare.py --data ABS_DATA_ROOT` freezes the eight-trial plan, task bytes and
oracles after the separate Obsidian selected-source evidence acquisition.
Its directory names match the recorded experiment acquisition. Each task has
one direct and one code trial; order alternates between tasks, without a
second repetition. Run each separately under the resource supervisor:

```sh
python3 experiments/analysis-efficiency/resource-run.py --memory-gib 8 \
  --observe-payload-exit -- \
  python3 experiments/browser-electron-code-mode/trial.py \
  --arm code --task /tmp/DATA/cohort/TASK.json \
  --output /tmp/DATA/cohort/TASK-code \
  --quickjs /tmp/RUNTIME/node_modules/quickjs-emscripten
```

Retain supervisor output as `/tmp/DATA/cohort/TASK-code.log`.
`review.py --cohort /tmp/DATA/cohort` checks exact facts and observed resource
counters. Separately inspect every answer, supporting Evidence and actual
agent code for claim support, honest limitations and treatment validity.
The HAR grouping oracle reads original HAR records independently. Obsidian
counts and module identities are consistency checks against separately
retained producer Evidence; they do not independently validate the extractor.

The follow-up `prepare_dependencies.py --data ABS_DATA_ROOT` freezes one
additional Obsidian dependency question. Run both arms with
`--compositional-followup --max-rounds 32`: direct actions can contain a batch
of independent calls, and code is explicitly instructed to filter/combine
before printing. The code arm runs first in this single pair. This is an
adaptive follow-up prompted by the first cohort's lack of actual composition,
and is reported separately, with its prompt/protocol changes visible. It does
not replace the original outcomes. Complete raw replies and task facts remain
available to both arms; only the model-visible organization differs.

`test_backend.py` uses the real session SDK boundary to verify guest isolation,
allowlisting, compute/output limits, subsequent-cell recovery and shutdown.
It requires `REA_EXPERIMENT_QUICKJS` pointing to the isolated QuickJS package
and should run under the same resource supervisor. It is infrastructure
verification, not a toy application benchmark. `test_review.py` checks that
diagnostics cannot attest to Evidence and legitimate answer shapes preserve
exact facts without repairing incorrect IDs.

## Primary references

- [Hex-Rays IDA MCP](https://hex-rays.com/blog/hex-rays-ida-mcp-server): small
  database/Python/reference tool surface and an attributed internal benchmark.
  Its reported savings are not REA results or a transferable acceptance target.
- [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/): API discovery
  and composition without model-visible intermediate transfers.
- [Anthropic code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp):
  progressive disclosure, local processing and code-generation tradeoffs.
- [Codex noninteractive execution](https://developers.openai.com/codex/noninteractive/):
  actual CLI event/usage output; verify against the installed client.
