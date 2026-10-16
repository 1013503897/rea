# Selected definitions after whole-graph capacity failure

Historical probe at REA experiment revision `4d7fccbce`. Use that revision's
patches to reproduce its preserved diagnostic engine and results below. The
subsequent callable projection is documented in [native-engine.md](native-engine.md);
its real-model question/oracle are [pinned separately](projection-oracle.md).

This is a diagnostic feasibility probe following the completed boundary model
pairs, not a new public provider capability. The analyst question is whether
selected call-argument definitions can remain readable without materializing an
entire recovered graph in the public transport. The alternatives are a smaller
whole-graph encoding and a bounded selection of operations/values. Neither
fewer bytes nor an offline graph traversal establishes model-token or time gains.

## Actual graph and capacity boundaries

The artifact remains Debian SQLite `3.40.1-2+deb12u2`, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
The selected implementation is `sqlite3VdbeExec`, entry `0xea6d0`.
The disposable diagnostic patch temporarily admits 32,000 operations, 72,000
values, 128,000 inputs and 16 MiB text. It is applied after
`kuna-native-ir.patch`, against the same pinned Kuna upstream revision. Only
this diagnostic capture uses a 32 MiB encoded/stdout budget. The committed
public patch, preserved public engine and 8 MiB public budget are unchanged.

| Observed quantity | Value |
| ----------------- | ----: |
| Recovered operations | 21,349 |
| Recovered values | 35,755 |
| Recovered blocks | 1,229 |
| Operand inputs | 51,951 |
| CFG successor edges | 2,061 |
| Operation statement UTF-8 bytes | 2,255,616 |
| Value type-name UTF-8 bytes | 90,013 |
| Compact ordinary graph JSON bytes | 17,008,223 |
| Entire native document bytes | 17,801,972 |

Raising only the current 12,000-operation bound would not suffice: inputs also
exceed 50,000, display text exceeds 2 MiB, and the entire document exceeds 8 MiB.
Values happen to remain below 36,000, with little headroom. Native coverage
reports no producer issues or omitted defining-operation IDs. This is the
retained recovered graph, not proof of complete/correct machine or runtime
semantics. The ordinary function record, including C and mappings, and the
independent call facet deeply equal the preserved public-engine capture.

`measure-native-projection.py` constructs a lossless tuple encoding of every
graph field and verifies decoding equals the original graph. Its graph occupies
8,225,047 bytes; estimated whole-document size is 9,018,796 bytes after retaining
C/calls/metadata. Thus this simple encoding still does not fit the unchanged
8,388,608-byte public budget. This is an exact synthetic serialization size and
roundtrip check, not an implemented native codec or measured codec speed.

## Focused definition facts

Using the two existing call identities at `0xf115c` and `0xf238b` as roots, the
script follows native operand values to their defining operations. It retains
exact IDs and complete selected operation/value records. A 512-operation budget
is not reached in these depth samples; unresolved definitions remain explicit.

| Requested backward depth | Operations | Values | Encoded payload bytes | Unexpanded definition frontier |
| ------------------------ | ---------: | -----: | --------------------: | -----------------------------: |
| 1 | 5 | 12 | 4,335 | 6 |
| 2 | 11 | 24 | 8,589 | 3 |
| 3 | 14 | 29 | 10,447 | 1 |
| 4 | 15 | 32 | 11,457 | 1 |
| 5 | 16 | 33 | 11,934 | 1 |

The same experiment over all 416 recovered call roots gives:

| Requested backward depth | Operations | Values | Encoded payload bytes |
| ------------------------ | ---------: | -----: | --------------------: |
| 1 | 965 | 2,269 | 830,233 |
| 2 | 1,494 | 3,076 | 1,188,208 |
| 3 | 2,007 | 3,920 | 1,541,735 |
| 4 | 2,401 | 4,670 | 1,849,015 |

The 4,096-operation probe budget is not reached in these samples. Depth three
still has 394 unexpanded definitions. These payload sizes cover selected
operations/values alone, before source/provenance/transport framing. Depths are
probe parameters, not proposed product limits. This is backward SSA dependence,
without CFG, control dependence, complete use lists, memory aliases or feasible
runtime paths. No model receives these offline projections in the completed
trials. They do not become accessible through an existing snapshot by this probe.

The signal favors trying a bounded call-rooted operation/value facet when the
full graph is unavailable. The native producer already has the live function at
the capture boundary, so this could reuse that analysis rather than reconstruct
definitions from C or force repeated decompilation. A focused initial capture
is another option; later requests would need a new analysis or a separately
owned live native model. That lifecycle/time tradeoff remains unresolved.

Any prototype must share native identity/value/operand interpretation, retain
frontier reasons and source Evidence, expose partial definition/use scope, and
keep CFG-dependent reads unavailable. A native block/origin ID does not establish
a machine instruction extent or branch target. Both direct and Code Mode must
receive the same facts through the shared API before another model comparison.

## Reproduction and measured scope

Apply `kuna-native-ir.patch`, then `kuna-graph-scale-diagnostic.patch`, to pinned
upstream `fe01d6294eb0d1053ce343c8943646df88e143fc`. Reuse its stock SLA assets
and the one-job embedded-spec build profile in [native-engine.md](native-engine.md).
The preserved diagnostic executable has SHA-256
`6d0d1cef9de13180e19af77a6f62075c417178831740bccc7174bbac0af764cc`.
It is copied outside Cargo outputs, separately from the public `e7d3f0cc...` engine.
The initial build launch failed before Cargo because its PATH omitted the existing
Cargo installation; that setup failure remains recorded, followed by a corrected
build. No toolchain was installed or upgraded.

The capture reuses `KunaTargetCommands.run`, a fresh private installation
`configuration.cacheRoot`, owned target staging and normal supervision. Its argv
is `decompile INPUT 0xea6d0 --addr --json --atomic-facts
--atomic-output-bytes 33554432 --max-fn-memory 1024`, with matching 32 MiB
supervised stdout capacity. It does not execute the target. The temporary native
source changes are restored after capture; diagnostic patch reverse/forward and
public patch reverse checks pass.

The diagnostic build takes 316.764 family wall / 316.136 CPU seconds, 2,113.5 MiB
kernel family peak. Native capture takes 37.078 / 36.869 seconds, 551.4 MiB.
Offline sizing/roundtrip takes 1.428 / 1.242 seconds, 170.0 MiB. All use one CPU,
4 GiB hard memory, 3 GiB early stop and verify cleanup/OOM 0; peaks include charged
file cache. OS caches are uncontrolled. There is no equivalent completed-task
speed comparison, public-provider success claim or model-token measurement here.

Run the bounded sizing script against the retained diagnostic native JSON:

```sh
python3 experiments/analysis-efficiency/resource-run.py --observe-payload-exit -- \
  python3 experiments/atomic-codemode/measure-native-projection.py \
  /absolute/native.json /absolute/new-sizing-report.json
```

Raw receipts are `graph-scale-diagnostic-engine.json`,
`graph-scale-diagnostic-receipt.json`, `graph-scale-repro-sizing.json` and their
resource logs under `.cache/atomic-codemode/`. Binaries and the 17.8 MB native
capture remain local; they are not committed.
