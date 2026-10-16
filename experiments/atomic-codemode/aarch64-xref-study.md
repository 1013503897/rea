# Composable AArch64 address references

The AArch64 OpenSSH check exposed a real completeness gap before another model
comparison: both warning strings were present, but Kuna returned zero incoming
references for either. Native observations had unknown discovery coverage;
zero was not proof that the strings were unused. Independent GNU decoding
showed ADRP plus ADD at `0x2574c/0x25750` and `0x28534/0x2853c`.

The query scanner read one instruction's p-code at a time. The existing ARM
pool-displacement tracker supplied the relevant bounded value-flow owner, but
did not carry AArch64 page bases. The experiment extends that owner rather than
introducing another interpreter or postprocessing disassembly text. SLEIGH's
mnemonic licenses ADRP, and its exact constant COPY supplies the coordinate;
COPY/ADD/SUB then propagate the value. Machine operand text and hardcoded
register-offset tables are not reparsed. Possible page copies alone, such as
ordinary MOV-immediate instructions, do not establish PC provenance.

The same calculation produces Data for materialized register addresses, or
Read/Write for a LOAD/STORE through a composed default-data-space byte address.
The accessed cell is identified; its mutable/GOT contents are not propagated
as a live value. This also covers the selected GOT slot, which an intermediate
address-only fix still missed. Space-selector constants and stored values are
not mistaken for access pointers.

The directly related refactor renames the former private pool-only module to
`kuna_pc_relative`, moves its tests out of the implementation and retains one
value lookup for arithmetic and memory accesses. Keys preserve native space
identity, offset and width. Partial overwrites invalidate overlaps; copies can
carry a known value into a different register. Calls/jumps/returns stop carry,
instruction-local predicates do not execute both arms sequentially, a pool
load overwritten later in the same instruction cannot seed a stale value,
unsupported widths remain unknown and interval checks include the final u64
byte without overflow. Empty/failed assembly rendering cannot license ADRP.

State remains function-local, follows fall-through addresses and keeps the
existing eight-hop/eight-value bounds. It is not a complete fixed-point,
cross-call, alias, runtime-value or feasible-path analysis. Unknown discovery
and indirect-target coverage remain explicit through the shared parser and
SDK/CLI/MCP views. Both experimental adapters and the traditional Kuna provider
consume the corrected native producer; no special advantage is injected into
one evaluator lane. Stock Kuna is not silently upgraded.

## Pins and real artifacts

REA refreshed main through `0d2247428` before this work. The native upstream is
`fe01d6294eb0d1053ce343c8943646df88e143fc`, overlay SHA-256
`62cb9d9386d110ca1301d4f7d541d0d1ee676f17ca888163cf7d69d8a9d07c53`.
The copied immutable embed-specs/opt1 engine SHA-256 is
`e43185ff11e74c18753e8755c7757ef6ede415c87a1dac9f04bb39856de87f43`.
Default forward-index and reverse-worktree patch checks pass. New analysis
patch sections use Git-supported unprefixed empty context lines, preserving
line counts/source bytes without whitespace-only lines in the patch artifact.

The target is extracted Debian arm64 OpenSSH, SHA-256
`de352e4ace7028d9816fd0ee9d22936bc1b5622c400d5b0b7df660df3426b068`.
The [storage study](storage-study.md) records its package URL, digest and
unverified package-signature scope. It was neither installed nor executed.
The [independent machine oracle](verify-aarch64-machine.py) reads checked
file-backed ELF ranges, validates selected instruction/branch math and GNU FDEs,
and confirms the selected RELATIVE relocation. It does not read Kuna output.
The oracle refuses optimized Python rather than silently disabling assertions.

The real SDK verifier returns one reference for `0xb0468`, from `0x25750`,
owned by `0x256c0`; and one for `0xb1330`, from `0x2853c`, owned by `0x27848`.
It also verifies both direct caller sites and 77 reads of GOT slot `0x10ff20`,
including `0x256d0`, `0x27908`, `0x27dcc` and `0x28eb8`. The slot's selected
loaded-image bytes agree with the independent file read, while runtime memory
remains not-observed. Full retained source digests are verified. A warm repeat
uses the same Evidence IDs and identical facts.

## Executed checks and costs before model trials

