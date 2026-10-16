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
measurement and validation notes follow in the next checkpoint.
