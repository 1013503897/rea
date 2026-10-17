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

The same frozen pooled-string question and oracle will be used for the next
real Direct/Code Mode check. Record its outcomes separately rather than
attributing any timing difference to this small metadata change alone.
