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
have not run; this patch is not declared upstream-ready. SQLite, more complex
model tasks, paired warm runs and the revised actual model comparison remain
required work.

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
the actual `JA 0xe26d` / `JMP 0xd9c9` bytes. Targeted tests now total 33; the
representation fix still requires a fresh real-model task trial.