| Check                                                         | Family wall s | Family CPU s | Kernel family peak MiB |
| ------------------------------------------------------------- | ------------- | ------------ | ---------------------- |
| Refreshed REA runtime build                                   | 36.660        | 35.931222    | 2989.1                 |
| 17 final PC-relative tests, including compile                 | 69.090        | 68.844945    | 885.1                  |
| All 125 Listing tests, including those 17                     | 0.524         | 0.349058     | 59.2                   |
| Final native CLI build                                        | 104.525       | 104.240617   | 630.2                  |
| Real AArch64 SDK/source verifier                              | 13.109        | 12.857963    | 203.1                  |
| Old x86 complete-function/prototype fidelity through real MCP | 8.779         | 8.516305     | 302.0                  |
| Both actual atomic catalogs and converted schemas             | 1.932         | 1.689159     | 139.3                  |
| All 87 experimental JS tests                                  | 5.060         | 4.890171     | 78.8                   |
| Complete traditional capability/catalog selection             | 4.148         | 3.761593     | 443.2                  |
| Actual traditional MCP target/C/assembly preflight            | 103.002       | 102.596202   | 872.3                  |

The independent machine verifier, changed-file lint/format checks and patch
application checks also pass; their CPU/memory costs were not separately measured.
All measured successful runs have observed OOM 0 and verified payload cleanup.
Resource scopes use one CPU, 4 GiB hard/3 GiB early-stop memory, TasksMax192 and
swap disabled. Peaks include charged file cache and are not RSS. Final
whole-scope counters are unavailable; table values use verified payload-exit
observations. Broad repository type checking retains the previously reported
resource-limited gap; no passing full typecheck/native corpus gate is claimed.

The 17 PC-relative tests include the retained pool-displacement cases and new
page/copy/space/width/clobber/predicate/access cases; they are included in the
125 Listing tests, not additional independent executions. An intermediate run
passed 16/17: its obsolete assertion expected no reference when a composed
temporary was dereferenced. The intended extension now identifies that actual
cell Read while retaining the negative assertion against a register address-taken
claim. The test was updated to require exactly that stronger typed outcome.
All failed/intermediate receipts remain local; they are not model attempts.

The AArch64 two-address reference batch takes 3,548.3 ms wall / 3.535213 CPU s
on a fresh lease, versus 1.54 ms / 0.001539 s for the same-lease repeat. This
shows retained-source reuse, not faster native discovery. Old engine c48ad957
returned incorrect zero results; its costs are not an equivalent completed-task
performance baseline for those new facts.

A separate equivalent x86 task requests the same three exact-address reference
sets before/after. Every normalized fact and coverage field agrees (counts
1/1/2), using fresh leases/private caches. Its old/new cold phase is
4,028.3/4,082.2 ms wall and 3.993216/4.031850 CPU s; warm is 3.30/2.38 ms.
Whole-run wall is 4.852/4.852 s, CPU 4.554857/4.580338 s, peak 155.3/157.4 MiB.
This single lookup repeat shows no material observed regression for that case;
it is not a model-token measurement or a general speed guarantee. OS/cache and
host variation remain uncontrolled.

## Frozen model task

The [question](aarch64-warning-question.txt) and [oracle](aarch64-warning-oracle.md)
ask the same behavior-level warning/pointer/guard/cleanup question through
three complete interfaces. Native SSA identities are optional. Traditional
preflight supplies the same strings, actual references, both C/assembly dossiers,
and recovered static `dat_1104f8`, with target/engine digests verified. Its first
dossier costs 95.291 s waiting for whole-program export; later assembly/dossier
reads reuse that cache. Atomic selected-native profiles differ, so the planned
comparison is a full workflow comparison, not a dispatch-only ablation.

The runtime/question/oracle are frozen at
`5eede35c978c76ff9215443ed0a0d5980bfbdfe1`. Execution order is traditional →
Code Mode → direct. All request gpt-6.1-sol/high via Codex 0.161.0, with fresh
isolated profiles/private caches and the same task. Both atomic catalogs are
complete (22/4 tools); the traditional set contains every declared Kuna native
operation and session/views (16 tools). Each client actually has JavaScript
dispatch. This compares MCP workflows inside that common client surface.

All three complete answers pass agent review against the frozen oracle. They
identify both owners, the X27→X0 pointer/helper transfer, banner ADRP/ADD into
X6, four-byte field/CBZ successors, static versus live pointer knowledge,
cleanup/low return bits, Evidence/target identities, unknowns and close. The
traditional answer uses native C recovery plus machine addressing for the static
global; both atomic answers also read the selected loaded-image pointer bytes.
No native-only representation is required to pass.

Separate scripted checks verify all seven traditional, fifteen Code and fourteen
Direct cited sources against delivered responses/traces and target/engine
identities. Atomic retained source hashes/lengths agree; complete selected native
function documents are identical between the two atomic lanes. Selected native
argument/value/passing tuples and the PHI/input distinction match the delivered
graphs/call facets. The independent ELF/GNU oracle checks the machine facts.
Supplementary GNU checks corroborate the traditional answer's added logging
wrapper call at `0x5ae6c → 0x5abb0`, with X6 unchanged. Source/fidelity checks
are separate from agent review of the entire natural-language answers; neither
constitutes human readiness or global machine-equivalence verification.

