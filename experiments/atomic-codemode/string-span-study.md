# Incoming reference spans and pooled strings

This experiment adds individually traceable incoming reference occurrences for
inclusive target-address spans. It does not establish whole-string use from a
reference into shared storage. No PR or integration is intended.

Before this work, the branch refreshed main to `0c7b6d834` in `c8d831936`.
The native overlay remains based on Kuna `fe01d6294eb0d1053ce343c8943646df88e143fc`.
The immutable tested executable SHA-256 is
`2e398e7229e30b6d2387a802db8a0050764119a6b457020d334855e36e69d6c5`;
the full overlay is `kuna-native-ir.patch`. Node is 24.18.0 / npm 11.16.0.

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
  3,330.8 MiB, sampled OOM=0, final payload counters unavailable. Its processes
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

Real-model results will be recorded separately after the frozen three-profile
trial. No token, general complex-software or adapter superiority claim follows
from these preflights.
