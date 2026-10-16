# Native recovered IR experiment

Stock Kuna's diagnostic text omits CFG successors and does not encode operand or
phi edge identities. `kuna-native-ir.patch` is a read-only exploratory exporter
against [Kuna v1.833](https://github.com/Noelo-Lab/kuna/tree/fe01d6294eb0d1053ce343c8943646df88e143fc).
It is not an upstream release or an integrated REA capability. No upstream commit,
PR or merge is being made.

`decompile --json --atomic-facts` captures the live function that produced C.
The default path does not collect the facet. Graph records include ordered CFG
edges, native value identities, indexed operands, outputs and phi input bindings
to particular incoming edges. Duplicate instruction origins or predecessor blocks
do not collapse identities. Values are local to one snapshot. Constant offsets
remain hexadecimal u64 address-space offsets, with width and annotation status
separate; they are not arbitrary-width computed bitvectors.

`native-ir.mjs` owns validation, immutable indexes and selected reads.
`control-dependence.mjs` derives control dependence using immediate
postdominators of the reversed graph, with linear retained graph state and a
bounded work count. It treats zero-successor recovered blocks as exits and
considers finite paths only. Exit-unreachable blocks, indirect-branch operations,
missing definitions, runtime successors and memory alias limitations stay
explicit. This is not a proof of feasible runtime paths.

The shared API adds `values`, `blocks` and `relations(kind:"controllers")`.
Diagnostic SSA sessions report these missing capabilities explicitly. Native
definition/use edges include operand and phi bindings; diagnostic printed
occurrences retain their original, weaker semantics. CLI, SDK and both MCP
adapters use the same owner. Ordinary source summaries are compact; `evidence`
retains the exact command argv and separate display argv, complete output and
digest. Earlier trials substituted display paths in `arguments`; they must not
be retroactively claimed to have captured exact argv.

To reproduce, check out the pinned upstream revision in a disposable directory
and apply this patch with `git apply`. Reuse already compiled `.sla` files from
the corresponding stock release under the same relative `specs/` paths; do not
recompile specs or replace existing unrelated files. Build from the REA root:

```sh
env CARGO_INCREMENTAL=0 CARGO_PROFILE_RELEASE_DEBUG=0 \
  CARGO_PROFILE_RELEASE_OPT_LEVEL=1 CARGO_PROFILE_RELEASE_LTO=false \
  CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 \
  python3 experiments/analysis-efficiency/resource-run.py --observe-payload-exit -- \
  cargo build --manifest-path /absolute/kuna/decompiler/Cargo.toml \
  --locked --release -j1 -p kuna-cli --features embed-specs
```

Select that executable through `REA_KUNA_COMMAND` and explicitly pin its actual
SHA-256 through `REA_ATOMIC_NATIVE_IR_ENGINE_SHA256`. Native IR requires embedded
specs and rejects a caller-supplied `--sleighpath`; the provider creates a fresh
owned engine cache per lease. The executable digest therefore covers its embedded
assets, without reusing an unvalidated external spec cache. The current prototype
uses optimization level 1, not the stock release's assumed optimization profile;
comparisons must retain this difference or use the same engine in all lanes.

Native extraction bounds blocks/operations at 12,000, values at 36,000, input and
CFG edges at 50,000 and display text at 2 MiB, before the 8 MiB transport bound.
Capacity overflow makes this facet unavailable, preserving C and a reason. The
provider retains at most two 8 MiB native indexes (two 2 MiB diagnostic indexes)
and 64 MiB of complete source captures per lease. The outer observer still
enforces one CPU, 4 GiB hard memory and early termination at 3 GiB.

Real Linux zlib verification produced 3,860 operations, 5,898 values, 472 blocks,
779 CFG edges and 790 phi operations. Its 5,533,649-byte native JSON has no omitted
definitions or reported producer issues. C is byte-identical to the previously
captured stock 1.833 JSON (52,431 characters), and line mappings are identical.
The CLI composition independently discovers the string, owning function, store
and its two local controllers. Its observed cold session takes 9.191 seconds,
8.887 process-family CPU seconds and 198.9 MiB kernel memory peak, with verified
cleanup and zero OOM kills. This scripted lane is not a real-model cost result.

Targeted JS checks cover malformed/foreign identities, dangling relations, phi
order, exact hex offsets, immutable facts, loop/exit coverage, resource failure,
and all 64 four-node DAGs against an independent path-enumeration oracle.
Upstream `check-spec` passes. The full upstream corpus, stages and workspace gates
have not run; this patch is not declared upstream-ready. The model comparisons
and subsequent boundary findings below do not establish wider provider parity.

The value-origin model comparison exposed a representation boundary: optimized
recovered blocks can absorb a machine predecessor, so an IR edge is not an actual
branch instruction target. The experimental API now names operation locations
`origin_address`, their selector `origin_addresses`, and block locations
`origin_start`; printed CFG targets use `target_origin`. These replace the old
ambiguous fields without aliases. Historical captures retain their pinned old
contracts. Raw upstream JSON is preserved unchanged in Evidence.

The added `instructions` method batches selected machine-address windows, using
Kuna's existing [disassemble CLI](https://github.com/Noelo-Lab/kuna/blob/fe01d6294eb0d1053ce343c8943646df88e143fc/decompiler/crates/kuna-cli/src/disassemble.rs),
with exact bytes, decoded text, extent, coverage and per-window errors. Kuna
already has focused agent-oriented read surfaces; its port ancestry does not
establish which primitives are missing. No assembly decoding or branch-target
parser is duplicated in the MCP adapter.

Windows are capped at 4,096 decoded rows and 16 windows per call, sharing the
8 MiB capture and 64 MiB retained-source budgets. A real maximum-row CLI test
returns 4,096 rows in an 842,106-byte source, taking 1.227 family wall seconds,
1.042 CPU seconds and 112.0 MiB kernel memory peak. Both real stock and patched
MCP tests preserve good windows alongside an unmapped-address failure and report
the actual `JA 0xe26d` / `JMP 0xd9c9` bytes. The representation revision had 33
targeted tests; its subsequent real-model trial is recorded below.

That fresh trial now verifies the missing machine path correctly; see
[actual task costs](trials.md). The SQLite task then exposes a separate missing
primitive: name/alias lookup across distinct callable entries. `functions` now
reuses the production inventory parser, preserving every matching entry, import
stub ambiguity, original aliases, clipped extents and unknown runtime binding.
The inventory is read/validated once per lease, and query/field/page selection
returns only the requested view. Batch xref and instruction reads share one
partial-outcome owner, retaining good observations and source IDs on failures.

A real `sqlite3VdbeExec` capture at `0xea6d0` also exceeds the graph export's
operation capacity while producing 126,519 characters of valid C. The old adapter
incorrectly rejects the entire capture. The revised owner validates the function
envelope and input identity independently, then models graph availability as a
facet result. Code and its language remain available under the same handle;
graph counts stay unknown and graph reads return their reason and Evidence ID.
The real MCP regression reads 3,654 code lines after the graph failure and verifies
that `sqlite3Fts3ErrMsg` has distinct entries `0x268f0` and `0x5efc0`. Native graph
capacity remains a real limitation, not a resolved scalability claim.

`verify-cache.mjs` measures a real cold/warm pair within one open lease. Cold zlib
snapshot reading takes 6,934.4 ms / 6.928 family CPU seconds; warm reading takes
67.7 ms / 0.068 CPU seconds and preserves the exact snapshot/Evidence ID. The
cumulative kernel memory peak is 275.1 MiB for both phases; the warm number is an
upper bound on its isolated phase peak. This is an API-only measurement, with no
model token result or cross-session cache claim. Targeted tests now total 38,
including late cancellation retaining partial facts and their provenance.

A subsequent real boundary sweep found a different loss of usable facts:
`sqlite3Pragma` (`0xb90e0`) and `sqlite3Parser` (`0xb3d00`) stay below the row
limits but overflow the provider's 8 MiB stdout budget. Both public snapshots
fail, losing C as well as IR. A separate diagnostic capture with a stated 32 MiB
observer limit establishes the exact producer sizes; it is not relabeled as a
successful public-provider workflow. The old engine is preserved locally by its
`7d357e75…` digest for historical reproduction.

| Function        | Previous pretty JSON bytes | Revised source bytes | C characters | Revised graph                                   |
| --------------- | -------------------------: | -------------------: | -----------: | ----------------------------------------------- |
| `sqlite3Parser` |                  8,492,810 |            4,526,811 |       50,508 | All 5,164 operations retained                   |
| `sqlite3Pragma` |                 16,728,407 |              136,501 |       67,300 | Explicitly unavailable at encoded-byte capacity |

The structural fix is at the producing serialization boundary. Atomic output
uses the existing record producer and shared compact ASCII-safe writer.
`--atomic-output-bytes` takes an explicit encoded-document budget (default 8 MiB);
the provider passes the same bound it supervises. The writer checks each encoded
write before growing its bounded buffer, accounting for escaping and newline.
If necessary, the document drops only the graph and records an exact facet
failure. C, line mappings and metadata survive under the same Evidence. If even
the base document cannot fit, the command fails rather than clipping it or
repeating the analysis. Ordinary non-atomic JSON keeps its previous formatting.
Row limits alone never promise that the whole encoded graph fits.

The rebuilt local engine is SHA-256
`2290e8b13caabe30aab6832ab163d92925b2e652eebf7fc0cdbe65b889cb251b`
(same pinned source/release profile plus the revised patch). Real Code Mode MCP
verification succeeds for both functions. The preserved C and line mappings are
identical to the earlier full diagnostic captures; the Parser graph is also
deep-equal, and retained source hashes verify. Pragma's unknown graph counts and
failed graph reads retain the correct source ID. No limit was increased.

The first successful revised MCP check took 13.721 family wall seconds, 13.461
CPU seconds and 326.9 MiB kernel family peak, with verified cleanup and no OOM.
This is a two-function API regression, not a model-cost comparison or a claimed
analysis speedup. Native writer/escaping checks (14) and graph-only fallback (1)
pass in the release test binary; the shared JS tests (38), SDK ownership probe,
lint and patch apply/reverse checks pass. Full upstream corpus/stages/workspace
gates still have not run. The first MCP launch used a stale pre-format-build hash
and was correctly refused; the retained successful retry uses the digest above.

The `bytes` primitive reuses Kuna's existing `read --as data --json` protocol.
Unlike instruction decoding, it asks for an exact byte range. It disables the
global `listing` / `fast_funcdisc` passes for this data-only query; instructions
retain their existing profile. A native probe returns exactly equal JSON with
and without those flags. Its 484 / 290 ms timings share a workspace and run in
that order, so they do not establish an isolated speedup. Native/source ownership,
freshness, decoded-window admission and partial batches remain shared.

Real public MCP checks pass in native Code Mode, native direct and stock 1.833
Code Mode: a known 53-byte string, a 4-of-16-byte read at a mapped-image boundary,
an unmapped address, same-source cache reuse and the 64 KiB maximum. Both adapter
catalogs validate after SDK conversion. The byte parser rejects wrong subjects,
contradictory duplicated hex, invalid extents and rows, and preserves exact u64
addresses. Completeness follows examined byte coverage rather than the native
truncation flag. It never claims these loaded-image bytes are live memory or
proves an original-file mapping. Targeted JS tests now total 41.

## Structured call relations (wire version 2)

The next observed gap was input zero of CALL: a native `fspec` annotation is an
internal reference, not a code address. The read-only `atomic_calls.rs` exporter
now uses the existing `FuncCallSpecs` owner for recovered entry/name, model flags,
argument passing storage and stack offset. A single operation-to-spec index
avoids a linear lookup for every call. Input slots and SSA IDs remain separate
from passing locations. Finalized storage is admitted only at matching arity;
locked prototype storage is the alternative. Shifted inputs, placeholders,
missing specs, unavailable storage and unresolved indirect entries remain
explicit. There is no display-text parser or original-source ordinal claim.

`calls` provides ID/origin filtering, field projection and paging through the
shared SDK/CLI/MCP owner. Callee `values(is_input:true)` exposes retained input
values for exact storage candidate matching. Source schemas, unique call
ownership, call coverage, operand indexes/values and output identities are
validated before exposing an index; a bad or old-version graph preserves valid
C. Machine CALL instructions remain the independent check of a recovered edge.

Engine `64c6b3fe5737056fc29c10b0aad6c7cbd489ad7d17bd1726141b77bdcf5e15b7`
uses the same upstream revision, embedded specs and one-job build profile.
The rebuild took 317.090 family wall seconds, 315.808 CPU seconds and a 2,145.695
MiB kernel process-family memory peak (including charged file cache), OOM 0.
The previous compact exporter engine is preserved by its SHA-256 locally.

Real SQLite MCP verification passes both adapters, including a composed Code
Mode join: caller `0x65211 -> 0x64060`, argument passing storage
`register:0x38/8`, one matching callee input, and a bounded definition slice from
the context updates to that input. Formatter calls `0x5f031`/`0x5f062` point to
`0x2adc0`/`0x27e50`; their fspec offsets remain `0x10000`/`0x10001`.
All three functions' C, ordinary metadata/line mappings, blocks, operations,
values and existing coverage equal retained earlier captures. Those earlier
sources were pretty-printed: encoded-size changes are not a call-exporter
performance result. The structured call counts are 8, 33 and 2 respectively.

The Code Mode verifier took 7.872 family wall / 7.573 CPU seconds, 297.1 MiB;
the direct verifier took 7.771 / 7.499 seconds, 278.7 MiB. These differ in assertion
calls and warm file-cache state, so they are verification receipts, not a
controlled adapter speed comparison. Both verified cleanup and OOM 0. The
existing real zlib controller/phi/instruction verifier also passes with this
engine (10.992 wall / 10.795 CPU seconds, 285.7 MiB, cleanup verified, OOM 0).
`check-spec` passes in its default lenient mode; full upstream gates still have
not run. The independent cross-function question and acceptance criteria are in
[call-oracle.md](call-oracle.md), pinned before model evaluation.

The strengthened verifier additionally reads all five retained indirect calls in
this parser and checks their unknown targets. Machine bytes `ff5328` at
`0x644eb` independently describe a register-indirect CALL. The Code Mode rerun
passes (16.628 wall / 8.239 CPU seconds, 300.5 MiB); native test compilation was
also active on the same CPU, so its wall time is not an isolated performance
sample. The source checks pass 45 JS tests across both prototype directories and
two Python ledger tests; changed source lint and formatting pass.

A current coverage limit remains: call facts are part of the recovered IR
facet. A function that exceeds graph capacity also loses these call records,
even if a selected call-target view could fit. This is a reason to explore
independent fact facets; it must not be mistaken for proof of no calls or full
coverage on large functions. No full provider parity claim is made.

The current producer also passes fourteen native JSON-format tests. The initial
command compiled unrelated integration targets and a non-embedded CLI build,
which replaced Cargo's mutable `target/release/kuna`. Its 181.103 wall / 172.430
CPU seconds, 651.6 MiB peak and OOM 0 describe that broader compilation, not just
JSON test execution. Future focused commands should select `--bin kuna` and
`--features embed-specs`. The original embedded build restores from Cargo cache
and has the same `64c6b3f...` digest.

The first model launch after those tests correctly fails at `open_binary` with
`engine_profile_mismatch`; it produces no target Evidence and is not a completed
answer. Its rejected-trial costs are retained in `trials.md`. The producing
boundary is now fixed by preserving an independent executable copy in a directory
named by the full SHA-256, outside Cargo outputs. The model harness checks the
explicit experimental engine pin before copying credentials or launching a model,
and verifies the same bytes after the task. Changed/missing engines reject the
comparison while retaining costs. Other provider trials keep this field unknown.
Three regression tests cover missing/malformed pins, replacement and removal;
a real driver invocation with a wrong pin rejects before output/profile creation.

## Shallow outgoing references without decompilation

Kuna already supplies native `xrefs --from`, including exact-instruction and
owning-function queries. The shared `KunaReferenceFiles.ts` boundary now owns
both directions, validates direction-dependent peer fields and query ownership,
and preserves exact u64 endpoints and source-row occurrences. The old
incoming-facts-only parser is removed; both experimental consumers use the same
named query contract. Production incoming address-only queries keep their
existing projection and bounded cache semantics.

The experimental `references` method adds direction, explicit address/function
scope, native kind filtering and fields. Incoming function scope is rejected;
unknown outgoing function applicability, unattributed/excluded rows and unresolved
indirect/discovery/runtime coverage remain explicit. Native source cache keys
cover result-affecting query choices while scope, fields and pages reuse the same
source. `reference-reads.mjs` owns protocol selection/projection; the resource
owner and CLI/MCP adapters do not reinterpret native endpoint fields. Empty
field selection now requests the existing always-retained identities, rather
than being rejected without a format/resource reason.

Real outgoing CLI probes return 396 VM call-reference rows in 205,432 bytes,
versus one row/737 bytes for selected call site `0xf238b`. Four sequential probes
(VM function/instruction and wrapper function/instruction) take 6.772 family wall
/ 6.613 CPU seconds and 120.0 MiB peak. Each command takes about 1.6–1.7 seconds;
these are native metadata-query measurements with warm uncontrolled file caches,
not real-model speed/token results.

Independent GNU objdump decoding over the exported VM symbol (`0xea6d0`, size
`0x7e7e`) confirms all 396 `(origin,target)` pairs, 171 distinct exact targets,
and 16 calls to `0x296c0`. It also finds 21 indirect calls, outside these
known-target counts. In the wrapper, nine lifted machine call references compare
with eight retained IR calls: machine `0x6534b -> 0x29370` is an omitted
`__stack_chk_fail@plt` call. Its absence from optimized IR/C is not absence from
the executable. No native analysis or C behavior is changed to repair that
representation difference.

The real Code Mode MCP verifier passes paging, identity-only fields, scope-cache
reuse, exact sites, unknown applicability and local aggregation. It also captures
the VM anew: C is available, IR fails with `atomic operation capacity exceeded`,
and shallow references still work. This verifier takes 48.142 family wall /
47.803 CPU seconds, 610.1 MiB peak; VM decompilation/source capture itself takes
35.945 seconds. These are different requested capabilities, not an equivalent
workflow speedup claim. The direct verifier passes the same reference contract
without that VM decompilation (12.001 / 11.759 seconds, 256.8 MiB). Both verify
cleanup and OOM 0. An earlier direct-verifier attempt incorrectly expected target
metadata on an SDK input-validation error; the corrected verifier respects the
SDK rejection boundary. That failed assertion receipt is retained.

The exact focused boundary suites pass 38 tests, with a fresh strict production
build; changed-test strict typechecking and 45 experimental JS tests also pass.
Full lint/module boundaries and changed-file formatting pass. Repository lint
warnings remain outside this change. The focused build/test scope peaks at
3,030.6 MiB, below the 3 GiB early-stop line, with OOM 0. Two full `check:fast`
attempts (including serial execution and Go runtime memory controls) reach that
early-stop budget and are terminated before OOM; they are not reported as passed.
The changed-test typecheck uses 70.1 MiB and standalone full lint 919.0 MiB.
Full-repository typechecking and full upstream Kuna gates remain unverified.
The [next question/oracle](reference-oracle.md) are committed before model trials.

## Independent call and boundary-value facets

Graph schema 3 removes embedded call records. An independent `atomic_calls`
version-1 facet now carries every retained block-member CALL/CALLIND, target-input
SSA identity, origin/block/opcode/dead status, call specs and boundary values.
`atomic_values.rs` owns common native value interpretation. The call scan walks
native block membership without allocating an operation vector for every block;
its own call/input/value/text budgets do not depend on the 12,000-op graph cap.
The default native path still does not collect either facet and C analysis phases
are unchanged. All captures occur after the same C rendering.

The bounded serializer retains fitting facets independently and preserves ordinary
C/metadata. It tries the full document, graph without calls, calls without graph,
then the base record with both reasons. This keeps existing graph availability
when both facets individually fit but their combination does not. Facet contents
are moved for these bounded alternatives rather than cloned; no reanalysis or
clipped collection labeled complete is introduced.

The JS owner validates each facet independently with shared ID/value contracts
and row-wise admission. When both parse, call identities, origins, operands,
outputs and boundary values must agree with the graph owner. Bad call facts do
not erase a valid graph; a bad/oversized graph does not erase valid calls. Code
survives either failure. `values` uses the complete retained graph when present,
otherwise the explicitly scoped call-boundary set; absent IDs in that set do not
prove absence from the native function. Defining operation identities may remain
unreadable, and source signatures, source parameter ordinals, aliases and runtime
binding stay unknown. `is_dead` is always retained on call rows, like an
instruction decode status. CLI, SDK and both MCP adapters share these views.

The new preserved engine is
`e7d3f0cc8d8aae814bd6a2625a567d6aaad96c3fe2405a4f08dc8e065b851588`.
Its full rebuild took 315.815 family wall / 315.305 CPU seconds, 2,119.4 MiB
kernel process-family peak. Four focused native atomic-JSON tests pass, including
both overflow directions, both-overflow C preservation and graph preference when
the combined document is too large (95.981 / 95.631 seconds including test-target
compilation, 626.8 MiB). The final CLI rebuild after tests is 26.203 / 25.952
seconds, 492.7 MiB. It is copied outside Cargo outputs and pinned by full digest.
All these runs verify cleanup and OOM 0; full upstream gates remain unexecuted.

Real public MCP verification keeps VM C available, reports graph operation
capacity failure, and now exposes 416 calls plus 1,294 boundary values. The call
scan examines 21,349 operations over 1,229 blocks. It preserves 395 direct known
targets and 21 unresolved indirect calls; all direct pairs match independent
machine pairs except the omitted `0xf2493 -> 0x29370` stack-check call. All 21
indirect origin addresses also match independent disassembly. Selected
`0xf115c`/`0xf238b` calls target `0x296c0`; their fspec inputs remain separate
annotation values. Repeated snapshots reuse the same handle and source, and an
explicit unavailable graph read fails without hiding these retained facts.

The VM source grows from 273,703 to 793,791 bytes to retain this new data; the
wrapper grows from 202,206 to 208,083 bytes. Their ordinary records, including C,
variables and line mappings, are identical to the prior capture. The wrapper's
blocks/operations/values/coverage also remain identical. These are fidelity and
source-volume observations, not model-token or speed results.

The real reference/VM verifier passes in 49.471 wall / 49.130 CPU seconds,
615.8 MiB. The existing cross-function call/input verifier passes in 8.377 /
8.094 seconds, 292.9 MiB; encoded Pragma/parser C/graph checks pass in 12.403 /
12.195 seconds, 335.0 MiB. All verify cleanup and OOM 0. The updated contract
suite passes 47 JS tests, including independent facet failure, cross-facet
conflicts, input-zero identity and boundary-only value reads. `check-spec` passes
in default lenient mode, lint and changed-file formatting pass, and the patch
applies forward to the pinned upstream revision and reverses from the clone.
Full repository typechecking retains its previously recorded resource limitation.
The [boundary question/oracle](boundary-oracle.md) are fixed before model runs.

The subsequent real-model pair passes that oracle in both calling modes. Each
uses one VM analysis and the same retained function record; neither invents a
complete graph from the available call-boundary values. Source digests, target
and preserved-engine pins, selected machine checks, cleanup and OOM-zero receipts
verify. See [whole-task costs](trials.md): the capability survives real model use,
but a single mixed-context-cost pair does not establish general efficiency.

## Compact counts from the validated call owner

The following API-only change keeps the preserved engine and native source
format unchanged. Snapshot call metadata includes counts by recovered opcode
and known/unknown native target, plus call coverage. The owner computes these
once after validation, before the shared CLI/SDK/MCP views. Counts include dead
rows and do not infer target knowledge from CALL versus CALLIND. Available empty
sets have zeros; unavailable sets have no counts. Selected call reads do not
change this whole-facet summary or require a new analysis.

The focused suite passes 49 tests, including known indirect/unknown direct
targets, dead rows, immutable summaries and empty/unavailable distinction.
Both real MCP adapters verify the wrapper's eight direct calls and parser's
28 direct/five unresolved indirect calls while preserving the existing
cross-function checks and validating advertised schemas after SDK conversion.
Code Mode verification takes 29.263 family wall / 21.548 CPU seconds, 283.9 MiB
kernel family peak; direct takes 32.893 / 22.781 seconds, 280.6 MiB. Both have
verified cleanup and OOM 0. These are validation runs, not a controlled speed
comparison with previous verifier timings. An owner replay of the prior
digest-verified VM source yields the expected 395/21 distribution; it is not
relabeled as a fresh provider or model run. The identical boundary question and
oracle are retained for subsequent real-model comparison.

That comparison now passes in both modes. Both consume the compact counts and
read just the two selected calls, reusing one VM analysis. All native VM function
records match the preceding pair and all retained sources/digests verify. Direct
has lower observed task costs than Code Mode in this sample; the before/after
results remain mixed. [trials.md](trials.md) records cumulative/cached/uncached
tokens, model responses, elapsed time, CPU and process-family memory, including
the slower Code Mode result. No native engine or analysis-speed improvement is
claimed for this shared owner metadata change.

## Tagged cleanup ownership regression

Source inspection finds that the experimental owner awaits but ignores
`KunaTargetCommands.close()`'s tagged `Result`. On error it would clear its state
and let `AtomicSession` drop the owner while claiming a successful close. The
SDK verifier reproduces this before the fix: an injected `ProviderCleanupError`
does not reject close. Its fallback cleanup still removes the real owned state;
the original failing result is retained as `cleanup-before.json`.

The owning boundary now uses the existing `requireResult` projection before
closing its cache root or clearing state. The existing session queue therefore
retains the owner on failure. Both close and target replacement report
`cleanup_incomplete`, preserve the staged file identity and original lease, and
succeed on retry; the file is then absent. MCP's open/close error adapter now
preserves context and resource details rather than dropping that evidence. The
CLI already propagates the thrown error as a failed command. No alternate
cleanup owner or downstream retry workaround is added.

`verify-cleanup.mjs` runs against real provider reads and resources, injecting
one tagged failure per close/replacement case. `verify-cleanup-mcp.mjs` injects
one explicit test-only failure in an isolated server, then verifies public
Code Mode and direct error metadata and successful retry. These are controlled
boundary failures, not a claim that the real engine failed to stop. The SDK
check takes 1.730 family wall / 1.567 CPU seconds, 130.4 MiB kernel peak; MCP Code
Mode takes 1.931 / 1.639 seconds, 200.0 MiB; direct takes 1.730 / 1.489 seconds,
192.8 MiB. All verify process cleanup and OOM 0. The original failing verifier
takes 1.226 / 0.985 seconds, 122.7 MiB and also verifies fallback cleanup/OOM 0.
The 49 focused JS tests, lint and formatting pass. This lifecycle-only change
follows the recorded model pairs; no new model token or speed claim is made.

## Callable bounded definition projection

The next native exporter retains a version-1 `atomic_projection` independently
of graph version 3 and call version 1. One checked native membership scan owns
call roots and an optional index of at most 65,536 operation keys; exceeding the
index budget disables the projection without discarding calls. Full-graph row
capacity is checked before rendering its rows. Full and selected facts share
one operation/value normalizer, including exact identities, indexed operands,
outputs, phi predecessor edges, flags and display. Default non-atomic analysis
and C generation are unchanged.

All recovered CALL/CALLIND operations are retained as projection roots, followed
by backward operand definitions in breadth-first order. The projection bounds
4,096 operations, 12,288 values, 16,384 inputs and 2 MiB text. Too many roots or
another admission failure makes the facet explicitly unavailable. Omitted
definitions retain exact IDs and operation-budget/outside-membership reasons.
A fitting full graph omits its redundant projection; an encoded-overflow graph
restores the fitting projection. Facets are moved through bounded alternatives,
and a valid C/call record survives projection failure. There is no repeated
decompilation or clipped collection labeled complete.

The JS boundary shares operand/value validation and query indexes between full
and sparse views. It checks root reachability, exact frontier membership,
call/value agreement and phi metadata without inventing a CFG. In the absence
of a full graph, conflicting projection facts do not erase independently valid
calls. `snapshot.facets.operations` and `facets.values` expose their scopes;
selected definitions/uses and slices work over the retained set. Uses remain
selected-only, CFG/controller queries retain their graph error and Evidence ID,
and slice missing definitions keep their native reasons. A missing projection
preserves the original graph failure instead of hiding it behind a generic
not-captured error. All adapters use this owner.

Coverage returns counts instead of global omitted-ID inventories, at most eight
160-character issue summaries, full issue counts and omission metadata. Complete
native coverage/frontier details remain in source Evidence. Native operation
rows retain `is_dead` with their identities; constant summaries add `value_id`
and `input_index`, preserving exact offset/width semantics. No original-signature,
arbitrary-width computation, memory-alias or runtime proof is introduced.

Preserved engine SHA-256:
`a0685486518e09d3c65f756325a7e9fed8df123a2a988aca2972a72335ce8edc`.
The same one-job/embedded-spec build takes 309.805 family wall / 309.523 CPU
seconds, 2,099.5 MiB kernel family peak. Six focused native JSON tests pass,
including projection restoration and independent overflow (99.752 / 98.662
seconds with test compilation, 626.9 MiB). The final CLI build reuses artifacts
(0.320 / 0.146 seconds, 28.8 MiB), leaving the preserved digest unchanged.

Real SQLite VM public reads expose 4,096 operations, 7,469 values and 326
unexpanded definitions, while the complete graph remains unavailable. Source is
4,008,032 bytes, inside the unchanged 8 MiB public budget. Every selected operation
and value equals the earlier 17.8 MB diagnostic capture; ordinary C/metadata and
the complete call facet also equal it. An independent BFS over that retained
full graph produces exactly the same operation order and frontier. The extended
`measure-native-projection.py --verify-capture` reproduces these comparisons.
This is producer-fidelity evidence, not independent machine/runtime equivalence.

Both public MCP adapters read the selected PHI definitions and slices from one
VM source. Code Mode verifies unavailable controllers preserve the source ID.
The corrected Code Mode verifier takes 52.706 wall / 47.550 CPU seconds,
597.4 MiB peak; direct takes 39.696 / 39.418 seconds, 592.5 MiB. The first
Code Mode verifier incorrectly expected INDIRECT definitions; independent source
inspection shows MULTIEQUAL. Its 37.070 / 36.781 seconds, 593.3 MiB failed
assertion is retained, then the verifier is corrected without changing native
facts. These scripted runs are validation costs, not an adapter speed comparison.

Small-function cross-call checks pass (8.476 / 8.204 seconds, 293.6 MiB); all three
complete function records equal the prior exporter. Encoded Pragma/Parser checks
pass (13.712 / 13.507 seconds, 361.5 MiB): Pragma retains 3,627 projected operations
after graph encoding overflow, while Parser keeps its full 5,164-operation graph
without a duplicate projection. Zlib control/phi regression passes (10.893 /
10.700 seconds, 286.3 MiB). Real CLI reads verify both selected PHIs and repeated
snapshot/source identity (37.367 / 37.174 seconds, 527.1 MiB).

The real VM MCP cache benchmark observes cold snapshot wall 36,448.8 ms / family
CPU 36.425 seconds, then warm 40.2 ms / 0.041 seconds with the identical handle
and source. Cumulative family peak is 590.1 MiB, an upper bound on isolated warm
phase memory. Its complete run is 37.667 / 37.492 seconds. This is same-lease
capture reuse, not cross-session persistence or a model-token result; OS caches
remain uncontrolled. All resource runs above verify cleanup and OOM 0.

The focused JS suite passes 53 tests; lint/format, default lenient `check-spec`,
Python compilation and patch forward/reverse checks pass. Full upstream corpus,
stages and workspace gates remain unexecuted; the patch is not upstream-ready.
No whole-repository typecheck pass is claimed beyond the previously recorded
resource limitation. The [PHI-format task/oracle](projection-oracle.md) are fixed
before real-model launches. No model benefit is assumed from these smaller facts.
