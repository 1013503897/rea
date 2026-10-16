# Native architecture storage facts

An exact storage coordinate needs its space and width before it can name a
register. The previous SSH task exposed this gap: the caller uses two-byte
register:0x8 (CX), whereas the callee has eight-byte register:0x8 (RCX).
Call argument value storage and passing storage are also separate facts.

Two shared queries, `spaces` and `registers`, expose a native architecture
catalog. Queries select names/indices/exact tuples, fields and pages; identity,
architecture, provenance and coverage remain inline. Missing exact map entries
are not absent hardware storage. No containing-register substitution, SSA
equality, stack rebase, alias or live-value inference is performed. Empty names
and null spaces survive; undecodable names retain exact bytes. Names come from
the native canonical varnode_xref map, not every translator alias or symbol.

The exporter reads the existing native AddrSpaceManager and Sleigh register-map
owners. It bootstraps the selected binary with embedded specs and disabled
listing/fast function discovery, and decompiles no function. Bootstrap still
loads binary/metadata; this is not a header-only read. A bounded streaming writer
admits encoded growth before allocation. One immutable 8 MiB maximum source
backs both queries per lease, with parsed immutable views and no query-key or
cross-lease cache. Successful close clears it; failed cleanup retains its owner.
Existing function/string catalogs use the same fixed-key capture owner. Catalog
sources and decoded facts cannot be mutated by SDK consumers. SDK, CLI and both
MCP adapters share the same named contracts; common coordinate identity has one
owner. There are nineteen methods, twenty-two direct tools or four Code Mode
tools. Stock Kuna integration and other provider parity are not established.

The experiment refreshed main through `f9ccacca2` before this work. Native
upstream remains `fe01d6294eb0d1053ce343c8943646df88e143fc`, with overlay SHA-256
`d4eb3f245359f4421294e1f9c4f476ed5b58da04cc34637b5a3ca90d0e857b71`.
The copied immutable embed-specs/opt1 engine SHA-256 is
`c48ad95784ce7b26beb966b054fe103b11922c8aa8cbe7c4144f3daa1d5d45fe`.
The overlay passes forward-index and reverse-worktree application checks.
The older pinned 770ac3f2 engine returns typed `execution_failure` for the new
native command; stock 1.833 returns `capability_unavailable` before launch.
Neither failure becomes an empty register catalog.

## Real-provider checks before models

Both actual MCP adapters read the stripped Debian x86-64 `/usr/bin/ssh`, digest
`04f2ff5f506a3f332e7adeb1478a4c551ae74acdd328e6fb5c2495664d4064e6`.
All nine spaces and 1,440 register rows match their complete retained source
through public paging and Evidence reads, with source digest verification.
Exact batch lookup distinguishes CX/ECX/RCX, RDI/R15/R9D, an unmatched
three-byte slice and stack storage. Empty selections remain empty. Both queries
reuse exactly one catalog source without a function snapshot. An intentionally
unusable ambient SLEIGHHOME does not override embedded spec selection.

| Selected query             | Direct wall / CPU ms | Code Mode wall / CPU ms |
| -------------------------- | -------------------- | ----------------------- |
| First space capture        | 432.2 / 422.2        | 509.4 / 498.5           |
| Same-lease repeated spaces | 3.5 / 3.5            | 41.4 / 41.4             |
| Same-lease register batch  | 4.0 / 4.0            | 21.3 / 21.2             |

These are actual MCP reads, not model-task measurements. CPU includes the
local verifier/client/server/native family; first captures have fresh leases
and private native caches, while OS caches are uncontrolled. Warm queries
reuse the same immutable source. Response bytes alone are not token counts.

