# Native computation and retained fact coverage

This diagnostic separates native computation from fact selection and Code Mode
dispatch after the wide-operand model pairs. It does not change those adapters
or establish model-token savings.

## Phase instrument and actual measurements

Use experiment commit `7d0da075e` and its versions of both patches to reproduce
these historical measurements. Apply `kuna-native-ir.patch`, then
`kuna-atomic-timing-diagnostic.patch`, to Kuna
`fe01d6294eb0d1053ce343c8943646df88e143fc`. Reuse existing compiled specs and the
one-job opt-level-1 embed-specs build in `native-engine.md`. Preserved engine:
`c755184455b8fe8950a5194788d954bc0476602779b6dd614cb893a230f6fde7`;
overlay: `b2ddfd5b6d3fc4a386cfbb07d97fbd0fcbfd8279837ce68327e62baa3e0f3018`.
The preceding `a0685486...` public executable remains independently preserved.

The instrument requires `--atomic-facts` and the exact environment value
`KUNA_EXPERIMENT_ATOMIC_TIMING=1`. It emits nine sequential per-function wall
intervals to stderr, excluding logging time from the next interval. Disabled
instrumentation emits none. Analysis parameters and JSON facts are unchanged.
These are phase wall times, not phase CPU. Loading, preparation before the drive
and final output encoding are outside the intervals; the residual cannot all be
attributed to one phase.

`profile-native.mjs` uses production target/installation/process owners and a
private runtime/cache root. Its diagnostic launcher adds only the timing flag;
ambient environment is not persisted. It measures two new native processes:
fresh private cache, then the same cache/staged input. This second process is
distinct from the API owner's warm result-cache hit. Complete stdout/stderr and
digests are retained before validation. OS cache remains uncontrolled.

```sh
python3 experiments/analysis-efficiency/resource-run.py --observe-payload-exit -- \
  node experiments/atomic-codemode/profile-native.mjs \
  /absolute/diagnostic-kuna /usr/lib/x86_64-linux-gnu/libsqlite3.so.0 \
  0xea6d0 /absolute/new-profile.json /absolute/prior-public-capture.json
```

Add `--without-timing` for the disabled control. Target: SQLite Debian
`3.40.1-2+deb12u2` amd64, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
VM entry is `0xea6d0`; parser-helper entry is `0x64060`.

| Wall milliseconds     |   VM fresh | VM same cache/new process | Helper fresh | Helper same cache/new process |
| --------------------- | ---------: | ------------------------: | -----------: | ----------------------------: |
| Entire owned request  | 36,336.306 |                36,353.240 |    2,339.393 |                     2,193.311 |
| Decompile drive       | 33,681.369 |                33,855.870 |      256.200 |                       266.629 |
| C rendering           |    220.052 |                   215.235 |        9.399 |                         7.416 |
| Metadata extraction   |     64.434 |                   128.247 |        1.576 |                         1.564 |
| Membership scan       |      3.259 |                     3.496 |        0.137 |                         0.093 |
| Call facts            |      2.889 |                     3.328 |        0.245 |                         0.133 |
| Full graph collection |     0.006* |                    0.007* |        6.993 |                         5.473 |
| Projection collection |     31.383 |                    31.711 |        1.955 |                         1.770 |

Pre-render/tail metadata also appear in the nine-interval raw receipts. `*` VM
full-graph collection fails its early operation-capacity check; these numbers
do not time a complete graph export. Whole-function analysis nevertheless
produces the live IR. Each function record deeply equals its prior public golden
and its repeat. The disabled helper control also agrees, with zero timing rows.

| Whole-run resource scope              | Family wall seconds | CPU seconds | Kernel peak MiB |
| ------------------------------------- | ------------------: | ----------: | --------------: |
| Instrument build                      |             115.279 |      92.082 |           760.7 |
| VM, two processes plus validation     |              74.218 |      73.867 |           572.2 |
| Helper, two processes plus validation |               5.554 |       5.328 |           191.9 |
| Disabled helper, two processes        |               5.556 |       5.409 |           191.8 |
| Final cached build                    |               0.322 |       0.155 |            26.8 |

All use one CPU, 4 GiB hard / 3 GiB early-stop bounds, verified cleanup and OOM 0.
Kernel peak includes charged file cache, not RSS. Final build keeps the same
digest. Patch forward/reverse and lenient `check-spec` pass; full native corpus,
stages and workspace gates remain unexecuted. No upstream commit/PR or integration
readiness is claimed. Receipts/raw sources are local
`phase-timing-{vm,helper,helper-off}.json*` and resource logs under
`.cache/atomic-codemode/`.

C rendering is below 1% of this VM request; skipping it cannot remove the
approximately 34-second drive. The helper instead spends most time outside the
instrumented phases, requiring further profiling before choosing persistent
state. Same-cache new processes reanalyze. Previously measured same-lease API
source reuse remains a separate approximately 40 ms path.

## Lossless full-graph encoding feasibility

The earlier diagnostic source has 21,349 operations, 35,755 values and 1,229
blocks, with no omitted definition IDs. Its whole document is 17,801,972 bytes;
the graph is 17,008,223 bytes, including 2,255,616 bytes of operation display and
90,013 bytes of value type names. Plain tuple packing was still too large.

```sh
python3 experiments/analysis-efficiency/resource-run.py --observe-payload-exit -- \
  python3 experiments/atomic-codemode/measure-native-encoding.py \
  /absolute/diagnostic-native.json /absolute/new-encoding-report.json
```

Gzip level 1 makes the graph 2,020,464 bytes. Hypothetical documents retaining
ordinary C/metadata/calls and replacing only the graph with a typed envelope are:

| Encoding      | Entire JSON bytes | Existing transport budget |
| ------------- | ----------------: | ------------------------: |
| gzip + base64 |         3,487,776 |                 8,388,608 |
| gzip + hex    |         4,834,749 |                 8,388,608 |

The graph byte roundtrip is exact. Python gzip/base64 encode costs 69.037 ms
wall / 69.037 ms CPU; decode 34.632 / 34.571 ms. Whole sizing task: 0.826 wall /
0.654 CPU seconds, 169.8 MiB peak, cleanup verified and OOM 0. These are offline
Python feasibility measurements, not Rust/Node timings, native output, public
support or agent savings. Source SHA-256:
`0a31513350be440983094710197b155a2ec8c49d28852bb20a524292091637b7`;
reproducible receipt: `full-graph-encoding-repro.json` beside its resource log.

This supports testing bounded lossless transport before introducing live-function
ownership or repeating analysis for missing definitions. Required checks include
allocation/encoding growth, bounded inflation, exact format/length/row admission,
malformed-graph isolation from calls/C, complete Evidence access, actual CPU and
memory, fallback behavior and real-model workflows. The shared owner must return
selected facts rather than send an encoded graph to the agent. The current
public engine at this sizing checkpoint still has a bounded call-rooted
projection. The [subsequent implementation](native-graph-transport-study.md)
now verifies full recovered-graph access through bounded native/Node encoding
and both public MCP adapters; real-model verification remains separate.
