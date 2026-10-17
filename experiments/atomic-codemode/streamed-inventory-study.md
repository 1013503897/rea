# Streamed native string Evidence

This work refreshed main to `150e996a8` in `8488f8236`. It remains an experiment:
no PR and no merge into main. Native engine `2e398e7229e30b6d2387a802db8a0050764119a6b457020d334855e36e69d6c5`
is unchanged. Source retrieval through LeanToken returned internal/not-indexed
errors; scoped working-tree reads were used instead.

## Reproduced coverage gap

`strings({query,fields:[],limit:1})` still captured a complete stdout string before
selecting rows. In the frozen historical runtime at `8488f8236`, real Linux
FFmpeg `libavcodec.so.59.37.100` fails at the 8 MiB buffered-output ceiling before
answering the selected metadata question. Its complete native inventory is
16,810,900 bytes / 60,601 rows. The earlier LLVM query fails at that same ceiling.
These are real SDK/provider observations, not simulated large responses.

The FFmpeg ELF is 14,955,104 bytes, SHA-256
`28c258cc42cbaf9813bf91b41666d2b8063d10aa77aaaf424fac0079f6497b7e`.
Independent ELF PT_LOAD/file reads verify the two selected ASCII runs, preceding
NULs, LF endings, encoded lengths and exact head/tail bytes in the
[frozen oracle](streamed-inventory-oracle.md). The 60,601-row count is native
producer fidelity, not independent proof of complete recognition.

## One source owner and the existing streaming parser

The experimental provider now pipes native stdout to a bounded source spool.
Strings additionally feed the production `KunaStringInventoryReader` as bytes
arrive; its validated count/identity/hash/byte size must agree with retained
Evidence. The old whole-string parse wrapper is removed. No native CLI, detection
algorithm, public method count or query/filter semantics changed.

`NativeSourceStore` owns source metadata, aggregate accounting, raw files and
hash validation. Existing process supervision still owns command cancellation
and cleanup. File descriptors use `OwnedFileHandle` and `ArtifactResourceScope`;
failed closes retain the same owner. Unpublished failed files are removed rather
than accumulating outside accounting. Partial writes update committed prefix
bytes/hash as they succeed. Disk and external-copy failures remain typed; a
failed requested copy keeps a readable source ID and blocks new captures until a
new lease, avoiding silent omission or repeated native work.

A string capture may use the remaining **existing 64 MiB per-lease source budget**;
there is no aggregate stdout string in the host. Other native formats keep their
8 MiB source bound and stderr retains the 8 MiB diagnostic bound. The production
reader independently bounds retained heap. This does not bound native scan or
renderer allocation: the native command still inventories and renders the whole
target before selection. Per-lease parsed reuse is not cross-session caching.

Native failures may retain an exact partial prefix. `source.capture_complete:false`
and typed failure details distinguish this from a valid empty result. A complete
capture can still contain invalid facts, which the parser rejects with Evidence
retained. Raw Evidence windows use a UTF-8 streaming decoder and retain only the
requested UTF-16 code units, while hashing the entire source on every read before
return. This preserves freshness and slice semantics across split multibyte or
surrogate boundaries; small replies do not make hash validation sublinear.

## Executed checks and costs

Real SDK, Direct MCP and Code Mode FFmpeg verifiers all pass selected metadata,
default text, cache/source identity, exact loaded bytes, raw windows, all five
retained raw digests and stale-handle rejection after reopen. The actual CLI also
returns the selected metadata. Native strings scan once per lease; four selected
byte windows have their own captures. All facts remain available through the same
shared session, with nineteen methods / twenty-two Direct tools / four Code tools.

