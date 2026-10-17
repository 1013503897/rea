# Precise encoded-string facts

This experiment preserves native NUL-termination observations through the shared
string contract. The branch refreshed main to `8451d2839` in `ba0ded9a7` first.
It remains an experiment without a PR or merge into main.

The [pooled-string trial](string-span-study.md) exposed a real loss of precision:
Kuna's `nul_terminated` boolean was normalized only to the coarser legacy
`termination: present_or_not_required | missing`. The traditional model correctly
kept raw terminator coverage unknown. A second representation in the public MCP
output contract also omitted `encoding_status`, `provider_value` and `decoding`.
The provider already had those facts; agent-side inference would preserve the
producing-boundary defect.

The domain string definition now includes optional `string.nul_terminated`:

- `true`: the provider reports a NUL code unit terminating this encoded span.
- `false`: the reported encoded span has no observed terminating NUL; it makes
  no claim about bytes outside the span.
- Omitted: that precise provider fact is unknown/unreported.

Kuna's native parser carries its validated boolean directly. The existing coarse
termination field remains compatible. Other providers keep omission when they
do not report this fact; no Ghidra/Hopper/IDA termination behavior is inferred.
The public addressed-value output now reuses the domain string shape, removing
the duplicate metadata representation. CLI, SDK and both experimental MCP modes
consume that owner. This does not introduce another analysis pass or cache key.

## Executed checks

The pinned native engine remains
`2e398e7229e30b6d2387a802db8a0050764119a6b457020d334855e36e69d6c5`.
The real Linux SQLite target remains
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
Node/npm remain 24.18.0/11.16.0. No target was executed.

- All 64 focused tests passed, including 38 native string parser cases,
  production-boundary string queries and official tool contracts. The runtime
  compiled successfully. After a test-helper extraction, the actual SDK output
  schema test passed again. It verifies both string tools after conversion,
  true/false/omitted states, malformed values and preservation of shared metadata.
- Real SDK, Direct MCP and Code Mode range verifiers passed the earlier eleven
  occurrences and new boolean checks. `no such table` and `sqlite_schema` report
  true, independently corroborated by selected loaded bytes.
- A real `.rodata` run at `0x11ee21`, text
  `aceinouyyacdeeghijklnorstuuwyzouaiou`, reports false and 36 encoded bytes.
  The selected byte window matches the text and its following byte is nonzero.
  This is a retained printable run, not proof of a source-level string object
  or the semantics of its consumer.
- The experimental CLI returned true/false correctly. The traditional real MCP
  search also preserved both values, and its complete records authenticated with
  the domain `parseEvidence` owner. The first canonical verifier incorrectly
  expected substring search to return one row; it was corrected to select the
  exact text among all matches. Preserve that failed verifier attempt.
- Changed-file lint passed with the existing large-file warnings. Full root
  `check:fast` was not retried after its earlier bounded memory refusal; neither
  `check:pr` nor real Ghidra/Hopper/IDA verification was run for this patch.
- The ignored product catalog and MCP test catalog were regenerated from the
  built contracts; the converted output-schema checks above inspect the actual
  advertised string facts rather than relying on a generated file alone.

All following successful receipts verify owned payload cleanup and OOM=0:

| Verification                       |     Wall | Local family CPU | Kernel family peak |
| ---------------------------------- | -------: | ---------------: | -----------------: |
| Focused build + 64 tests           | 60.830 s |      58.592501 s |        3,058.8 MiB |
| Final converted output-schema test |  6.569 s |       6.412996 s |          720.4 MiB |
| SDK real verifier                  | 15.024 s |      14.658184 s |          481.6 MiB |
| Direct real verifier               | 15.218 s |      14.882060 s |          313.0 MiB |
| Code Mode real verifier            | 15.926 s |      15.661633 s |          325.7 MiB |
| Canonical MCP verifier             |  3.947 s |       3.773770 s |          408.3 MiB |
| Experimental CLI                   |  1.528 s |       1.333069 s |          159.1 MiB |

The build uses a 3.25 GiB early stop; analysis uses 3 GiB. All are one CPU,
hard memory cap 4 GiB, no swap. Kernel process-family memory includes file cache,
not just RSS. Final exited-cgroup counters are unavailable; the table uses
verified payload-exit observations. These are different verification suites,
not equivalent-task speed comparisons or model token measurements.

The large unfiltered inventory/client truncation gap from the earlier study
remains unresolved by this precision fix. Selected lookup and serialization
bounds still need exploration. Full Evidence remains retained within the lease;
explicit harness copies remain on disk after close.

