# First-round results

This is a completed, bounded first round of exploration, including failures.
It does **not** establish that an agent solves complex RE tasks better than with
the existing tools. No PR, merge, target execution or executable mutation occurred;
Ghidra used its normal ephemeral analysis databases.

## Inputs and measurement

- REA base: `5b16f2431062eea6ffd245a9e05512790007cb13`; experiment commits retain
  the runnable code and tests. Node 24.18.0 / npm 11.16.0.
- Kuna 1.833, executable SHA-256
  `d858918b0766435cd96b999a77f2d5a31a0cc4f07256421c883b5b9dc4dd58e4`.
  These results do not verify newer Kuna releases.
- Ghidra 12.1.4, Temurin JDK 21.0.12.1+1, Java heap 1 GiB.
- Installed zlib: `/usr/lib/x86_64-linux-gnu/libz.so.1.2.13`, SHA-256
  `7e2a72b4c4b38c61e6962de6e3f4a5e9ae692e732c68deead10a7ce2135a7f68`.
- Installed SQLite: `/usr/lib/x86_64-linux-gnu/libsqlite3.so.0.8.6`, SHA-256
  `2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
- Real-provider jobs used the existing scope runner: one CPU, affinity to one
  allowed core, 4 GiB hard memory limit, early stop at 3 GiB. They ran serially.
  Build/type/test gates used separate bounded scopes, up to two CPUs / 4 GiB.
- CPU is complete owned-cgroup CPU at payload exit. Memory is kernel
  `memory.peak` for the process family, **including charged file cache**, not RSS.
  The observer verified cleanup and resource counters while its scope was alive.
- Tokens below are **offline `o200k_base` estimates**, tiktoken 0.14.0, over actual
  captured MCP payloads, including text and structured copies. They are not
  model-billed tokens. Model reasoning, tool selection, host rendering, cache
  billing and JSON-RPC framing were not measured.
- Each table row is **one sample**, not a median or controlled causal estimate.
  OS caches were not flushed. Startup and native work varied substantially on
  this shared host. No universal latency improvement is established.

## Experiment 1: transport granularity

Task: case-sensitive literal search (`incorrect` in zlib, `malformed` in SQLite),
select the first three provider-ordered string candidates, read at most four
exact-start reference sites per candidate, then resolve their containing
functions when advertised. Repeat in the same session to measure warm reads.
Unsupported Kuna function resolution remains unknown, rather than guessed.

The four variants use the same application/provider observations. Native query
planning was unchanged. `fine` reads individual facts; `batch` groups homogeneous
reads; `workflow` composes those same fact methods in one call.

These captures measure the **v1 fact response shape**, introduced at `fa8d6a7a2`.
Later selector/scope and transport-provenance clarifications are not retroactive
performance measurements; rerun the harness to measure their current payload.

| Provider / target | Variant  | Calls per task | Query payload tokens, first / warm | First query task ms | Warm task ms | Session CPU s | Peak family MiB |
| ----------------- | -------- | -------------: | ---------------------------------: | ------------------: | -----------: | ------------: | --------------: |
| Ghidra / zlib     | existing |             10 |                    41,565 / 41,565 |              34,926 |          429 |         50.00 |           1,444 |
| Ghidra / zlib     | fine     |             10 |                    23,483 / 23,483 |              34,260 |          120 |         47.37 |           1,376 |
| Ghidra / zlib     | batch    |              3 |                    20,114 / 20,114 |              75,202 |          218 |         52.63 |           1,360 |
| Ghidra / zlib     | workflow |              1 |                    19,824 / 19,824 |              75,491 |          198 |         51.76 |           1,276 |
| Kuna / zlib       | existing |              4 |                      5,638 / 5,638 |               4,079 |           44 |         16.12 |             905 |
| Kuna / zlib       | fine     |              5 |                      4,702 / 4,702 |               2,857 |           51 |         15.61 |             927 |
| Kuna / zlib       | batch    |              3 |                      3,774 / 3,774 |               2,843 |           59 |         15.14 |             911 |
| Kuna / zlib       | workflow |              1 |                      3,509 / 3,509 |               1,376 |           11 |         14.34 |             922 |
| Kuna / SQLite     | existing |              4 |                      6,039 / 6,039 |               5,874 |           24 |         19.15 |             994 |
| Kuna / SQLite     | fine     |              5 |                      4,753 / 4,753 |              13,058 |           47 |         20.40 |             989 |
| Kuna / SQLite     | batch    |              3 |                      3,829 / 3,829 |              25,868 |          217 |         25.85 |           1,022 |
| Kuna / SQLite     | workflow |              1 |                      3,560 / 3,560 |              36,231 |           39 |         58.19 |           1,004 |

Session CPU/memory include MCP startup, catalog/status discovery, both tasks and
close/cleanup. Query timers exclude the earlier `open_binary`; Ghidra lazily
performs import/preparation during its first query. Whole-session elapsed times
for existing/workflow were 50.67/104.15 s (Ghidra zlib), 32.46/16.63 s (Kuna zlib),
and 19.46/159.81 s (Kuna SQLite). The SQLite workflow's `open_binary` itself took
64.98 s versus 7.31 s in the existing-tools sample, before any experimental fact
query. Cause is unresolved; neither host contention nor adapter overhead has
been established as the explanation. Do not interpret these samples as a
controlled speedup or slowdown attributable to atomization.

**Failure retained:** the first Ghidra batch attempt hit its 120 s provider
request deadline during cold preparation. Its log ended in `ReaGhidraNoReturnFix`
after reporting successful auto-analysis. The attempt cost 141.45 s elapsed,
106.19 CPU s and 1,211 MiB peak; cleanup was verified and OOM kills were zero.
The successful batch row excludes that failed attempt; any retry-cost comparison
must add it. All twelve successful rows agreed on the selected strings,
reference sites and function-resolution outcomes within each provider/target.
That is adapter equivalence, not an independent proof of native discovery.

### Fixed context costs

The existing catalog had 207 tools; the prototype added five, retaining every
existing tool. Actual default catalogs included output schemas: about 842k /
843k estimated tokens. Removing only output schemas gives about 207k / 208k.
This input-only projection is **not** an assertion about any particular model
host: hosts can omit output schemas, deduplicate content or cache declarations.

For a session containing both completed tasks plus lifecycle/status traffic,
the input-only-catalog estimate changed as follows:

| Provider / target | Existing tools | Workflow |
| ----------------- | -------------: | -------: |
| Ghidra / zlib     |        319,907 |  277,458 |
| Kuna / zlib       |        245,476 |  242,249 |
| Kuna / SQLite     |        245,803 |  241,870 |

Thus a large reduction in query payload need not produce a large whole-task
context reduction. Catalog/discovery and repeated envelopes deserve separate
attention. This experiment has not yet tested a client that loads declarations
on demand or an explicitly smaller, separately declared service surface.

## Experiment 2: compute sharing in native Kuna

Both plans first obtain a complete reference-free scan, validated by REA's
existing string-fact owner. Then select three matching strings. The point plan
runs `xrefs --to` separately; the inventory plan runs `strings` with attribution
once, letting Kuna share its reference index. Full source JSON is retained
locally, while only selected facts need be exposed to a caller.

| Target | Plan               | Native commands | Elapsed s | CPU s | Peak family MiB |
| ------ | ------------------ | --------------: | --------: | ----: | --------------: |
| zlib   | per address        |               4 |     3.846 | 1.796 |           110.4 |
| zlib   | shared attribution |               2 |     2.838 | 1.341 |           114.4 |
| SQLite | per address        |               4 |    13.221 | 6.497 |           196.1 |
| SQLite | shared attribution |               2 |     6.261 | 3.028 |           196.6 |

For these selected samples, both plans found one owner per string. Their scopes
are nevertheless **different**: point references cover the first address;
attribution covers any byte in the string extent. Attribution also does not
return individual sites/kinds. These figures establish costs of the two real
plans, not a universally equivalent-query speedup. They support investigating
producer-level work sharing, with query selectivity and coverage kept explicit.
This is a native-boundary experiment, not an MCP/model token measurement.

## Experiment 3: the point/object distinction changes correctness

`interior-reference.c` is compiled with `gcc -O2 -fno-pie -no-pie` and never run.
Its `give_suffix` returns a pointer five bytes into `marker`. In this build,
`nm` reports `marker=0x402020`, `give_suffix=0x401120`; `objdump` independently
shows `mov $0x402025,%eax` followed by `ret` in `give_suffix`.

- Exact-start xref query: zero references, no owner.
- Extent attribution: one reference, owner `give_suffix` at `0x401120`.

`verify-interior.py` checks the compiled symbols, input and retained-source
digests, and both native results. This is a genuine counterexample to treating
"no xref to the start address" as "the string has no users". Neither tool was
wrong about its own scope. The compositional representation must carry the
object span and reference offset/scope instead of silently equating the questions.

## Experiment 4: existing relations do not always bridge into code

On real zlib, the three selected string references belong to `inflate` at
`0xc1e0`; their reference instructions are at `0xded7`, `0xdc6a` and `0xcd05`.
The native single-function JSON contains 52,431 characters / 1,620 code lines,
1,167 mapping records and 1,568 mapped instruction addresses. **None of those
three reference instructions occurs in the printer's line mappings.**

The exact-address composition therefore returns **unknown**, not a guessed
nearby line. The mapped-code run cost 8.387 s / 8.091 CPU s / 202.0 MiB, including
discovery/references and decompilation. It did not finish the analyst question
"which condition triggers the error?" and must not count as a successful
context-saving answer. A development attempt also used an unsupported
single-function timeout flag; it failed and was corrected after checking actual
CLI help. Single-function work uses REA's owned command deadline and native
`--max-fn-memory`; it does not accept the batch `--max-fn-seconds` flag.

The retained C text does contain the error literal at line 164, but a small
fixed window there omits the earlier check around lines 122–124. Literal search
and a larger manual read can help, but they are **reconstructed-text evidence**,
not the missing machine-to-source relation. This is not proof that Kuna's line
mapping is buggy: the contract does not promise every contributing instruction
survives transformation into an emitted line.

The next useful relations to test are instruction/block ownership, control-flow
guards and definition/use or contributing-origin edges across transformations.
For a stronger zlib question, an independent expected mechanism is the FCHECK
constraint in [RFC 1950 §2.2](https://www.rfc-editor.org/rfc/rfc1950.html#section-2.2):
the network-order CMF/FLG value must be divisible by 31. Testing an agent's
explanation against that mechanism would be a separate trial; this experiment
does not claim to have completed that trial.

## Validation

- All **191 Kuna regression cases in 20 files passed with one worker**; the
  owning reference parser's 18 cases include typed endpoints, distinct kinds,
  unknown ownership, alias exclusion and late malformed rows. A prior two-worker
  CPU-limited run had three timing-sensitive failures in existing project/export
  tests. Those tests were not edited; the isolated cause is not established.
- Nine experiment boundary cases passed, including stale artifact/profile/lease,
  partial batches, duplicate point lookups, paging, unsupported ownership,
  unmapped/unsafe addresses and invalid line locations.
- Typecheck passed with one checker. Changed experiment files passed formatter
  and lint; the existing graph parser's complexity warning remains unrelated.
- A real Kuna MCP run with the actual output-schema **off** profile passed
  paging, duplicate-selector, negative/unknown, retained-Evidence, foreign-context
  and expired-lease checks. Its live catalog had 212 tools and zero output
  schemas. Verification runs are excluded from the performance table.
- All real-provider measurements reported verified cleanup and zero OOM kills.
  No default parallel-suite stability, live-model reasoning improvement, general
  high-address code mapping, overlay support or newer Kuna compatibility is claimed.

## What this round supports

- A coherent fact includes the metadata needed to interpret it. One-field
  getters are not necessarily useful atoms.
- Fact, transport and compute units are different. Batches/workflows can share
  one fact implementation while the producer independently shares analysis.
- Identity and evidence are necessary, but scope and uncertainty determine
  whether joins answer the analyst's actual question.
- Complex-program effectiveness remains **unproven**. The experiments found a
  real coverage distinction and a real composition gap, not a universal RE API.

Raw captures, projects, binaries and counters remain ignored under
`.cache/atomic-re-tools/`. `summarize.py` checks selected-answer equivalence,
payload-exit cleanup and OOM counters, and includes failed runs separately.
