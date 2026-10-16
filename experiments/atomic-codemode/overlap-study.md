# Sequential and overlapping public requests

This follows the unexplained 107.804-second source capture in the
[guided model pair](savepoint-control-study.md). The same preserved `677b9795...`
engine, target digest, VM entry and three instruction windows are used through
real stdio MCP. Each case starts a fresh lease/private native cache; cases run
serially in code/sequential, direct/overlap, direct/sequential, code/overlap order.
No model is involved and no token savings are inferred.

`verify-overlap.mjs` first requests one full VM capture and the windows, either
sequentially or with the second request starting 100 ms after the first. The
client records starts/finishes to prove request overlap; it does not assume
provider concurrency. `AtomicSession.call` serializes provider admission for
both adapters. Thus an instruction request can wait behind the snapshot. Its
API wall time is not its native command execution time.

Every full recovered graph and ordinary function field matches the complete
golden. Selected instruction items/coverage agree across all four cases. Both
snapshot and instruction reads repeat under the same retained Evidence and
handle. Target/frame/decoding selection and all limits are preserved.

| Case               | Fresh task seconds | Fresh family CPU s | VM capture s | Warm task ms | Warm family CPU s |
| ------------------ | -----------------: | -----------------: | -----------: | -----------: | ----------------: |
| Code, sequential   |             39.488 |             39.432 |       37.112 |       43.737 |             0.044 |
| Direct, overlap    |             38.931 |             38.865 |       36.635 |        6.561 |             0.007 |
| Direct, sequential |             39.171 |             39.098 |       36.987 |        7.759 |             0.008 |
| Code, overlap      |             40.616 |             40.564 |       38.262 |       32.288 |             0.033 |

CPU is a delta over each complete phase in the owned cgroup; no overlapping
per-request CPU attribution is attempted. Kernel peaks are cumulative and
include charged file cache, not RSS; the warm peak is only an upper bound.
Complete family totals/peaks and cleanup counters are in the resource receipts
under `.cache/atomic-codemode/overlap-v1-*`. One CPU, 4 GiB hard / 3 GiB early-stop,
192-task bounds apply. All four cases have verified cleanup, no abort and OOM 0.

| Case               | Whole family wall s | Whole family CPU s | Kernel peak MiB |
| ------------------ | ------------------: | -----------------: | --------------: |
| Code, sequential   |              41.299 |             41.026 |           623.1 |
| Direct, overlap    |              40.695 |             40.427 |           616.2 |
| Direct, sequential |              40.893 |             40.660 |           617.6 |
| Code, overlap      |              42.506 |             42.239 |           630.0 |

The 108-second capture does not reproduce in this matched sample. Request
queueing is confirmed by the owner and explains waiting outside native source
times; it does not explain the original long capture itself. There is no basis
to change provider concurrency or claim a native speed fix. Host contention,
OS caches and unrecorded native phases remain uncontrolled/unmeasured. This is
a four-case diagnostic, not a distribution or proof that the anomaly is fixed.

Both repeated tasks are small; Code Mode's additional guest setup is visible
here. This is not evidence against composition over a larger dependency graph,
nor a comparison with a client that lacks its own JavaScript executor.
