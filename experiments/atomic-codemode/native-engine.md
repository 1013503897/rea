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

| Function | Previous pretty JSON bytes | Revised source bytes | C characters | Revised graph |
| --- | ---: | ---: | ---: | --- |
| `sqlite3Parser` | 8,492,810 | 4,526,811 | 50,508 | All 5,164 operations retained |
| `sqlite3Pragma` | 16,728,407 | 136,501 | 67,300 | Explicitly unavailable at encoded-byte capacity |

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