The [Debian AArch64 OpenSSH package](https://deb.debian.org/debian/pool/main/o/openssh/openssh-client_10.0p1-7+deb13u4_arm64.deb)
was downloaded over HTTPS, extracted and neither installed nor executed.
Package digest is `e900c13c9a5267714fc2c2c1f369fe4a667c7dd4031266b1480250320f0bfcfb`;
binary digest is `de352e4ace7028d9816fd0ee9d22936bc1b5622c400d5b0b7df660df3426b068`.
Package signatures were not verified. Independent ELF headers select AArch64/LE;
the native model reports AARCH64:LE:64:v8A:default with nine spaces and 634
register rows. Full paging matches retained native source. Native x0/w0 use
register:0x4000 with widths eight/four, unlike x86 coordinates. This verifies
another real architecture catalog; big-endian binaries and comprehensive
architecture/register/alias coverage remain untested.

| Executed pre-model check                         | Wall s | Family CPU s | Kernel family peak MiB |
| ------------------------------------------------ | ------ | ------------ | ---------------------- |
| Storage native CLI build                         | 26.494 | 26.104       | 538.1                  |
| Two native serializer/admission tests            | 43.054 | 33.317       | 483.5                  |
| 87 experiment JS tests                           | 5.154  | 4.939        | 82.7                   |
| Direct complete catalog verifier                 | 1.830  | 1.618        | 198.0                  |
| Code complete catalog verifier                   | 2.132  | 1.880        | 204.6                  |
| AArch64 complete catalog verifier, initial       | 8.920  | 5.523        | 194.4                  |
| SDK existing zlib catalog/cache regression       | 4.572  | 3.203        | 129.7                  |
| Public CLI storage composition                   | 3.660  | 2.520        | 119.6                  |
| SDK injected cleanup-failure/retry               | 5.080  | 3.724        | 123.0                  |
| Old pinned engine failure                        | 2.666  | 1.675        | 54.0                   |
| Stock capability failure                         | 2.151  | 1.328        | 47.7                   |
| Real MCP prototypes/full prior-function fidelity | 28.233 | 20.870       | 305.1                  |
| Both SDK-converted MCP catalogs/schemas          | 1.831  | 1.573        | 137.9                  |

These resource-run receipts use one CPU, 4 GiB hard/3 GiB early-stop memory,
TasksMax192 and swap disabled. Peaks are kernel process-family accounting,
including charged file cache, not RSS. Payload-exit observations verify counters,
zero OOM events and descendant cleanup. Final whole-scope counters are unavailable.
No global repository/native corpus gate is claimed. An initial direct verifier
attempt failed at startup after moving a shared schema without its local
snapshot binding; it retained its failed receipt, was fixed before models, and
is excluded from successful-query timings. No native operation ran in that
attempt. Whole model tasks below must charge all their own attempts.

The final repeat of all 87 JS tests passes (5.052 s wall, 4.855 s CPU,
83.0 MiB family peak). A final AArch64 run also verifies exact x0/w0 named
queries against the pinned native SLEIGH definitions at AARCH64instructions.sinc
(register definitions beginning at 0x4000), in addition to complete-source
fidelity (1.932 s wall, 1.561 s CPU, 196.2 MiB peak). Both have zero OOM
events and verified payload cleanup.

## Frozen real-model comparison

The [question](storage-boundary-question.txt) and [oracle](storage-boundary-oracle.md)
extend the earlier native prototype task with exact storage-name and space
metadata requirements. Both complete actual catalogs are available. Model
runtime is frozen at `577ca5a0ae84d61a00f576feed7306b6cf54949c`; both isolated
Codex 0.161.0 runs request gpt-6.1-sol/high, in Direct → Code order. Neither
client feature flag establishes the available client tools: both lanes actually
have the common client JavaScript executor. This compares the MCP calling
adapters inside that common client surface.

Both complete answers pass the frozen oracle. They identify the owner/caller,
report all fourteen native prototype entries, native model/lock/return/error
flags, the 3/44 raw inputs and exact parameter matches, and preserve missing
matches without inferring original arity. Both use the native catalog for
CX versus RCX, R9D and the return RAX, distinguish R15 value storage from RDI
passing storage, and leave stack tuples without fabricated register names.
Code/register/stack descriptors remain separate metadata observations. Both
retain snapshot-local SSA identities, machine corroboration, unknowns and close.

Scripted checks verify every cited source against the delivered trace, retained
digest, target/engine identity, complete previous function records, prototypes
and exact input matches: ten Direct sources and twelve Code sources. Each lane
cites one native catalog and one capture per selected function. Additional
input-space counts, selected call argument/value/passing tuples and nine
independent ELF instruction sites agree; relative call/LEA destinations are
decoded from file-backed ELF segments. This source/fidelity check is separate
from reviewing the complete natural-language answer against the oracle; both
were performed. It does not prove all native recovery is machine-equivalent.

| Whole completed task                         | Direct    | Code Mode |
| -------------------------------------------- | --------- | --------- |
| Required answer                              | pass      | pass      |
| Cumulative input tokens                      | 415,450   | 307,888   |
| Cached input, included above                 | 359,936   | 273,664   |
| Uncached input                               | 55,514    | 34,224    |
| Output tokens                                | 7,170     | 6,575     |
| Reasoning tokens, included in output         | 1,802     | 1,226     |
| Actual unique model responses                | 13        | 12        |
| Client executor / wait calls                 | 12 / 0    | 11 / 0    |
| MCP attempts, including discovery/open/close | 28        | 12        |
| Direct fact reads / Code inner API reads     | 25        | 32        |
| Spaces / registers reads                     | 1 / 2     | 1 / 2     |
| Parameters reads                             | 2         | 4         |
| API / transport failures                     | 0 / 0     | 0 / 0     |
| Model wall seconds                           | 158.116   | 142.153   |
| Family wall seconds                          | 158.992   | 142.658   |
| Local family CPU seconds                     | 18.232034 | 20.391465 |
| Kernel family peak MiB                       | 672.0     | 636.9     |

All attempts are retained and charged; there are no failed model attempts or
retries in this pair. Summed unique per-response usage matches the runner totals.
Both use fresh leases/private native caches, preserve target/engine/runtime
fingerprints, remove isolated profiles and verify payload cleanup with zero OOM
events. Native catalog reuse is warm within the lease; remote model/OS caches,
resolved model build, remote compute and host contention remain uncontrolled
or unmeasured. The native caller capture itself took 4.432 s Direct / 5.859 s
Code; whole CPU differences cannot be attributed solely to adapter overhead.

In this one pair, Code uses 25.9% less cumulative input, 38.4% less uncached
input and 10.1% less model wall time, while local family CPU is 11.8% higher.
It performs more fact reads, including repeated cached prototypes and joins,
and only one fewer model response despite sixteen fewer MCP requests. The
earlier studies retain their mixed results. This new task adds metadata
requirements, so old question timings are not an equivalent before/after test.
No stable Code Mode advantage, traditional-provider superiority or general
complex-software effectiveness follows from this sample.

Local raw records are `ssh-storage-{direct,codemode}-v1/`, sibling `.log`,
`.trace.jsonl`, `.providers.json`, `.tools.json` and `-evidence/` under
`.cache/atomic-codemode/`. Derived checks are `storage-model-costs.json`,
`storage-answer-checks.json` and `storage-answer-review.json`. Final answer
SHA-256 values are Direct
`d5b64cfec3236cae4357160148578b597e7fe8115b62e57bc77fee7eb027d022`, Code
`0d2937dc1054e3e8405a4bbd428a3f753d2ab07c6a839d7ee798bfe7f642f69f`.
These hashes identify the reviewed answers, not an automated correctness proof.

## Resource-limited repository gate

The separate full `npm run check:fast` did not finish. The guarded run stopped
at the 3 GiB early threshold after 44.290 s; a serial retry using the installed
Turbo 2.11.7 documented `--concurrency=1` option also stopped there after
26.823 s during typecheck. Last sampled memory.events have zero OOM/kill/max
events. Payload-exit/final counters are unavailable for these aborted runs;
neither is reported as a passing full gate. The guards remained enabled and
the model trials ran after these checks terminated. Changed-module lint and
format checks, all 87 experimental JS tests and the real-provider checks above
pass. Production-wide type checking remains unverified within this resource
budget; no unrelated main code was changed to bypass it.
