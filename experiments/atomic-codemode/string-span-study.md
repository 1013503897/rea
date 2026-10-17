# Incoming reference spans and pooled strings

This experiment adds individually traceable incoming reference occurrences for
inclusive target-address spans. It does not establish whole-string use from a
reference into shared storage. No PR or integration is intended.

Before this work, the branch refreshed main to `0c7b6d834` in `c8d831936`.
The native overlay remains based on Kuna `fe01d6294eb0d1053ce343c8943646df88e143fc`.
The immutable tested executable SHA-256 is
`2e398e7229e30b6d2387a802db8a0050764119a6b457020d334855e36e69d6c5`;
the full overlay is `kuna-native-ir.patch`. Node is 24.18.0 / npm 11.16.0.
Overlay SHA-256: `e41a5db0c1f5849f869357624e9792f5472934021deec0af04b11e5eba478c47`.
Frozen question SHA-256: `416a38d34dbae10209222d691f2f714fb5a7f830ed0ca2766e5ec0e1152344e3`.
Frozen oracle SHA-256: `13ae75b0ff4e19a57ead242b05bebba5a0313a82861783ea4c7474005a4d5cdb`.

## Existing capability and missing composition

Native Kuna already aggregates xrefs and owner functions over a string's encoded
extent. Its string output does not include each reference's source/target pair.
REA's cheap inventory intentionally skips that analysis; the existing reference
operation selects exact addresses, so complete occurrence retrieval previously
required enumerating the encoded span. This is an interface/composition gap,
not evidence that Kuna had no string-span aggregation.

On real Linux SQLite, exact `no such table` occupies `0x11b376–0x11b383` and
`sqlite_schema` occupies `0x11b33f–0x11b34c`, both including NUL. Base-address
queries return one occurrence each; their full spans retain seven and four.
Nine interior occurrences target the `table` / `schema` suffixes. Calling all
seven references uses of the complete error message would be wrong. The frozen
[task oracle](string-span-oracle.md) separates occurrence completeness, symbol
membership, bytes, register passing and conditional message selection.

## Implementation and bounds

The existing named `references` operation accepts explicit `ranges`, preserving
the old exact-address and outgoing-function selectors. CLI, SDK, Direct MCP and
Code Mode use the same contract and owner. There remain 19 named methods, 22
Direct tools and four Code Mode tools. Both advertised catalogs were validated
after actual SDK conversion, including valid/invalid reference selectors.

The native BTreeMap index owns sparse inclusive range lookup, including u64 max
without end-address increment. The string aggregate also uses this owner,
removing its per-byte lookup loop and quadratic function deduplication. Legacy
and range wire rows share endpoint/function interpretation and one JSON escaping
writer. A batch builds one index, supports 16 spans and 128 selected rows per
span, and streams into an 8 MiB encoded-output budget. Selected row pointers are
bounded; serialization failure returns an error without partial JSON stdout.
These bounds cap native work/serialization and match the experimental fact page.

The TypeScript provider boundary owns exact u64 parsing, row consistency and
normalization for both formats. Range metadata binds by explicit query index,
not catalog/array order. Overlapping and duplicate caller ranges remain separate;
`source_row` indexes the retained batch's original flat xrefs array. It is not a
global occurrence ID. Malformed or unavailable data remains an error with source
Evidence where captured, never an empty observation.

Native capture cache keys cover target/engine identity, ordered spans, kinds,
offset and limit. Fields project the same retained source. One immutable parsed
range batch is retained per lease and cleared after successful close. Different
pages still rebuild a native index; this is not a persistent analysis database.
Coverage explicitly leaves discovery, indirect targets, runtime binding, memory
access overlap and whole-string use unknown/not established. Target-coordinate
membership does not expand import aliases or establish all bytes touched by an
access.

## Executed verification

- Native release tests: 25 `listing::xrefs`, two range CLI tests and 15 JSON
  writer tests passed, including sparse/full-u64 selection, selector conflicts
  and escaped-byte streaming bounds. Release binary rebuilt after final changes.
  A real one-byte output-budget query exited with the explicit capacity error and
  zero stdout bytes, confirming fail-closed serialization at the CLI boundary.