The first FFmpeg verifier failed because it expected byte coverage `complete`
instead of the existing `complete-for-requested-range`. That was corrected in
the verifier; the original log is retained. SQLite reference/NUL/span checks pass
in all three lanes, as do real x86 SSH complete-function/prototype fidelity and
actual converted catalog/schema checks. All 111 experimental JS tests pass,
including Unicode slices, out-of-window mutation, exact/aggregate capacity,
malformed provider facts, deduplication, partial-write failure, external-copy
failure and retained descriptor cleanup. Changed-file lint/format checks pass.
The latest-main runtime build passes. No full `check:pr`, new Ghidra/IDA lane,
exhaustive corpus or CPU-time speedup is claimed. The earlier bounded
`check:fast` refusal is not a pass and was not retried.

| Whole verifier/probe                          | Wall s | Local family CPU s | Kernel family peak MiB |
| --------------------------------------------- | -----: | -----------------: | ---------------------: |
| Latest-main runtime build                     | 33.644 |          33.444422 |                3,047.6 |
| Old FFmpeg SDK probe, fails before selection  |  1.631 |           1.423863 |                  212.4 |
| New FFmpeg SDK verifier                       |  6.866 |           6.680577 |                  348.8 |
| New FFmpeg Direct verifier                    |  7.369 |           7.125644 |                  435.8 |
| New FFmpeg Code Mode verifier                 |  7.571 |           7.280821 |                  431.8 |
| LLVM capacity + partial source + cancellation | 10.187 |           9.915344 |                1,489.5 |
| SSH fidelity                                  |  8.681 |           8.427966 |                  323.3 |
| Converted catalog/schema checks               |  2.033 |           1.806248 |                  141.0 |
| 111 JS tests                                  |  6.563 |           6.307038 |                  127.8 |

The old probe aborts early and does less work than the completed new verifiers;
these costs cannot rank equivalent completed workflows. New cold metadata calls
are 2.29 / 2.31 / 2.41 seconds in SDK / Direct / Code Mode; warm metadata is
5.1 / 7.5 / 13.9 ms. Second-query reuse is 5.5 / 9.2 / 12.6 ms. Raw Evidence
windows take 82–96 ms in this sample, including full-file validation. These are
single fresh-lease observations, not cold kernel-cache or warm-model repeats.
Scripted probes have no model tokens.

Every successful resource receipt above verifies OOM=0 and owned payload cleanup
at payload exit while the observer remains alive. Final exited-cgroup counters
are unavailable; kernel family memory includes file cache, not just RSS. Runs
are serial on one CPU with 3 GiB early stop / 4 GiB hard cap / no swap; builds
use 3.25 GiB early stop. Inherited ambient processes are outside the measurement.
The evaluator's explicitly retained raw copies are separate from lease handles.

## Larger targets remain blocked

Real `libLLVM-16.so.1`, `/usr/bin/node` and pinned Node 24 all exceed 64 MiB of
raw native inventory. The first streamed LLVM probe returns explicit capacity
with a retained partial prefix. Initial Node probes additionally report command
identity/cleanup uncertainty (`observed=[kuna]`) while stopping at that ceiling;
subsequent session close and payload cleanup are verified. Those original primary
failures are preserved, not converted into successful analysis. Current errors
also retain the source-budget failure when cleanup uncertainty remains primary.
The final LLVM verifier passes rejection, partial-prefix hash/readability,
500 ms request cancellation and owned cleanup checks; it does **not** successfully
analyze LLVM strings. Peaks across these probes are about 1.46–1.64 GiB, OOM=0.

Do not increase the source budget merely to call these targets supported. A
producer-side literal/metadata selection or reusable compact index needs another
measured experiment. Stock regex filtering is not a correctness substitute for
literal search: its backtracking budget can classify an unexamined suffix as
nonmatching. This is a source-derived concern, not a newly reproduced runtime
regex false-negative claim. Whole-inventory native computation and these larger
coverage failures remain unresolved.

The [model question](streamed-inventory-question.txt) and oracle are frozen before
actual isolated Direct/Code Mode trials. Record their original full answers and
whole-task costs separately; this prerequisite repair is not itself evidence
that Code Mode improves complex reverse-engineering reasoning.