| Whole completed task                                  | Traditional | Code Mode                     | Direct atomic   |
| ----------------------------------------------------- | ----------- | ----------------------------- | --------------- |
| Required answer                                       | pass        | pass                          | pass            |
| Cumulative input tokens                               | 681,613     | 388,365                       | 515,929         |
| Cached input, included above                          | 639,360     | 336,000                       | 436,224         |
| Uncached input                                        | 42,253      | 52,365                        | 79,705          |
| Output tokens                                         | 5,423       | 5,755                         | 6,529           |
| Reasoning, included in output                         | 1,324       | 1,137                         | 1,934           |
| Unique model responses                                | 23          | 13                            | 15              |
| Client executor / wait calls                          | 16 / 6      | 12 / 0                        | 14 / 0          |
| MCP attempts, including failures/discovery/open/close | 13          | 12                            | 31              |
| Rejected MCP attempts                                 | 2           | 0                             | 0               |
| Atomic fact reads                                     | n/a         | 25 inner reads                | 25 direct reads |
| Native function dossiers / snapshot requests          | 4 dossiers  | 3 requests, 2 unique captures | 2 captures      |
| Model wall seconds                                    | 345.676     | 151.264                       | 164.942         |
| Family wall seconds                                   | 346.217     | 151.834                       | 165.421         |
| Local family CPU seconds                              | 186.786767  | 41.152525                     | 43.116751       |
| Kernel family peak MiB                                | 973.1       | 695.7                         | 600.4           |

Both traditional rejections are instruction-interior addresses passed to exact
procedure lookup. The inventory was available, the model used it and completed;
this is not the earlier under-equipped baseline. All four traditional dossiers
report the same ready project-export key, so the observation does not establish
a broken project cache. Its extra logging-wrapper investigations and native
profile add work beyond the two selected atomic captures. All attempts remain
charged; failed/intermediate development checks are separate from model trials.

Code uses 24.7% less cumulative input and less wall/CPU time than Direct in
this pair, but more peak memory. Compared with traditional it uses 43.0% less
cumulative input and less wall/CPU/memory, but **23.9% more uncached input** and
more output. There are only two fewer model responses than Direct, despite
nineteen fewer MCP requests. Same fact-read counts do not mean identical native
work. This is one new architecture/version sample with uncontrolled OS/model
caches, host contention, service build and remote compute, not a stable Code
Mode advantage, a price claim or broad complex-software superiority.

Unique per-response usage sums match the task totals. All target, engine and
runtime fingerprints remain unchanged. All three profiles are removed; verified
payload-exit observations show OOM 0 and descendant cleanup. The same resource
bounds and kernel-memory interpretation as above apply.

Raw model records are `arm-warning-{traditional,codemode,direct}-v1/` with sibling
resource logs/configs; atomic traces and explicitly retained sources have matching
prefixes. Derived records are `arm-model-costs.json`, `arm-answer-checks.json`,
`arm-answer-review.json` and `arm-traditional-delivered-evidence.json`. Reviewed
answer SHA-256 values are:

- Traditional: `5312aa0757b35b8a28b8d1c60af652760e445b0463117eb41def1e2eeb5031eb`
- Code: `e331df37f53e58a85bea61f37b5e3b7c6a6848af78a0225383df0d9a481121a7`
- Direct: `792b613d25e9c5dfec4e4dd03c13d265f24937e0eafc817931bd5a563e496408`

## Remaining native identity/control-flow question

All answers detect the recovered caller's no-return treatment of the warning
call and use machine instructions for the requested conditional post-call path.
The recovered call facet omits the strict call. Complete recovered-graph coverage
therefore does not establish a complete machine graph or a correct no-return
inference. This is a concrete remaining backend/identity investigation.

Supplementary static observations identify a suspicious boundary: the warning
epilogue restores LR/SP and branches at `0x25858` to `0xbad0`. That address
starts with BTI, followed by ADRP at `0xbad4` and a slot load at `0xbad8` from
`0x10f390`. ELF `R_AARCH64_JUMP_SLOT` names that slot `free@GLIBC_2.17`.
The native inventory instead exposes `sub_bad0` with size bound 4 and `free`
at `0xbad4` with bound 20. GNU's synthetic PLT label at `0xbad0` says closedir,
which the actual slot relocation contradicts; it must not be used as symbol
identity. Whether the native BTI/veneer split causes the no-return propagation
still needs a producing-boundary investigation and regression proof. No such
fix or rerun is attributed to the frozen comparison above.

Raw receipts live under `.cache/atomic-codemode/` as `arm-*`: initial missing
xrefs, intermediate/final native test/build logs, SDK/source records, x86 fidelity
and equivalent-query costs, actual catalogs and traditional preflight. Binaries,
native projects and raw captures remain uncommitted.
