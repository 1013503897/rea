# Native string query projection

This is an opt-in experiment, with no PR or merge into main. Main was refreshed
to `cc2e18a26` in `c8469c844` before the new model freeze. The native overlay is
based on Kuna `fe01d6294eb0d1053ce343c8943646df88e143fc`, not stock Kuna support.
Native engine SHA-256: `be6d1882b436c04cb37c73ae30683cd2cce91804930197ece30e2a16a9a31ec9`.
Canonical patch SHA-256: `c3929224d83c844ee1e53367806c074994463f605afab32fabe0efcc497d04e3`.
Scoped source reads were used after earlier LeanToken internal/not-indexed errors.

## Analyst question and boundary

Find selected literal-bearing string objects in a large binary, then compose
metadata, full values when needed, loaded-image byte windows and bounded source
Evidence. The existing strings/bytes/evidence contracts remain the shared SDK,
CLI and MCP implementation; Direct and Code Mode keep the same 19 methods.
No target execution, annotation or mutation is added.

The old retained-inventory profile cannot answer the LLVM query within its
64 MiB per-lease source budget. Its complete standalone native producer golden
is 171,833,514 raw bytes / 602,544 candidates; the golden was collected outside
REA's bounded transport and is not a successful historical public workflow.
The target is Linux libLLVM-16.so.1, SHA-256
`f62d254b7f2bf42df8c8b07d46ee3bb4c2cafeca436b2e6bc6ccbe4581f58f40`.

## Ownership and costs

`REA_ATOMIC_NATIVE_STRING_QUERY=1` explicitly selects a caller-pinned native
query profile on Linux x86-64; unset/0 preserves the retained-inventory path.
There is no fallback that claims stock engines implement these flags. Native
`strings/kuna_query.rs` owns literal matching, canonical address/encoding order,
full match counts, selected pages and bounded JSON projection before constructing
a whole JSON inventory. JavaScript UTF16 literal semantics are preserved through
hex-encoded units, including NUL and unpaired surrogates. Matching is literal,
not the legacy regex engine with a backtracking cutoff. Ill-formed unit queries
use linear KMP without per-candidate UTF16 arrays. The host checks encoded argument
size before allocating against this verified Linux profile's 128 KiB single-
argument ceiling. Native output is bounded to remaining source quota; text is
borrowed by an escape-aware bounded writer. Oversized selected text retains
metadata with explicit omission; a metadata report that cannot fit fails.

`NativeStringQueryReader` validates exact request identity, integer tokens,
counts/pages, source ordinals, extents, text presence and literal matching.
Production `KunaStringFacts` owns normalization for both old inventories and
new projected reports. `requireNativeCaptureFacts` binds validated facts to the
SourceStore's exact bytes/hash and attaches readable Evidence to decoder failures.
The old duplicate normalizer and per-reader address schema are removed. Kept
integer counters cannot silently round fractional JSON tokens into valid facts.

Artifact + address + encoding identify a candidate. source_row is its canonical
ordinal under the declared scan settings. Each query/page/text choice can have
its own selected-report source; a complete capture is not a complete inventory.
Discovery remains unknown, references not computed. Native UTF16 recognition
still covers little-endian Latin units, not arbitrary wide Unicode. Exact keys
reuse validated facts within a lease; a full view can satisfy metadata when an
exact metadata view does not already exist. Clear/close ends that lifetime.

Fresh queries still construct all FoundStrings and scan the whole candidate
inventory. Different literals/pages/text views can rescan; there is no reusable
native index or cross-session cache. Small selected output does not establish
sublinear analysis. Likewise the byte-window batch still launches native reads
per distinct window; LLVM loading dominates these small byte reads. This is an
observed shared-work optimization opportunity, not hidden by Code Mode batching.

## Verification scope

The complete old producer golden is streamed and hashed, retaining at most the
first 16 rows per test query. It establishes producer fidelity for totals,
matching, source ordinals, metadata, text and paging, not independent recognizer
completeness. `verify-string-query-machine.py` independently parses ELF64 PT_LOAD
and checks all five selected diagnostic spans and exact byte windows. The frozen
[question](native-string-query-question.txt) and [oracle](native-string-query-oracle.md)
permit equivalent valid compositions; they do not prescribe ten native commands.

Native argument/profile negatives, literal metacharacters, emoji and lone units,
a late match after a 2M prefix, paging and escaped text omission have 15 passing
Rust tests. Protocol tests distinguish malformed facts from empty results and
exercise exact argument capacity, projection cache identity, partial metadata and
retained failure provenance. These simulated checks do not establish native
provider behavior. Actual provider and model outcomes are recorded below after
completion; pending checks are not treated as passes.

## Real provider preflight

Actual SDK, Direct MCP and Code Mode LLVM verifiers pass five literals (including
empty, absent unpaired surrogate and literal metacharacters), full golden totals,
metadata/text projection, second pages, repeated cache/source identity, bounded
Evidence, ten independent loaded-image windows and all 22 raw source hashes per
lane. The new engine's default retained-inventory mode also passes FFmpeg in all
three lanes, including raw inventory fidelity and stale-handle checks. Artifact
bytes remain unchanged and all payload-exit process-family cleanup is verified.