## Actual model check after the fix

Both fresh isolated model trials completed at runtime commit
`04e0959de4b1fe35feec784faa1252ba22e368ea`, using the same frozen
`sqlite-string-span-question.txt` and `string-span-oracle.md` as before.
The immutable engine and target remained pinned above. Codex was 0.161.0,
requested model `gpt-6.1-sol`, reasoning `high`; the resolved remote build and
server compute remain unmeasured. Direct ran first, then Code Mode, one CPU,
fresh profiles/stores, default 3 GiB early stop. Both use the common client
JavaScript executor; the actual catalogs still have 22 / 4 tools over 19 methods.

Every complete answer was reviewed against the frozen semantic criteria. Both
retain all eleven occurrences/owners and all four offset/count groups, correctly
separate suffixes from full-string use, and establish the RDX transfer, `R13D & 1`
selection, alternate text, RSI format and error call with necessary unknowns.
Both receive the new precise NUL fields in real MCP responses and corroborate
the selected terminators with loaded bytes. This question still asks for byte
verification; the new metadata does not eliminate that requirement. No recovered
IR or target execution was used.

All 12 / 11 cited source IDs were verified against actual traces, target/engine
identity and all 13 / 14 captured raw hashes respectively. Both cited source sets
contain the eight essential machine encodings; their complete native xref row
arrays are identical. API handles expire on close, while explicit harness capture
files remain on disk. This is an agent review, not human PR readiness.

| Whole-task metric             |      Direct |   Code Mode |
| ----------------------------- | ----------: | ----------: |
| Cumulative input tokens       |     224,760 |     189,774 |
| Cached input, included above  |     202,496 |     158,976 |
| Uncached input                |      22,264 |      30,798 |
| Output tokens                 |       4,574 |       4,483 |
| Reasoning, included in output |       1,037 |       1,022 |
| Unique model responses        |          10 |          10 |
| Client exec / wait            |       9 / 0 |       9 / 0 |
| MCP attempts                  |          12 |           9 |
| Rejected calls                |           0 |           0 |
| Reference help calls          |           1 |           2 |
| Fact API reads                |           9 |           9 |
| Native captures               |          13 |          14 |
| Model wall                    |    95.169 s |    90.908 s |
| Whole family wall             |    95.667 s |    91.442 s |
| Local family CPU              | 11.331878 s | 11.989352 s |
| Kernel family peak            |   607.3 MiB |   561.4 MiB |

Unique per-response usage totals match the runner summaries. Cached input and
reasoning are included as labeled, not additional totals. Both verified
payload-exit receipts report OOM=0, cleanup complete, no abort, profiles removed,
and unchanged target, engine and relevant runtime fingerprints. Local memory
includes file cache; remote cache state and latency are uncontrolled. These are
fresh-lease tasks, not cold kernel-cache or warm-model repeat measurements.

Code Mode executes nine API reads within five actual `execute_javascript` MCP
requests. Native work differs: Direct captures six byte windows and four
instruction windows; Code Mode captures five and six. Code Mode uses 15.6% less
cumulative input and 4.5% less model wall, but 38.3% more uncached input and 5.8%
more local CPU, with 7.6% less peak memory. The comparison does not isolate adapter
overhead or attribute changes from the earlier trial to this metadata fix; main,
model choices, cache usage and window selections also differ. It establishes
correct actual model use after the representation repair, not a stable advantage
or broad complex-software superiority.

Answer SHA-256:

- Direct: `d73e1b743bb3064f4087d4b1b809334bebf9f6263e93530e4b6c5e82bbf6455a`
- Code Mode: `54173f190e184d0008c781ee96a2a6ddff05dfa580d099c0c87863dba29fa5f4`

Local artifact SHA-256 (raw provider documents remain uncommitted):

- `nul-model-costs.json`: `b64472e78d5c61f4c86d50bd945116752fe2a84b576e747bd488d569e302765e`
- `nul-answer-review.json`: `5ed65635c31a5dd3bedeb700314424af8fdd08e11657ced00ed59e2bf576358e`
- `nul-answer-checks.json`: `74a8b1c5012500020eeb44b014c612751cd6191ef2c922a9e25937d5cf22dde9`
- `sqlite-nul-direct-v1.log`: `85c495754f96cfaaf44f973bec44f2021f35685b11ff01c7c4baf62959ab8fca`
- `sqlite-nul-codemode-v1.log`: `62be30f49a492c824da128e4157dd4537e99dfa72e2c4ec2e3cae8db4179129e`
