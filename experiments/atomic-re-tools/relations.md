# Control-flow and definition/use experiment

This continues the first-round experiment on the same REA source baseline and
Kuna 1.833. It is an exploratory native-boundary decoder, not a production
provider capability or a new MCP catalog. No PR or merge is intended.

The analyst questions are which local conditions lead to zlib's
`incorrect header check` assignment and SQLite's
`malformed MATCH expression: [%s]` error-formatting call. Runtime reachability,
memory aliasing, phi predecessor bindings and complete entry-state conditions
remain unknown. These are not controlled agent trials.

`capture-function.mjs` records the existing public MCP function dossier. It
preserves transport-budget failures and follows retained Evidence for a value-flow
summary, then exports the complete local Evidence bundle before closing.
`capture-kuna-structure.mjs` uses REA's existing target/process owners to capture
the native `--raw`, `--regions` or disassembly output. All target inspection is
static. The engine and artifact digests, command arguments, raw digest and cleanup
proof are retained locally.

`kuna-ssa.mjs` owns the decoder for the inspected 1.833 SSA diagnostic format.
It indexes explicit definition annotations, literal values, block membership and
printed branch destinations once. Immutable rows carry native source lines;
operation and block IDs are local to the content-digested snapshot. A block's
printed stop is an instruction address, not an exclusive extent. Blocks can share
start addresses. Unknown lines, omitted outgoing relationships, missing definitions
and traversal boundaries remain explicit. Printed operand occurrences do not
claim p-code input indexes or phi-to-predecessor bindings.

`query-ssa.mjs` composes literal equality, direct uses, incoming explicit edges
and bounded backward definitions. It validates the retained capture against its
digest and the current artifact before indexing. It retains complete native
evidence; its local cache lives for one process. Default phi/load boundaries avoid
expanding the whole program state. Selection limits report omissions.

Use the pinned Node from `.nvmrc`, an existing build and caller-supplied Kuna:

```sh
node --test experiments/atomic-re-tools/kuna-ssa.test.mjs
python3 experiments/analysis-efficiency/resource-run.py --observe-payload-exit -- \
  node experiments/atomic-re-tools/capture-kuna-structure.mjs \
  /usr/lib/x86_64-linux-gnu/libz.so.1 0xc1e0 raw .cache/atomic-re-tools/relations-zlib
python3 experiments/analysis-efficiency/resource-run.py --observe-payload-exit -- \
  node experiments/atomic-re-tools/query-ssa.mjs .cache/atomic-re-tools/relations-zlib \
  0x18fc4 .cache/atomic-re-tools/relations-zlib-query.json
```

The addresses above apply only to the exact zlib artifact in [results](results.md).
Do not reuse them across provider load spaces or binary versions. Complete
measurement and validation notes follow below.

## Observed results

