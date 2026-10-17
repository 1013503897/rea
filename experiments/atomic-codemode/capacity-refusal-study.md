# Reuse proven native source refusals

After the streamed-inventory model pair, main was fetched again and remained
`150e996a8`. Baseline runtime is `b88c75df8`. Native engine remains
`2e398e7229e30b6d2387a802db8a0050764119a6b457020d334855e36e69d6c5`.
This is an experimental follow-up, with no PR or integration into main.

## Observed redundant work

Two identical real LLVM string queries in one target lease first hit the 64 MiB
source ceiling after 8.363 seconds. The second still runs native analysis for
3.024 seconds / 3.021736 CPU seconds, retaining another partial prefix and
reporting cleanup uncertainty. The provider discarded every failed work entry,
even a proven output-size refusal for the identical immutable native capture.
The source budget cannot grow within that lease. Neither query produces valid
string facts; absence must remain unknown.

The same two-request probe after the change takes 7.603 seconds for the first
refusal and 1.528 ms / 0.001567 CPU seconds for reuse. Only one partial source is
captured, with the same readable Evidence handle on both errors. The added
`cached_observation:{kind:"source_budget_refusal",scope:"target_lease"}` labels
the original observation being reused; it does not report a fresh native run or
current process status. Cold-time variation is not a causal speed claim.

| Same two-request diagnostic probe | Wall s | Local family CPU s | Kernel family peak MiB |
| --------------------------------- | -----: | -----------------: | ---------------------: |
| Before                            | 12.406 |          12.192070 |                1,745.6 |
| After                             |  8.579 |           8.364375 |                1,492.5 |

This compares the same diagnostic intent, not successful LLVM analysis. The
second original attempt adds a cleanup-uncertainty failure, whereas reuse keeps
the original proven resource refusal without starting another process. Different
cold costs and transient ownership observations prevent a pure latency ratio or
general memory/speedup claim. The decisive signal is avoided native work.

## Cache ownership and invalidation

`NativeCaptureCache` owns pending/completed native work in one provider lease.
It replaces the old map wrapper. It retains a refusal only for the understood
`FactFailure` resource code, native-source scope, positive safe byte limit and
observed lower bound above that limit, with a retained partial source ID and
only the six understood refusal fields. Secondary file-cleanup uncertainty and
unexamined metadata also prevent reuse. Classification copies own data properties without
invoking getters; unknown/primitive failures retain their original identity.

Cancellation, I/O, cleanup uncertainty, other resources and unproven constraints
remain uncached. The cache never turns an unknown primary cleanup outcome into
resource success. Error views are separate from the immutable retained refusal,
so editing an SDK error cannot alter later Evidence IDs or limits. At most the
existing 128-source policy's number of work entries is memoized. When that table
is full, new producer results still return without adding retention; the shared
application owner continues to bound native admission. This also bounds any future source/key aliases. No additional source budget is introduced.

Keys keep the existing native request inputs, with target/engine/profile fixed
by the owner instance. Catalog selectors do not change native capture arguments.
Cache validity follows the immutable artifact capture and nonincreasing source
budget, not live state. Successful captures retain the previous reuse semantics;
close clears the cache after confirmed resource cleanup. A new lease gets a new
owner. No cross-session negative cache is claimed.

## Actual adapters, failures and verification scope

Real LLVM SDK and Direct MCP checks pass refusal reuse, unchanged target/lease,
identical refusal details except the explicit reuse label, one raw source,
readable partial Evidence and exact full raw digest. SDK warm latency is 2.282 ms
/ 0.001675 CPU seconds; Direct is 6.412 ms / 0.005566 CPU seconds. Their fresh
first calls take 7.350 / 7.756 seconds respectively.

The first scripted Code Mode check fails its cache-hit precondition because the
first call reports `cleanup_incomplete`. It correctly does not reuse that
uncertain failure, and the second native attempt takes about 2.905 seconds.
Both partial raw captures independently validate target/engine/hash/length. The
original verifier recorded phases/stack but placed the complete API observation
after its assertions, so the failed API payload is not fully auditable. Preserve
that limitation and the original failed receipt; do not relabel it a pass.