- Focused production boundary: 23 existing reference tests plus four new range
  groups passed (27 total), with full runtime compilation. Focused owner graph
  typecheck, changed-file lint and formatting passed. Full `check:fast` was
  attempted but stopped at the 3.25 GiB threshold after 45.806 s; sampled peak
  3,329.9 MiB, sampled OOM=0, final payload counters unavailable. Its processes
  exited after owned-scope cleanup. This is not a passing full root typecheck.
  `check:pr` and an exhaustive native corpus were not run. Experiment pushes
  bypass the resource-limited pre-push gate rather than repeat it unbounded.
- All 90 experimental JavaScript tests passed. Five resource receipt/policy
  tests passed, including rejecting unsafe bounds before process acquisition.
- Real SDK, Direct MCP and Code Mode range verifiers passed all eleven exact
  occurrences/owners, field projection/source reuse, overlaps, repeated spans,
  empty u64-max page, pagination, selected bytes/instructions, raw source hashes
  and source-row traceability. Each verified cleanup.
- The public experimental CLI ran `string-span-example.txt` and returned totals
  seven/four. Native string aggregate JSON remained semantically identical to
  the previous engine, including counts and function lists. Real x86 SSH complete
  function/prototype fidelity and AArch64 xref/return verifiers passed on the new
  engine. Targets were never executed.
- `verify-string-span-machine.py` independently passed ELF loaded bytes, all
  eleven selected GNU LEA targets, exported function interval membership, RIP
  displacement math, mask/CMOV bytes and the two ELF PLT-slot relocations.
  This is not a proof of dynamic binding or global xref completeness.
- The canonical native overlay passed forward application against a temporary
  upstream index and reverse application against the owned patched worktree.

The first public SDK attempt exposed a stale registry refinement that rejected
the new selector despite the standalone contract passing. That redundant guard
was removed; the regression now checks the final registry, and the second SDK
attempt passed. Preserve the failed attempt (`range-sdk.log`) in the record.
An initial focused build crossed the default 3 GiB early stop, without OOM. A
validated optional threshold allows the build to use 3.25 GiB; its successful
focused run took 35.964 s / 35.703191 CPU s, peak 3,084.7 MiB. The hard cap
remains 4 GiB, swap zero, one CPU and 192 tasks. Analysis/model runs retain the
default 3 GiB early stop. Payload-exit counters verify cleanup and OOM=0 for all
successful bounded runs here; kernel process-family memory includes file cache,
not just RSS. Exited transient cgroup final counters are unavailable.

## Measured equivalent reference task

The exact-address baseline enumerates both 14-byte spans and retains all raw
sources. The new range query obtains the same eleven occurrences and owners
with one native batch. These are reference-phase measurements after inventory
selection, not complete model costs; cold means fresh lease/capture cache, not
cold kernel file pages. The same new engine is used in both rows.

| SDK reference workflow   | Cold wall | Local family CPU | Warm wall |
| ------------------------ | --------: | ---------------: | --------: |
| 28 exact-address queries |  48.123 s |      47.791799 s |  9.899 ms |
| One two-span batch       |   1.821 s |       1.806206 s |  0.984 ms |

The selected cold phase is about 26.4 times faster. This is shared native work,
not a Code Mode speedup. Old-engine exact enumeration also agreed on every fact
and took 46.806 s. The independent Direct and Code Mode batch preflights took
1.755 / 1.798 s cold and 3.066 / 9.542 ms warm. They have different transport
overheads and are single observations, not benchmark distributions.

Whole verifier resource receipts (which include additional validation queries):

| Run                       |     Wall | Local family CPU | Kernel family peak |
| ------------------------- | -------: | ---------------: | -----------------: |
| New-engine exact baseline | 50.557 s |      50.055582 s |          475.6 MiB |
| SDK range verifier        | 14.616 s |      14.279055 s |          482.7 MiB |
| Direct range verifier     | 15.120 s |      14.742037 s |          312.6 MiB |
| Code Mode range verifier  | 15.630 s |      15.257697 s |          331.8 MiB |

These suites have different validation work; their peak values do not establish
an equivalent-task memory reduction. Scripted checks have no model token usage.
Raw receipts/captures live in the ignored `.cache/atomic-codemode/range-*` paths.
Selected receipt SHA-256 values:

- `range-exact-after.log`: `cb1d19a4f58face2d442868add0289c3ca62f070ef14f5e4bf0cc101b3bd9ed8`
- `range-sdk-v2.log`: `f203ab548d7509b37a15c39aaf8e466e61f7591eddcb1868be97477811a698c8`
- `range-direct.log`: `c4efbcee95e087fa676b560f70bbb8f6617475be122289c3052f19af02efb2b8`
- `range-codemode.log`: `1d967347c31c99f8caf71391502a7e24ef5fcdcaaaddc5c8d1272eb5b8d7eeae`

The baseline is reproducible with `measure-reference-spans.mjs BINARY NEW_JSON`;
the new batch and full source checks use
`verify-reference-ranges.mjs BINARY NEW_JSON sdk|direct|codemode`.
Configure the pinned engine and an explicit new capture directory as described
in the experiment README, and run through `resource-run.py`.
After the model runs, the published baseline runner was independently executed
with its cleanup-lineage checks. It preserved every earlier baseline fact,
hashed all 29 sources, and measured 47.705 s cold reference work / 47.434659 CPU s;
the full verification took 50.254 s / 49.800140 CPU s, peak 467.8 MiB, OOM=0.
This confirmation does not replace the original measurements above.
Receipt `range-measure-committed.log` SHA-256:
`6bd573663889cfc447f2098dbe4ea6f88dc8688c74e66dc0d33ab660904fc861`.

## Frozen real-model comparison

All three isolated Codex model runs completed at runtime commit
`4158e8a05041a661ccc1d1d2ebe0fb51e409f2e7`, using the same target, immutable
engine, [question](sqlite-string-span-question.txt) and precommitted oracle.
The order was traditional, Direct, Code Mode, serially on one CPU. Each had a
fresh profile/provider store and the common client JavaScript executor.
Codex was 0.161.0, requested model `gpt-6.1-sol`, reasoning `high`; resolved remote
model build and server-side compute are unmeasured. Target, engine and relevant
runtime fingerprints remained unchanged during every trial. Profiles and owned
payload processes were cleaned up; verified payload-exit OOM counts were zero.
These are fresh model-task observations, not repeated warm model trials or a
controlled kernel-cache benchmark. Remote cache state and latency are uncontrolled.

Each complete answer passes the semantic task: both exact spans, all eleven
distinct sites and owners, the four offset/count groups, suffix versus whole
text, RDX transfer, the `R13D & 1` / CMOVNE selection, alternate message, separate
RSI format pointer and selected error call. All preserve unknown runtime binding,
values, paths and global discovery. All three solve the task without recovered
IR. This is an agent review against the frozen machine oracle, not human readiness.

Source verification is narrower for the traditional answer. All 15 cited IDs
occur in actual records; 14 complete Evidence records pass the domain owner's
`parseEvidence` semantic-ID authentication and target/engine checks. Its full
string-inventory reply contains a client truncation marker, making the
captured JSON invalid; the complete original inventory Evidence cannot be
authenticated from that transcript. A separate real SDK reread authenticated
the same inventory query and selected string facts under a **new** Evidence ID.
It does not repair or authenticate the original truncated payload. Preserve
this partial audit instead of claiming all sources passed. The first reread's
expected-same-ID assertion failed; it is an audit assumption error, not a Kuna
failure. Both reread attempts and their costs remain recorded separately.

Direct's 13 cited sources and Code Mode's 11 were verified against their actual
traces, artifact/engine identity and all 17 / 14 raw capture hashes respectively.
Both cited source sets contain the eight essential machine instruction encodings
from the independent oracle; their complete native reference row arrays are
identical. Lease API handles expire on close; the explicitly requested harness
capture files remain available on disk.

Whole-task measured costs, including discovery, schemas/help, rejected calls,
responses and waits:

| Metric                                | Traditional, 16 tools | Atomic Direct, 22 tools | Code Mode, 4 tools |
| ------------------------------------- | --------------------: | ----------------------: | -----------------: |
| Cumulative input tokens               |               737,902 |                 228,562 |            164,927 |
| Cached input, included above          |               687,744 |                 205,184 |            132,992 |
| Uncached input                        |                50,158 |                  23,378 |             31,935 |
| Output tokens                         |                 7,112 |                   4,644 |              4,632 |
| Reasoning tokens, included in output  |                 1,986 |                   1,075 |                969 |
| Unique model responses                |                    20 |                      10 |                  9 |
| Client exec / wait calls              |                15 / 4 |                   9 / 0 |              8 / 0 |
| MCP attempts                          |                    64 |                      12 |                  9 |
| Rejected MCP requests                 |                    10 |                       0 |                  0 |
| Reference help requests               |                     — |                       1 |                  2 |
| Fact API reads                        |                     — |                       9 |                  9 |
| Native captures in experimental store |            unmeasured |                      17 |                 14 |
| Model-run wall time                   |             315.591 s |               102.258 s |           93.580 s |
| Whole-family wall time                |             316.080 s |               102.810 s |           94.063 s |
| Local family CPU                      |          194.830897 s |             12.859835 s |        11.768235 s |
| Kernel family peak memory             |           1,285.5 MiB |               567.3 MiB |          583.9 MiB |

