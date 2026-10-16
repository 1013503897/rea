# Bounded full recovered graphs

This implements the preceding native encoding probe as an opt-in experiment,
not stock Kuna support, an integrated release or provider parity.

## Format and owners

Logical graph schema 3 stays unchanged. A fitting ordinary record keeps its
existing representation. Before dropping facts, the writer can encode only the
graph in a schema-4 `{encoding:"gzip-base64",raw_bytes,data}` envelope. Ordinary
C/metadata and independent calls keep their fields. Existing graph/call/
projection/code fallback and explicit failure still apply if encodings do not
fit; no graph is clipped as complete.

Raw serialization stops at 32 MiB. Envelope overhead and base64 expansion are
accounted for before allocation; gzip output and encoded alternatives share the
unchanged caller budget of 8 MiB. Alternatives move ownership instead of cloning
graphs. Construction separately admits 32,000 operations, 36,000 values, 100,000
inputs, 12,000 blocks, 50,000 CFG edges and 4 MiB display/type text. Calls and
projections keep their earlier limits.

Each collector now owns one `TextBudget` for combined display/type charges. The
initial larger graph exposed a hidden second 2 MiB limit in value collection;
the first real VM probe rejected it with `atomic text capacity exceeded` while
preserving calls/C/projection. Passing the collector-owned budget through value
extraction removes this competing policy. Final graph text is 2,345,629 bytes.

`native-graph-encoding.mjs` owns envelope admission, canonical base64, gzip
integrity, exact lengths and fatal UTF-8 decoding. Inflation uses Node's
[`maxOutputLength`](https://github.com/nodejs/node/blob/main/doc/api/zlib.md#class-options)
with an admitted 32 MiB maximum. Logical schema/row/relationship/text admission
and existing native identity/CFG/phi checks then operate on the same graph.
Nested encodings fail logical admission; bad graphs preserve independent calls/C.

`evidence` defaults to the exact source wire record and original hash.
`component:"recovered_ir"` pages decoded graph source with a separate view hash
and byte count. Well-framed malformed logical facts remain inspectable without
being accepted as facts. `NativeEvidenceReads` owns one decoded view up to 32 MiB
per lease; the source owner revalidates bytes on every read. Content identity
keys the view; successful close clears it. All adapters share these owners.

## Real verification

These graph-only engine/patch measurements use commit `e2205313a` and its
version of `kuna-native-ir.patch`. The subsequent [switch extension](switch-study.md)
has its own pinned engine/patch and retains the same logical graph fields.

Kuna upstream: `fe01d6294eb0d1053ce343c8943646df88e143fc`.
Final preserved engine:
`677b9795d49a65e459054ecbd3c0df37d603b541d72df9f74b46778947ed3936`.
Patch SHA-256:
`9f5754a15bd971326d14085f4c515348735d140be3bf36a371e7cf336fc291f3`.
Binaries are copied outside mutable Cargo outputs, not hardlinked or committed.

On the pinned Debian SQLite target, both actual MCP adapters under Node 24.18.0
verify 21,349 operations, 35,755 values, 1,229 blocks and zero omitted definitions.
The complete graph deeply equals the earlier diagnostic golden, and ordinary
C/metadata plus all 416 recovered calls are unchanged. Selected old projection
frontiers now resolve, selected CFG/PHI reads work, both complete Evidence views
verify and repeated snapshots reuse one source. This establishes producer
fidelity, not independent machine/IR equivalence or runtime feasibility.

The actual wire document is **3,788,881 bytes**; decoded graph is **17,008,223
bytes**. The public byte budget remains 8,388,608. Raw receipts/source copies are
`full-graph-codec-*` under `.cache/atomic-codemode/`.

| Executed scope                           | Family wall seconds | CPU seconds | Kernel peak MiB |
| ---------------------------------------- | ------------------: | ----------: | --------------: |
| Initial build                            |             441.295 |     391.223 |         2,194.8 |
| Focused native tests, including compile  |              98.589 |      98.034 |           632.9 |
| Final budget-version native tests        |             176.333 |     175.748 |           644.1 |
| Formatted cached rebuild                 |              26.999 |      26.749 |           499.3 |
| Collector-budget rebuild                 |             361.041 |     342.220 |         2,192.9 |
| First probe: hidden text-cap failure     |              39.279 |      39.010 |           650.9 |
| Exploratory success under system Node 20 |              44.858 |      44.480 |           576.6 |
| Final Code Mode MCP, pinned Node 24      |              42.422 |      42.111 |           651.0 |
| Final direct MCP, pinned Node 24         |              41.496 |      41.252 |           644.2 |
| CLI: incorrect unique-name assumption    |               1.229 |       1.037 |           132.5 |
| CLI: corrected string/xref composition   |              43.512 |      43.217 |           584.2 |
| Full-graph cache benchmark               |              41.912 |      39.955 |           588.4 |
| Both catalogs/reference schemas          |               3.644 |       1.716 |           142.7 |
| Three small functions / call composition |               8.579 |       8.358 |           300.4 |
| Legacy engine / current reader           |              39.813 |      39.425 |           642.5 |

All resource runs use one CPU, 4 GiB hard / 3 GiB early-stop bounds, verified
cleanup and OOM 0. Kernel peak includes charged file cache, not RSS. The system
Node probe is outside pinned-toolchain validation; the verifier now rejects a
wrong Node before native analysis. The first failed probe used preserved
pre-fix `fb717dde...`. Native focused tests pass ten cases; shared JS passes 65.
Changed JS lint/format, lenient native `check-spec`, applied-source whitespace
and patch forward/reverse checks pass. Patch-context spaces are format markers.
The three small-function records retain their prior ordinary representations;
the current reader also accepts the old engine's explicit full-graph refusal,
independent calls and 4,096-operation projection through real MCP reads.
The final native test rerun also passes the same ten selected cases after the
collector-budget change. Other CLI integration tests were compiled but filtered
out; they are not additional executed coverage.
Native full corpus/stages/workspace and whole-REA gates remain unexecuted or
previously resource-limited; no upstream/PR/integration readiness is claimed.

Fresh-lease snapshot: 39,677.7 ms / 38.726 family CPU seconds. Same-lease warm:
67.1 ms / 0.068 seconds, identical handle/source. Cumulative peak is 588.4 MiB,
an upper bound on isolated warm memory. OS cache is uncontrolled; no cross-session
cache or model-token benefit is inferred from this scripted benchmark.

## From names/messages to conditions

The inventory has two identical VDBE names (`0x288f0`, `0xea6d0`) without aliases.
The initial CLI assumed uniqueness. Its corrected workflow composes strings,
incoming references and owning-function addresses before one VM snapshot; then
constant producers, uses, derived controllers and selected values/definitions.
It obtains both savepoint guards in sixteen host reads without the C report.
The final example also checks pagination before treating selected facts as a
complete set. A retained-source replay derives the two controller relations in
about 8.9 ms wall; isolated replay CPU/peak memory were not measured.

The [question/oracle](savepoint-control-oracle.md) are fixed before model trials,
with function name/messages but no supplied code addresses. Selected independent
machine evidence checks local guards, load/spill/setup and shared call. Recovered
CFG/use coverage still does not establish full machine flow, memory aliases,
nontermination or feasible execution. The first [real-model pair](savepoint-control-study.md)
now passes the frozen question through both adapters; its whole-task costs are
mixed and include discovery noise and a Code Mode parameter retry. Public
scripted checks alone do not establish those model outcomes.
