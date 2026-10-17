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

## Actual model outcomes

Runtime facts are frozen at `0c8b7c29a4878f03b28c8b94e2352f2b6dce3dca`.
The first isolated pair does not reach MCP: `--server-name rea-codemode` is
configured, but the evaluator's enabled-tool hint hard-codes `mcp__rea__...`.
Both answers truthfully report unavailable tools, no lease and unknown facts.
Their exit code zero is **not** an analysis pass. The original answers, three
model responses / two client execs each, zero dispatched MCP calls and all costs
are retained. No provider or analysis-oracle failure is inferred from this.

`35d93e21f` repairs the producing hint: it gives the configured server label and
base names and asks discovery to use actual registered callable metadata. It no
longer guesses a namespace. The same unchanged question/oracle is then run once
per adapter at that revision, Direct before Code Mode, fresh isolated profiles,
same pinned Node/engine/FFmpeg, requested `gpt-6.1-sol` / high. This is a paired
setup correction, not an answer repair or rerun selected for a winner. Resolved
remote model builds, remote computation and cache state remain unmeasured.

Both corrected original answers pass the full frozen oracle. Each finds one
ASCII match per query, reports both 28-byte encoded spans and exact inclusive
ends, requests/reports exactly sixteen head and eight tail bytes, and keeps the
four unread middle bytes explicit. Each confirms shared source identity,
16,810,900 bytes / `capture_complete:true`, reads a small source window and closes
the lease. Both distinguish complete capture from unknown artifact-wide
recognition, encoded spans from source-language objects, and static observations
from references/runtime use/live memory. Full answers and actual calls were
reviewed; this is agent review, not human readiness.

All five cited IDs per answer match real traces and retained raw captures. Every
capture's target/engine/hash/length validates; each lane has exactly one inventory
and four byte-window captures. Source hashes in the answers match those files.
Code Mode actually executes two `execute_javascript` requests containing four
fact reads. Direct makes four fact requests. Both clients have the common
JavaScript executor; the difference is the server composition interface. Both
select only the two short matching values and bounded bytes/Evidence, so the
complete inventory stays outside model context. Code Mode's statement that
Evidence expires on close concerns lease handles; explicit evaluator copies
remain on disk.

| Completed corrected-task metric |    Direct | Code Mode |
| ------------------------------- | --------: | --------: |
| Full semantic/source review     |      pass |      pass |
| Cumulative input tokens         |   135,330 |   118,641 |
| Cached input, included above    |   111,360 |    86,656 |
| Uncached input                  |    23,970 |    31,985 |
| Output tokens                   |     2,032 |     1,981 |
| Reasoning, included in output   |       355 |       227 |
| Unique model responses          |         7 |         8 |
| Client exec / wait calls        |     6 / 0 |     7 / 0 |
| MCP attempts                    |         7 |         6 |
| Help / fact reads               |     1 / 4 |     2 / 4 |
| Rejections / capacity retries   |     0 / 0 |     0 / 0 |
| Native captures                 |         5 |         5 |
| Model wall s                    |    53.155 |    64.064 |
| Whole-family wall s             |    53.686 |    64.565 |
| Local family CPU s              | 10.047733 | 10.418055 |
| Kernel family peak MiB          |     710.8 |     627.1 |

Unique per-response usage sums match summaries. Cache input and reasoning are
included as labeled, not added twice. All corrected and failed-setup payload
receipts verify OOM=0, complete owned cleanup and removed profiles; target,
engine and relevant runtime fingerprints are unchanged within each run.

The configuration failures cost real resources and are not discarded:

| Failed setup metric              |                  Direct |                Code Mode |
| -------------------------------- | ----------------------: | -----------------------: |
| Input / cached / uncached tokens | 36,422 / 32,768 / 3,654 | 35,458 / 23,168 / 12,290 |
| Output / reasoning tokens        |               720 / 293 |                640 / 401 |
| Model / family wall s            |         24.604 / 25.197 |          26.637 / 27.102 |
| Family CPU s                     |                3.921968 |                 3.779782 |
| Family peak MiB                  |                   414.2 |                    416.9 |

Including setup failure plus its corrected attempt, Direct uses 171,752 input
(27,624 uncached), 2,752 output, 77.759 model-wall / 78.883 family-wall seconds
and 13.969701 local CPU seconds. Code Mode uses 154,099 input (44,275 uncached),
2,621 output, 90.701 model-wall / 91.667 family-wall seconds and 14.197837 CPU
seconds. Peaks are maxima across attempts, not added memory. This total describes
the experiment's actual attempts, not a single clean profile or causal adapter
penalty.

Code Mode lowers cumulative input in this completed pair but uses more uncached
input, more model responses, longer wall and slightly more CPU; peak family
memory is lower. Discovery and remote cache state differ. This is mixed scoped
evidence, with matched answer correctness after the shared tool repair. It does
not establish a stable Code Mode advantage or complex-program reasoning
superiority. The larger-target native inventory gap remains.

Answer SHA-256:

- Direct corrected: `bc2a5b503f10e5813c04d38af245ba3985c835338b3c784d827cc436ddcfc139`
- Code Mode corrected: `bf5082807d7fd8e37d939bc93933902cdefb7136f7eb86351dfedc7ae2bac9db`

Local artifact SHA-256 (raw provider documents remain uncommitted):

- `ffmpeg-inventory-failed-setup-costs.json`: `e088057e0b0222c9258141800d25d708145337c6b53f80cea87ce7f175e2e9b3`
- `ffmpeg-inventory-model-costs.json`: `c1a0cd325787759ae2dc5d46fc40b6fd0f972d28f6bd440a3eeb6ff4038009e1`
- `ffmpeg-inventory-answer-review.json`: `f7d3d1a627cf4ee21a38b5eb80997f4432078623c824e0ba6ed2373ee4c1ae66`
- `ffmpeg-inventory-direct-v1.log`: `8c8fa6b091869ce2fbca1bccf500a1b5fd12ce98699bc0cea0052e31db1e4779`
- `ffmpeg-inventory-codemode-v1.log`: `bc1e5aa17687db7a7c8562c35e216bca40051ee7224e964c93ac74015631331a`
- `ffmpeg-inventory-direct-v2.log`: `8aecb55ffe0d21b8b152fd2896c919111d9e88e8647e7767093758abf5bad47b`
- `ffmpeg-inventory-codemode-v2.log`: `b2032c3fe78d637dae1296eb360a2a7173988d6f25740e343fb154747392cb86`
- `inventory-before-ffmpeg-v1.log`: `ac3f9d046d3a40fc9ade8ae4d061038471be155b37f07a652651f660b6a08de4`
- `inventory-final-capacity.log`: `b425b8d8d5dc48a507a234624c83134377c601c0ab10378ee2dbbf8a4a5cf311`
