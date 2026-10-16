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

| Required local fact | Independently checked anchors |
| --- | --- |
| Open and release strings are distinct | `0x12c500` and `0x12c538`; loads at `0xf2381` and `0xf2437` |
| Operation selector zero takes the open path | Load `[op+4]` at `0xedbe5`, test `0xedbf0`, `JNE 0xf0340` at `0xedbf2` |
| Open is rejected for a positive signed counter | Load `[db+0xd8]` at `0xedbf8`, test `0xedbff`, `JG 0xf2372` at `0xedc01` |
| Release first resolves the named savepoint, then tests counter and selector | Chain `[db+0x2f0]` at `0xf0340`, links `+0x18` at `0xf0358`, name comparison `0xf036f`; signed `JLE` at `0xf0382` bypasses rejection, selector `==1` at `0xf0384` / `0xf0389` selects `0xf242d` |
| Both use the same emission/error tail | Open falls to `sqlite3VdbeError@plt` call `0xf238b`; release jumps there at `0xf2446`; local status becomes `5` at `0xf239d`, then jumps to `0xea828` at `0xf23b8` |
| Missing name differs | Null chain tests `0xf0347` / `0xf035f` reach `0xf1139`; separate format `"no such savepoint: %s"` and call `0xf115c` |
| Static authority and coverage remain explicit | Counter/selector names are interpretations of offsets; runtime feasibility, actual dynamic binding and the final result after shared error processing require additional evidence |

The VM's real native-IR exporter exceeds its operation capacity. It retains
3,654 lines of reconstructed C and complete source Evidence. This task tests
whether a model can use those available facts plus selected physical instruction
windows without inventing a recovered graph. Its local status `5` must not be
silently promoted to an unconditional final function return: shared error
processing can still change behavior. No target execution is authorized here.
