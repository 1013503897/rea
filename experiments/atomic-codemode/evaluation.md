# Task coverage before cost comparison

Code Mode can only compose facts the underlying API actually supplies. A task
cost is comparable after reviewing the completed answer and its evidence. A
successful tool call, fewer response bytes or more graph records is insufficient.
No claim of complete reverse-engineering capability follows from these tasks.

The atomic direct and Code Mode lanes share the same method registry, provider
owner, selectors, failures and retained sources. The traditional lane selects
relevant production tools, including the discovery route advertised by its
errors; its selection and extra discovery guidance are recorded. Use the same
target, engine, authority and question. Freeze runtime files for each model batch.
Keep full original errors, retries and partial answers in the record. Never show
this oracle document or repository sources to a measured model.

Review task facts separately from answer length. A confident false physical
branch target fails the value-origin task even if its reconstructed IR equation
is right. An answer stopping at an import stub does not complete a task whose
other lane traces the formatter implementation. A bounded missing graph is not
an empty graph. Mark unsupported facts unknown and report incompletion when the
question actually needs them.

Cache regimes are distinct: fresh analysis captures, a reused capture in the
same lease, a validated persistent project in a new session, OS file cache and
the model's reported prompt-cache tokens. These experiments do not clear the OS
cache. The prototype has no cross-session result cache. Whole-model cold and
reused-project trials therefore remain separate from the API-only same-lease
cache benchmark. Report cumulative input, included cached input, uncached input,
output and included reasoning; do not invent server compute or price savings.

All resource trials are serial with one CPU, 4 GiB hard memory, early stop at
3 GiB, and an observed cleanup receipt. Kernel family memory includes charged
file cache. A single stochastic trial is an observation, not a reliable ranking;
API-only replay cannot replace real model trials or establish their token cost.

The CLI transcripts establish that all lanes have a client JavaScript `exec`
surface, even with `code_mode=false` requested. Count actual model responses,
client dispatch/wait calls and MCP requests separately. This comparison is not
an ablation against a client incapable of code composition. The optional
`agent-trial.py --normalize-mcp-guidance` adds identical envelope/stopping guidance
to any lane: select `structuredContent` or parsed text once, avoid printing both
encodings, stop when supported and close the target. It is recorded explicitly;
the initial SQLite and VM rounds do not have that later guidance. Their native
analysis commands/profiles also differ (selected functions versus production
project and facet workflows); engine equality alone does not isolate Code Mode.