Unique per-response usage totals match each runner summary. Cached input is part
of cumulative input, not an additional amount; reasoning is part of output.
No byte-to-token estimate substitutes for these observed counters. Kernel peaks
include charged file cache and are not RSS; final transient-cgroup counters are
unavailable, while the payload-exit observer receipts verify these values.

The traditional model enumerates all 28 bytes, makes nine rejected interior-entry
lookups and one rejected ambiguous-name lookup, then retrieves a function catalog
and eight complete function assemblies. These are actual model choices and valid
exact-entry/ambiguity errors, not evidence of a broken provider. It also requests
the large unfiltered string inventory that triggers client truncation. All remain
charged; no model lane was rerun to select a favorable result.

Code Mode performs nine fact reads within five actual `execute_javascript` MCP
requests. It batches related inventory, byte, reference, instruction and name
work and returns selected results. Direct performs the same nine API operation
reads, but selects six instruction windows versus Code Mode's three; native
captures and executed work therefore differ. Direct's initial decode-start
choices require corrected focused reads. Equal API call counts do not establish
equal native work or isolate adapter overhead.

In this sample Code Mode reduces cumulative input by 27.8% and model wall time by
8.5% relative to Direct, while using 36.6% more uncached input and 2.9% more peak
memory. It is not a win on every cost. Both atomic workflows avoid much of the
traditional entry-mapping/body-reading work. Only the atomic interface exposes
the new span occurrence query, so comparisons with traditional combine capability
selection and interface design. The earlier mixed results remain valid; this
single selected SQLite task does not establish broad complex-software superiority
or a stable Code Mode advantage.

Two further gaps are now observed: the common string descriptor maps native
`nul_terminated` to the coarser `present_or_not_required`, and an unfiltered
traditional inventory can exceed the client's context transport. Preserve finer
facts at their owner and bound default selection before returning large results;
do not teach agents to repair malformed JSON. Those changes were not made during
this frozen trial. Range-page index reuse, memory alias analysis, indirect/runtime
calls and provider parity also remain unproven or outside this patch.

Model answer SHA-256 values:

- Traditional: `da7d92f57abf7730f465dc5c0c391a3873ebe9298ce2ffc2b0453975c31f44be`
- Direct: `9f5ea70573bb6c7df3d88c565eab79a9a7dceb413cdb80740ff1a8b51e5f8ced`
- Code Mode: `827eb8d0c76aa9dd68ffe7359c059ad2e9f91cb829bc8893f29e63771701e575`

Local review/cost artifact SHA-256 values (raw provider documents are uncommitted):

- `span-model-costs.json`: `587b3efc8fa301c2fc35fcb85a708759c8adbba97a2fe212ad7950c8e4cc7ae8`
- `span-answer-review.json`: `0d392ac4c4717cff147c07b6b09afce2bbf8c2a552ddb22e17b6b151106b1e9b`
- `span-answer-checks.json`: `016855470499fcc00652843f68ac20ba25704c845274cbd33af4a7759aeec3d3`
- `span-machine-source-checks.json`: `18ae9d0209a6a18b674ae154d94a4fadf18efad9231cbee417423baa2d7b42d0`
- `span-evidence-authentication.json`: `7039ce16f03c29ac51d59ea5c75f61726390c930b3bdfacc3e004b1d4f3b36d9`
- `sqlite-span-traditional-v1.log`: `a1445d3efc44205786d69f36ca5dfeea753a5b931ea5d84362b534fe5c84c370`
- `sqlite-span-direct-v1.log`: `f1df216f45bc9b21711e211232fabd811cc90d85fe33ebd151ffb17e3ab882a0`
- `sqlite-span-codemode-v1.log`: `e57c831511294c898bcc3977ea66c2b44b2c0e8deb60baf83d0bfc25bc74662c`