| Completed verifier      |  Wall s | Family CPU s | Kernel family peak MiB |
| ----------------------- | ------: | -----------: | ---------------------: |
| LLVM SDK                | 106.738 |   106.312880 |                  844.9 |
| LLVM Direct MCP         | 108.247 |   107.842665 |                 1035.1 |
| LLVM Code Mode          | 107.956 |   107.425840 |                 1042.4 |
| Legacy FFmpeg SDK       |   7.066 |     6.774320 |                  343.8 |
| Legacy FFmpeg Direct    |   7.369 |     7.031261 |                  435.9 |
| Legacy FFmpeg Code Mode |   7.570 |     7.337361 |                  441.6 |

These whole verifiers include multiple distinct query/page/text captures and ten
native byte loads. Scripted checks have no model tokens. The first SDK query
examines 602,544 candidates, finds four matches and returns a two-row metadata
report of 744 raw bytes, not a whole 171,833,514-byte inventory. Its cold call is
1,685.945 ms / 1.685564 CPU s; exact warm reuse is 0.802 ms / 0.000878 CPU s.
The ten selected byte windows take 93,099.473 ms / 92.987812 CPU s in that SDK
run; Direct and Code Mode take about 94 s for the same reads. No claim of faster
native byte analysis follows from a smaller query result. Cold here means a new
lease/capture, not dropped OS caches; distinct query captures are not warm cache
hits. Historical whole-inventory refusal is not an equivalent completed task.

Family counters are verified at payload exit with the observer still alive,
not final whole-scope counters. Kernel peaks include charged file cache, not
summed RSS. Heavy work is serial under one CPU, a 4 GiB hard memory ceiling,
3 GiB early stop (3.25 GiB for build/typecheck), no swap and 192 tasks.

Preserved unsuccessful attempts: an accidental uncached debug Cargo invocation
was stopped in its owned scope (241; not a test pass); the first nullable-error
protocol failed 3/6 adapter tests and was replaced at the producing native
boundary by explicit flat status fields. Original logs remain. Full root
`npm run typecheck` stopped at the 3.25 GiB early guard (125), without OOM; it
is not a pass. That attempt predates the latest main refresh. Affected-source
checks and the runtime build are separate from a full repository test typecheck.
No full check:fast/check:pr or new Ghidra/IDA/architecture corpus pass is claimed.

Final prefreeze checks: latest-main runtime build passes, all 79 affected boundary
tests and 122 experimental JS tests pass after the final reader ordering/owner
cleanup, and affected-source typecheck, changed-file oxlint, module boundaries,
converted MCP schema/catalog checks and the actual experimental CLI all pass.
The first format check found only the appended study's table formatting; it was
formatted and the changed-file format check passed. No failing format result is
counted as a pass.

Both real Node binaries also pass positive metadata-only CLI queries for
`MODULE_NOT_FOUND`: Node 24 has native total 19, system Node 20 total 15. Each
selected two-row report is 731 bytes. Independent ELF PT_LOAD/file checks verify
both selected spans, literal presence and reported termination in each binary;
the totals remain native-relative. Earlier zero-match probes for `undefined
symbol` are retained separately and do not establish positive-match fidelity.
Selecting this profile against the preserved pre-query engine returns typed
`execution_failure` on unsupported flags, never fabricated empty facts.

Preparation outside the tables (golden acquisition/streaming, independent oracle,
compilation/tests, compatibility and Node probes) is separate from model-task
costs. Their local logs are retained; these are not model input token savings.
The LLVM old/full golden and current selected reports have different scope.

## Local evidence anchors

Raw captures, binaries, provider settings and full transcripts remain ignored
under `.cache/atomic-codemode`, not committed. Key artifacts and SHA-256:

- `native-query-llvm-golden/manifest.json`: `5c672c77807cd84e10b84f239512aebfb7b35cc2a60e0b4fc126234a39792de6`.
- `native-query-llvm-golden-selected.json`: `4d5244c5b5d8d249b15e83b5cbf177e1fcbd88bb7a01fb926e4fec9620de7004`.
- `native-query-machine-v1.json`: `033f787c5402f44c9d82deba4020700837002c73b7eb4729d83c36dfad1b5d40`.
- `native-query-machine-sdk-v3.json`: `b98167a9d3673428d9d54fa6c7dd7db1d06bbf402816bd6f5b3a90943f1c9579`.
- `native-query-machine-direct-v3.json`: `7ab54892247386a42746ea6c9df89236de00b5abe94cac930d43651085b22e7b`.
- `native-query-machine-codemode-v3.json`: `e7d610c7c2c894ce64de07d2c0e67de75ff0fdf6e74cee185a83a8ce66f43903`.
- `native-query-node-byte-review.json`: `53a18f5aa43134135449a8d9accb723c652e79929f718bfc79411fc396d198aa`.

The model question and oracle are committed before either new model run. Real
model outcomes and full task costs will be added after reviewing original answers
and all cited sources; no model result is inferred from scripted preflight.