The verifier now records replies before assertions and stops if cleanup is
uncertain. One fresh scripted coverage repeat then reaches the proven-refusal
path. In one actual MCP execution, the guest calls strings twice and Evidence
once: the second call is 3 ms by guest `Date.now` (millisecond precision, separate
warm CPU unmeasured), with the same handle and exactly one raw source. The full
8.126-second program uses 8.119767 local CPU seconds. The two error results remain
errors; successful composition does not establish successful LLVM analysis.
This is a scripted coverage repeat after a verifier correction, not another
model answer or a replacement for the failed observation.

| Whole verifier                           | Wall s | Local family CPU s | Kernel family peak MiB | Result                             |
| ---------------------------------------- | -----: | -----------------: | ---------------------: | ---------------------------------- |
| SDK refusal + reuse + Evidence           |  9.092 |           8.908659 |                1,516.8 | pass                               |
| Direct MCP same task                     |  9.886 |           9.666791 |                1,635.9 | pass                               |
| First Code Mode attempt                  | 12.909 |          12.680445 |                1,939.9 | cache-hit precondition unavailable |
| Corrected Code Mode coverage repeat      | 10.088 |           9.885309 |                1,698.8 | pass                               |
| Capacity + partial source + cancellation |  9.885 |           9.632806 |                1,487.4 | pass                               |

Both Code Mode attempts cost 22.997 family-wall seconds / 22.565754 CPU seconds;
peak across them is 1,939.9 MiB, not the sum of peaks. These receipts are not a
matched adapter performance ranking: verifier work and failure paths differ.
All are one-CPU, 3 GiB early-stop / 4 GiB hard-limit, no-swap runs; payload-exit
observers verify cleanup and OOM=0, including the failed attempt. Final exited-
cgroup counters are unavailable. Kernel family memory includes file cache.

All 116 experimental JS tests pass, including in-flight reuse, invalidation,
mutable caller views, zero/false/null/unknown errors, noncacheable cleanup,
accessor avoidance and bounded memo admission. Real FFmpeg selected facts,
Evidence, bytes and stale-handle checks pass in SDK/Direct/Code Mode after the
cache change. Cancellation/owned cleanup checks pass. Changed-file lint and
format checks pass. After tightening the sealed-source/secondary-cleanup eligibility guard, the full
116-test suite passes again, and captured SDK/Direct/Code Mode refusal DTOs all
pass through that sealed contract in replay. That replay is a production-boundary
check, not another live-provider or model run. Existing full-suite/resource-gate
limitations from the
[streaming study](streamed-inventory-study.md) remain. No new model trial was
performed for this cache change; the earlier fixed-runtime model costs remain
attached to that earlier runtime. Scripted probes consume no model tokens.

LLVM and Node inventories still exceed the source budget. This optimization
makes known refusal cheap; producer-side selective computation remains the next
coverage/computation question. It does not improve provider parity or prove
complex reverse-engineering superiority.

Local artifact SHA-256 (raw documents remain uncommitted):

- `capacity-cache-before.json`: `68fbd4444c81b4a4435a8d300f8b1ea7365f140078ab3cc322bde140be74db24`
- `capacity-cache-after.json`: `66491d37d85c3748578022e0f7e0f8013c2bf19ecec6d0c73db33d2246c7485e`
- `capacity-cache-before.log`: `d57684ede8f9d01bf9750b78f400b4bb529e2d7a23b84195d79d6d729cba6190`
- `capacity-cache-after.log`: `30039f832930680a8cc128c8a372c0018be08c88ac84e4db03d2cc15e4623b38`
- `capacity-cache-final-sdk.json`: `95326d584a88ca5130e79e116b5c0a14bdbaa0a6016342d58010515e8a6c22f9`
- `capacity-cache-final-direct.json`: `ead7e2c5976e13876d1d34cd336e88f62a2e9bba4b3812bc012efbc64d272473`
- `capacity-cache-final-codemode.json`: `8bb64217d52bdbd1771968b9274d6ae04a6ea3b0ae1e5a09d0510bf180320e7b`
- `capacity-cache-final2-codemode.json`: `4ccf81f282a2f62db00638b6a94feaf80992aacc8096ea15d3fc419f0d2789a3`
- `capacity-cache-js-precommit.log`: `d22b3e948baf2a36ae262786d470af0fc3d631ddd79d88a879ac9f2103352792`
- `capacity-cache-js-sealed.log`: `004ffeac2994612f1608fd5904eff15c41ea059d4ad91644abce8532669a5ea0`