The same artifact and engine digests as [round one](results.md) apply. This is
the existing experiment, not a newly rebased feature branch: newer REA main
`42fc6c53ae188978deb3bedfe88287b6b316ba22` was fetched for inspection, but these
runs retain baseline `5b16f2431062eea6ffd245a9e05512790007cb13` and Kuna 1.833.
The source decoder was checked against Kuna's pinned
[SSA renderer](https://github.com/Noelo-Lab/kuna/blob/fe01d6294eb0d1053ce343c8943646df88e143fc/decompiler/crates/kuna-decomp/src/substrate/funcdata_printraw.rs).
No newer Kuna version was tested.

1. **SSA value origins repair all three failed zlib mappings.** The original
   string xrefs are LEAs whose addresses do not appear in printer mappings.
   Literal equality in optimized SSA finds a pointer-valued operation; its
   explicit def-use points to a STORE at a different instruction origin. Those
   origins do appear in the retained JSON line mappings:

   | String address | Original LEA | STORE origin | Exact emitted line |
   | -------------- | ------------ | ------------ | -----------------: |
   | `0x18fc4`      | `0xded7`     | `0xdee6`     |                164 |
   | `0x19003`      | `0xdc6a`     | `0xdc74`     |                551 |
   | `0x19018`      | `0xcd05`     | `0xcd0f`     |                653 |

   The independently captured raw-mode C and JSON-mode C are byte-equal after
   removing outer whitespace. The verifier checks both retained source digests,
   artifact and engine equality before joining instruction origins. This is
   corroboration between two captures, not proof of a shared internal IR revision.
   A production interface should export these relationships together.

2. **Control and def-use answer a bounded local question.** For the header error,
   the result contains 21 operations: the literal origin, STORE and 19 branch
   dependencies. Two explicit incoming edges enter block 446. They correspond
   to a missing low wrap bit and a failed divisibility check on the constructed
   header value. The branch definitions stop at a memory load and a phi node.
   Original machine instructions independently show `test $1` / `je` and the
   reciprocal-division sequence / `jne` into the error block. The verifier
   exhaustively checks all 65,536 ordinary 16-bit header values against both
   the captured arithmetic sequence and modulo 31. No target code is executed.
   This agrees with [zlib 1.2.13 source](https://github.com/madler/zlib/blob/v1.2.13/inflate.c#L633)
   and [RFC 1950](https://www.rfc-editor.org/rfc/rfc1950.html#section-2.2).
   It does not establish all entry-state preconditions or primed bit-buffer states.

3. **The same composition finds a SQLite call guard.** For the first malformed
   MATCH string at `0x11dcd8`, five selected operations connect the literal to
   `sqlite3Fts3ErrMsg` and the observed condition `EBX == 1`. The original bytes
   have `cmp $1,%ebx` and `je` to the formatting path; the corresponding
   [3.40.1 source](https://github.com/sqlite/sqlite/blob/version-3.40.1/ext/fts3/fts3_expr.c#L1057)
   uses `rc == SQLITE_ERROR`, whose [code is 1](https://www.sqlite.org/rescode.html#error).
   The slice stops at the return-code phi: it does not explain why a particular
   input caused the parser error. Source-version agreement is corroboration,
   not proof of an exact Debian source/build match.

4. **Addresses do not identify IR blocks.** SQLite blocks 20 and 22 both start at
   `0x6523e`, yet have distinct identities and paths. Several operations also
   share instruction origins. Do not use a block's printed address span as its
   membership set, or pair phi inputs with CFG predecessors by printed order.

5. **Retained paging cannot recover producer omissions.** Ghidra `inflate` by
   name is ambiguous between PLT and body. Its exact body is `0x10c1e0`, in a
   different load space from Kuna's `0xc1e0`. The complete MCP dossier exceeded
   the 10 MiB transport budget. The server correctly retained Evidence and
   supplied continuation arguments; summary reads and local bundle export worked.
   However, high p-code was already truncated to 3,000 operations, with 239 known
   omitted edges and at least one omitted operation. The late error literal is
   outside that prefix. Its absence remains **unknown**. Raising the response
   limit or paging the retained prefix would not repair this missing coverage.

Kuna's raw dump contains 3,860 operations / 472 blocks for `inflate`, and
253 operations / 23 blocks for the SQLite function. All printed definition IDs
resolved in these captures. Nevertheless, 63 / 1 blocks respectively have
unrepresented outgoing relationships. In particular, the diagnostic format does
not enumerate switch successors or every layout fallthrough. Incoming edges are
local observations, not a complete control-dependence or feasible-path proof.
`--regions` exposes structuring output; it did not provide the missing typed CFG.

## Cost and limits of the comparison

The estimates below use tiktoken 0.14.0 / `o200k_base`, not bytes-to-token ratios.
Full C is native text; the selected answer is JSON including source identity,
raw-Evidence access, facts and unknown coverage. No hypothetical MCP wrapper is
counted. These are **representation costs**, not equivalent completed agent tasks.

| Target / question  | Full C tokens | Full raw C + SSA tokens | Selected answer tokens |
| ------------------ | ------------: | ----------------------: | ---------------------: |
| zlib header error  |        17,726 |                 254,265 |                  3,270 |
| SQLite MATCH error |           931 |                  14,928 |                  1,283 |

The three zlib answers together cost 5,485 tokens with one shared source envelope.
The SQLite counterexample matters: a small function is cheaper as complete C than
as this structured slice. A successful atomic API does not force tiny getters or
graph output for every question. A C window around zlib line 164, on the other
hand, still misses the earlier guard at lines 122–124; locating a line alone did
not complete the local explanation.

| Stage                                                      | Elapsed s | Family CPU s | Peak family MiB |
| ---------------------------------------------------------- | --------: | -----------: | --------------: |
| zlib native raw, first capture                             |     6.965 |        6.608 |           208.1 |
| zlib native raw, fresh repeat                              |    18.749 |       13.462 |           195.9 |
| SQLite native raw                                          |     2.738 |        2.557 |           172.5 |
| zlib validation, index and two projections                 |     0.423 |        0.227 |            43.7 |
| SQLite validation, index and two projections               |     0.322 |        0.095 |            24.9 |
| Ghidra exact selection, retained summary / bundle workflow |    49.170 |       48.536 |         1,466.6 |

The fresh zlib captures have identical raw digests, but different elapsed/CPU
costs; the cause is unisolated. These samples establish neither native-analysis
acceleration nor a cross-provider speed ranking. OS caches were not flushed.
The Ghidra row includes first/warm requests and lifecycle, and is not equivalent
to the one-command native rows. Its analyst question remained unfinished.

Within the final projection runs, parse/index took 130.20 ms / 7.96 ms for
zlib / SQLite. First query plus serialization took 1.10 ms / 0.64 ms; repeat
queries on the same immutable index took 0.29 ms / 0.09 ms. Native analysis did
not run during either projection. This is a useful reuse mechanism, not a claim
that the original native decompilation becomes that fast.

All resource observations use the existing one-CPU, 4 GiB hard limit, 3 GiB early
stop and 192-task owner. Peak memory is the kernel cgroup `memory.peak` for the
whole process family, **including charged file cache**, not RSS. Every captured
run had verified payload-exit cleanup and zero OOM kills. The complete 12-run
ledger includes the ambiguous-name failure, the transport failure, the region
probe, superseded projections and automated verification: 178.051 s wall and
168.094 s family CPU in total. Manual investigation, old discovery/xrefs, objdump,
tokenization and development checks are outside that ledger.

The actual Ghidra retained workflow used the existing complete input-only catalog:
206,954 estimated catalog tokens plus 39,620 captured request/response tokens,
including failures, lifecycle and export. Exported bundle contents stayed local.
These costs do not count as a successful solution or as comparable Kuna savings.
No model reasoning tokens, answer-quality score, controlled agent A/B trial or
end-to-end agent latency was measured.

## What to explore next

The useful candidate is a shared analysis snapshot with typed facts and relations,
then bounded question-specific projections. Stable identity must include artifact,
load space, profile and snapshot; value definitions and block membership need
native identities in addition to instruction origins. Complete control dependence
requires a CFG with coverage; alias effects and phi predecessor bindings need
explicit producer support.

The nearest existing surfaces are `trace_native_values` for analysis and native
facets of `inspect_analysis_view` for retained reads. Retained views should remain
read-only: new analysis belongs to the analysis owner. Seeded selection must happen
before Ghidra's producer limit. Kuna should ideally export a structured IR/CFG
subset from the native owner instead of making this diagnostic-text decoder a
production protocol. Do not add a separate MCP tool for each getter or a custom
query language on the basis of these two functions.

Complex-software superiority is still unproven. The next discriminating question
is why an input reaches a selected error: that needs phi predecessor bindings and
control dependencies beyond these local slices, with a completed-task comparison
against the ordinary C workflow. Keep the small-SQLite counterexample in that
evaluation rather than optimizing only the large-function case.

## Verification and retained evidence

Six distinct SSA module tests plus the existing nine fact/mapping tests passed.
Real static captures, exact mapping replay for three errors, bounded SQLite
composition, 65,536 arithmetic cases, original instruction checks and Ghidra
retained-Evidence recovery passed. The Ghidra late-literal query did not have
sufficient producer coverage. Formatter, targeted lint, syntax and whitespace
checks ran; no production runtime source was changed in this round.

Locally retained evidence is under `.cache/atomic-re-tools/`, including
`relations-*.{report.json,log}`, `relations-*-raw*.native.txt`, the exported Ghidra
bundle, `relations-*-query-v2.json`, `relations-verification-v2.json` and
`relations-summary-v2.json`. Raw captures are not committed. Their SHA-256 values:

- zlib raw: `b1d6bc61755041d2934e4ab173aca4e5fdf40f5bda01ca404458a163b129681b`.
- SQLite raw: `8a945a1549b855802958bd4d33f37b9aaf00781aa57059fe25cb740244a1cdde`.
- zlib JSON body/mappings: `21631d31b4b93aa75c200be71a71ffe9f4b209982a9c329a2120d9f7c7509ea3`.

After producing captures with the prefixes used in the scripts, replay and count:

```sh
node experiments/atomic-re-tools/verify-relations.mjs \
  .cache/atomic-re-tools .cache/atomic-re-tools/relations-verification-v2.json
python experiments/atomic-re-tools/summarize-relations.py \
  .cache/atomic-re-tools .cache/atomic-re-tools/relations-summary-v2.json
```

The second command requires tiktoken. The checked-in verifier intentionally binds
to these exact artifacts and oracle addresses; it is not a generic correctness
test for arbitrary zlib/SQLite versions. Capture Ghidra with
`capture-function.mjs ghidra <zlib-path> 0x10c1e0 <prefix>`, and SQLite with
`capture-kuna-structure.mjs <sqlite-path> 0x65180 raw <prefix>`. Caller-supplied
engine paths and the existing resource wrapper are required as in round one.
Capture prefixes and output paths must be fresh; exclusive writes preserve any
existing evidence or caller-owned file.