The pinned SQLite artifact is `/usr/lib/x86_64-linux-gnu/libsqlite3.so.0.8.6`,
SHA-256 `2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
The malformed-MATCH oracle and earlier unequal-depth results are retained in
[trials.md](trials.md). The next VM task is fixed in `sqlite-vm-question.txt`
before model trials. Its oracle is checked with GNU `objdump -d -M intel` over
the shipped executable, independently of both model answers and Kuna IR. Dynamic
symbol inventory (`nm -D --defined-only`) identifies `sqlite3VdbeExec` at
`0xea6d0`. Reconstructed C and printer line mappings help locate checks, but do
not replace the physical instruction evidence:

| Required local fact                                                         | Independently checked anchors                                                                                                                                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open and release strings are distinct                                       | `0x12c500` and `0x12c538`; loads at `0xf2381` and `0xf2437`                                                                                                                                     |
| Operation selector zero takes the open path                                 | Load `[op+4]` at `0xedbe5`, test `0xedbf0`, `JNE 0xf0340` at `0xedbf2`                                                                                                                          |
| Open is rejected for a positive signed counter                              | Load `[db+0xd8]` at `0xedbf8`, test `0xedbff`, `JG 0xf2372` at `0xedc01`                                                                                                                        |
| Release first resolves the named savepoint, then tests counter and selector | Chain `[db+0x2f0]` at `0xf0340`, links `+0x18` at `0xf0358`, name comparison `0xf036f`; signed `JLE` at `0xf0382` bypasses rejection, selector `==1` at `0xf0384` / `0xf0389` selects `0xf242d` |
| Both use the same emission/error tail                                       | Open falls to `sqlite3VdbeError@plt` call `0xf238b`; release jumps there at `0xf2446`; local status becomes `5` at `0xf239d`, then jumps to `0xea828` at `0xf23b8`                              |
| Missing name differs                                                        | Null chain tests `0xf0347` / `0xf035f` reach `0xf1139`; separate format `"no such savepoint: %s"` and call `0xf115c`                                                                            |
| Static authority and coverage remain explicit                               | Counter/selector names are interpretations of offsets; runtime feasibility, actual dynamic binding and the final result after shared error processing require additional evidence               |

The VM's real native-IR exporter exceeds its operation capacity. It retains
3,654 lines of reconstructed C and complete source Evidence. This task tests
whether a model can use those available facts plus selected physical instruction
windows without inventing a recovered graph. Its local status `5` must not be
silently promoted to an unconditional final function return: shared error
processing can still change behavior. No target execution is authorized here.

The post-serialization-fix Pragma task is fixed in `sqlite-pragma-question.txt`.
It tests a previously inaccessible code facet rather than treating a byte-limit
failure as a fast completed answer. The two experimental calling modes use the
same twelve methods and new engine digest `2290e8b1…`, with common normalization
guidance enabled in both. There is no new traditional cost cell for this task.
For the same pinned SQLite artifact, independent GNU instruction checks establish:

- `sqlite3Pragma` entry `0xb90e0`; value-pointer test `0xbae56` / branch `0xbae5c`
  distinguishes the read path from change handling at `0xb9b8c`.
- `0xb9b90` tests connection byte `+0x65`; zero branches at `0xb9b94` to diagnostic
  selection at `0xbc58a`. This precedes the additional selector-one bypass at
  `0xb9b9a` / `0xb9b9f`, so their ordering must be preserved.
- Allowed local update computes `(value+1)&7`, substitutes one for zero, and
  stores the selected record's byte `+0x10` at `0xb9bdc`; byte `+0x11` becomes one
  at `0xb9be3`. The input interpretation and source member names are derivations.
- The actual diagnostic call is `0xbc596` through `sqlite3ErrorMsg@plt` at
  `0x2a1e0`; `0xbc59b` jumps to common cleanup `0xb9293`.
- Cleanup releases both temporary strings, checks the stack canary, and returns
  at `0xb92d9`. Do not invent a fixed numeric return from this reconstructed
  void routine. No SQL-level runtime trigger is demonstrated.

Pragma's complete retained code and mappings are checked equal before/after the
serialization fix. Its recovered graph remains explicitly unavailable at the
encoded-byte capacity; that is a coverage limitation in both experimental lanes.

The next seeded table-composition task is fixed in `sqlite-table-question.txt`.
Both experimental modes have the same thirteen methods including `bytes`; a
traditional comparison is not claimed because its selected catalog/available
Kuna byte capability has not been established for this task. GNU disassembly of
the pinned artifact shows `sqlite3GetToken` at `0xe1480`: unsigned input byte load
at `0xe1480`, class-table base `0x12bcc0` at `0xe1484`, bound `0x1e` at `0xe1492`,
class reload `0xe1498`, jump-table base `0x12b600` at `0xe149c`, sign-extending
32-bit table load at `0xe14a3`, base addition `0xe14a7`, indirect jump `0xe14aa`.
The out-of-range path begins `0xe14f8`.

Independent direct file reads are valid here because `readelf -lW` binds this
artifact's selected addresses to the same file offsets in its read-only LOAD
segment (`0x11a000..0x154bfc`). A Python `struct.unpack_from('<i', ...)` check of
the actual table bytes gives these initial dispatch facts, before model trials:

| Input byte | Class | Signed displacement | Initial machine destination |
| ---------- | ----: | ------------------: | --------------------------- |
| `0x2d`     |    11 |             -302928 | `0xe16b0`                   |
| `0x2f`     |    16 |             -302144 | `0xe19c0`                   |
| `0x27`     |     8 |             -302480 | `0xe1870`                   |
| `0x22`     |     8 |             -302480 | `0xe1870`                   |
| `0x3f`     |     6 |             -302272 | `0xe1940`                   |
| `0x80`     |    27 |             -303440 | `0xe14b0`                   |

This oracle establishes static table/dispatch arithmetic, not final token
semantics, future runtime table contents or a feasible SQL input. Models must
retain those boundaries. This document is not supplied to measured models.

## Cross-function facts work; adapter gains remain mixed

The structured-call experiment closes an observed native export gap: the call's
fspec annotation does not identify its target code address, and an argument's
SSA storage is not its passing location. Reusing the native call-spec owner now
allows a model to connect a caller value to a callee input without parsing a
display string. Real SQLite answers support this connection with machine
instructions, trace a shared parenthesis counter across two functions, and
preserve the limits of recovered slots, aliases and runtime feasibility.

The first question pair omitted oracle-required alternative return paths in both
answers. Its wording was less explicit than its oracle, so that result stays a
partial-coverage record. A new question clarification was committed before the
next pair; both then satisfy the task. The failed engine-pin setup launch also
remains recorded. No sample is silently converted into a completed task.

In the correctness-equal pair, Code Mode uses 596,978 cumulative input tokens and
156.821 seconds versus direct's 611,321 and 147.424 seconds. Uncached input,
output, largest observed response input and family CPU are higher for Code Mode;
family memory peak is lower. Both use the same fourteen fact methods and a client
with JavaScript dispatch. The evidence supports usable composable call/input
facts, without proving that this server adapter is faster or cheaper. Broader
complex-software superiority and provider parity remain unproven.

Two remaining boundaries deserve independent experiments. First, the initial call view lived inside full recovered IR, so graph capacity
could hide a small otherwise useful call view. The next exporter revision now
captures calls and their boundary values independently; real VM verification
retains both while the graph exceeds capacity. Second, shallow outgoing references should serve a callee/reference list before
requesting deeper argument/value recovery. The subsequent implementation now
exposes Kuna's existing `xrefs --from` through the shared parser, with native kind
filters, explicit scope and paging. Real VM known-target references match an
independent disassembly pair set, and remain available when the full IR facet
exceeds capacity. The next pre-pinned model question measures this use directly. Keeping those costs
and coverage distinctions explicit is more useful than treating a smaller tool
catalog as proof of better analysis.

The shallow-reference question now completes through both real-model adapters.
Each composes 396 VM reference rows into 171 exact destinations and 16 calls to
the selected PLT address, then distinguishes a real stack-check call absent from
optimized IR. Both keep unresolved indirect/discovery/runtime limits. Native
reference pairs from both model sessions match the complete independent set of
396 direct immediate machine calls; the separate 21 indirect instructions are
not silently included in those known-target totals.

In this one pair, Code Mode takes 93.837 seconds and 264,680 cumulative input
versus direct's 106.183 and 285,086. Their maximum observed response input
contexts are almost equal. This is useful positive evidence for selected facts
plus local aggregation, while prior completed tasks show mixed adapter costs.
It supports continuing the experiment, not a universal speed/token/provider
superiority claim. Tool coverage and representation semantics were prerequisites
for this comparison: a recovered-call-only view would have missed a real call,
and VM full-IR capacity cannot establish that its shallow references are absent.

An additional shared CLI/API run with the unpatched stock Kuna 1.833 executable
also returns the same 396/171/16 VM aggregates, with fresh owned HOME/cache. The
outgoing-reference capability uses native support, independently of the opt-in
IR exporter. It takes 3.044 family wall / 2.695 CPU seconds and 182.6 MiB peak,
with cleanup verified and OOM 0; these scripted costs are not model-token data or
an adapter comparison. Stock external-spec freshness is still outside the engine
binary digest. Full repository typechecking remains resource-limited as recorded
in `native-engine.md`; source build, focused tests, changed-test typing and full
lint/module checks pass.
