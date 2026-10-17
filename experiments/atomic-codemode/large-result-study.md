# Selective string facts and bounded result encoding

The branch refreshed main to `3e8236639` in `b2a2ab29c` before this work. This is
an experiment with no PR or merge into main. Native Kuna remains pinned to
`2e398e7229e30b6d2387a802db8a0050764119a6b457020d334855e36e69d6c5`.

## Reproduced failure

An atomic object can contain a large field. Paging one row does not bound its
string value. A static Linux ELF contains a 2,101,248-byte plain string and a
1,052,672-byte backslash-heavy string; escaping makes each response exceed 2 MiB.
The fixture is synthetic, never executed, and chmod 0444. Its SHA-256 is
`bc9a2090e71f780771b388da86a57cdeef428ac235ba6b67051fd05cca688b22`.
The portable generator reproduced that digest in a different directory. An
independent ELF PT_LOAD/file check matched both complete generated payloads.

Before the change, real SDK and Direct MCP returned full 2.1 MiB responses.
Code Mode serialized them first, then replaced them with `bridge_budget`. The
inner error lacked context and an Evidence handle; only the outer execution
receipt retained the ID. A guest could not recover using its returned value.
There was no string field selection. The first Direct verifier assumed SDK
input-validation errors were JSON and failed on the deliberately unsupported
`fields` argument. Its corrected probe records that raw MCP rejection explicitly.
Preserve both attempts; this was a verifier assumption, not a provider failure.

## Shared facts, boundary-owned limits

The existing `strings` method accepts optional `fields` selecting `value`,
`provider_value` and `decoding`. `fields:[]` keeps address and encoded metadata,
including encoding, byte extent and NUL status. Identity survives text omission.
Default SDK reads still return full selected values; the VM's transfer limit is
not imposed on SDK callers. One projection serves SDK, CLI, Direct and Code Mode,
using one parsed native catalog per lease. Field/page/query choices do not cause
another native string scan.

One JSON owner measures UTF-8 bytes before allocating expanded JSON, including
keys, separators, escaping, paired/unpaired surrogates, omitted fields, sparse
arrays and repeated references. Cycles and unsupported objects fail explicitly;
accessors, proxies and custom `toJSON` are not invoked. Successful measurements
are exact; refusals report honest lower bounds. Standard `JSON.stringify` still
performs admitted encoding. Tests compare it against the measurement, including
1,500 deterministic Unicode cases and allocation-order checks.

The QuickJS bridge remains 2 MiB. This experimental MCP profile bounds encoded
tool-result bodies at 1 MiB, motivated by observed client truncation. It counts
the second escaping layer and target-content metadata. JSON-RPC framing and
client rendering are separate and can impose other limits. This is an advertised
profile policy, not a universal MCP protocol limit; both modes report it through
`reference.transport_limits`. CLI/SDK have separate transport behavior.

Transport errors keep context, retained Evidence IDs and failure scope rather
than fake empty facts. Existing primary failures remain primary when oversized
diagnostics are omitted. Unsupported JSON differs from capacity. Source collection
uses declared provenance fields, never text resembling IDs. Code Mode can recover
inside one program with metadata or an Evidence window. Call records describe
delivered outcomes and settle after host failures. One shared error projector
handles primitive thrown values. MCP traces record admitted results, avoiding
serialization of discarded large fact payloads.

## Executed verification

- All 101 experimental tests passed. Changed-file lint and formatting passed.
- Real large-string SDK, Direct and Code Mode verifiers passed metadata-first
  reads, default SDK compatibility, contextual capacity errors, cache reuse,
  selected prefixes/tails and five full raw source hashes each. Code Mode also
  recovered inside one actual MCP execution for each oversized call.
- The experimental CLI returned compact metadata for both objects. Actual
  converted catalogs/named string schemas passed valid/invalid field selection.
  Counts remain 19 methods, 22 Direct tools and four Code tools.
- Real SQLite checks through all three interfaces preserved eleven reference
  sites, pages, source rows, NUL/non-NUL facts and machine bytes. Real x86 SSH
  complete-function/prototype fidelity also passed.
- Latest-main runtime build passed: 32.334 s / 32.152036 CPU s, kernel family peak
  3,014.6 MiB. Full `check:fast` was not retried after its earlier bounded refusal.
  No `check:pr`, exhaustive corpus or new Ghidra/Hopper/IDA coverage is claimed.

Without display text the selected response falls from about 2.1 MiB to 1.3 KiB.
These are bytes, not model tokens or a speed claim. Native full-inventory capture
and its 8 MiB bound remain; field selection does not push filtering/decoding into
the producer or prove larger-binary coverage. Source handles last for the lease;
explicit harness copies survive close.

Representative bounded receipts, all verifying payload cleanup and OOM=0:

| Verification                    |                       Wall |                    Local family CPU |        Kernel family peak |
| ------------------------------- | -------------------------: | ----------------------------------: | ------------------------: |
| 101 JS tests                    |                    5.857 s |                          5.659277 s |                  85.8 MiB |
| SDK large-string verifier       |                    3.141 s |                          2.865835 s |                 357.7 MiB |
| Direct large-string verifier    |                    3.543 s |                          3.358844 s |                 378.6 MiB |
| Code Mode large-string verifier |                    3.744 s |                          3.561268 s |                 414.2 MiB |
| SQLite SDK / Direct / Code      | 14.919 / 15.522 / 16.843 s | 14.548969 / 15.177856 / 16.466928 s | 480.6 / 312.0 / 332.9 MiB |
| SSH fidelity                    |                    8.476 s |                          8.230673 s |                 304.1 MiB |
| Actual catalog/schema discovery |                    1.932 s |                          1.752482 s |                 144.7 MiB |

Cold metadata-first calls took 843 / 901 / 967 ms in SDK / Direct / Code Mode;
warm repeats took 1.0 / 3.3 / 37.5 ms. Cold means a fresh lease, not cold kernel
pages. Code Mode recreates its guest per execution. The verifiers do different
validation work: whole-suite peaks/times are not equivalent-task comparisons.
Scripted probes consume no model tokens. Build early stop is 3.25 GiB, analysis
3 GiB; one CPU, hard cap 4 GiB, no swap. Kernel family memory includes file cache,
not just RSS. Verified payload-exit counters are used; final exited-cgroup
counters are unavailable.

The [question](large-string-question.txt) and [oracle](large-string-oracle.md)
are frozen before actual model trials. Keep all outcomes/costs separately. The
old Code Mode refusal is not a successful equivalent timing baseline.
