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

## Frozen actual model trials

Both isolated model runs completed at runtime
`185bf90c417150904067eb9b3f89e69a06c2dc8e`, using the precommitted question/oracle,
the same ELF and native engine, serially in fresh profiles/stores. Codex was
0.161.0; requested model `gpt-6.1-sol`, reasoning `high`. The resolved remote
model build and server compute remain unmeasured. Both have the common client
JavaScript executor; Code Mode actually invokes the isolated MCP execution tool.

The Code Mode answer passes every frozen criterion. Direct obtains correct
metadata, byte counts, source identity and actual bytes, but its final table
labels two **17-byte** hex prefixes as the requested first 16. It requested
19/21-byte full-marker windows, which the provider returned correctly with
explicit `returned_bytes`; the error occurs in answer-level slicing/reporting.
Therefore Direct fails the exact-window reporting criterion. No model rerun or
answer repair is substituted for that original failure.

Code Mode requests 16-byte heads and nine-byte tails, then reports the required
eight tail bytes correctly. The second tail returns only eight, with an explicit
native note that the segment ends at exclusive `0x704002`; the answer preserves
that partial read. Independent ELF headers corroborate the boundary. Both use
`fields:[]` immediately: no large text is returned to model context, no capacity
retry is needed, and both demonstrate the same retained source through a small
Evidence read. Scripted tests, rather than these model paths, exercise recovery.

All five cited IDs in each answer match actual traces and retained native records.
All five raw files per lane pass artifact/engine identity and byte/hash checks.
Both have one inventory capture and four byte captures. Full source values stay
in the provider/harness, while selected MCP responses remain small. API handles
expire on close; explicitly retained harness copies remain on disk. This is
agent review of complete answers against the frozen oracle, not human readiness.

| Whole-task metric                    |                     Direct |  Code Mode |
| ------------------------------------ | -------------------------: | ---------: |
| Frozen semantic result               | fail: 17 bytes labelled 16 |       pass |
| Cumulative input tokens              |                    128,284 |    105,724 |
| Cached input, included above         |                    114,432 |     94,464 |
| Uncached input                       |                     13,852 |     11,260 |
| Output tokens                        |                      2,141 |      2,602 |
| Reasoning, included in output        |                        379 |        922 |
| Unique model responses               |                          7 |          7 |
| Client exec / wait calls             |                      6 / 0 |      6 / 0 |
| MCP attempts                         |                          7 |          6 |
| Rejected requests / capacity retries |                      0 / 0 |      0 / 0 |
| Reference help calls                 |                          1 |          2 |
| Fact API reads                       |                          4 |          4 |
| Native captures                      |                          5 |          5 |
| Model wall                           |                   51.906 s |   62.413 s |
| Whole-family wall                    |                   52.485 s |   62.936 s |
| Local family CPU                     |                 7.003758 s | 7.008494 s |
| Kernel family peak                   |                  652.2 MiB |  648.8 MiB |

Code Mode makes two actual `execute_javascript` requests containing four API
reads; Direct makes four fact requests. Unique per-response token sums match
runner summaries. Cached input and reasoning are included as labeled, not added
twice. Both verified payload receipts show OOM=0, no abort, complete owned cleanup,
profiles removed and unchanged artifact/engine/relevant runtime fingerprints.
These are fresh-lease observations, not cold kernel-cache or warm-model repeats;
remote cache state and latency remain uncontrolled.

The smaller Code Mode input does not establish faster analysis: it takes longer
wall time here, CPU is nearly identical, and the byte-window choices differ.
Because only Code Mode passes the exact reporting criterion, costs cannot rank
these profiles at matched answer correctness. This synthetic capacity task also
does not establish superiority on complex applications. It demonstrates actual
model use of the corrected selective interface and exposes a separate model
reporting failure; the real SQLite/SSH regressions establish their narrower scopes.

Answer SHA-256:

- Direct: `6dc8454b87c9a0c6e2e579e7f00bc970e92e5b7ef5586378ee1db4ba23e2212d`
- Code Mode: `ee8386d9d27210d5b862b5d6d9a067c4f6058eb5940415f47e0f5a9dbe9a8d34`

Local artifact SHA-256 (raw provider documents are uncommitted):

- `large-string-model-costs.json`: `6d85d001d5233a92aa3a6efdd3942d4e89c1bfb244eb955adb708a15c194dd6d`
- `large-string-answer-review.json`: `b7453d6bc77ae85a208aa70340db1b72ad6612606b2e008b9303388bdb59c26f`
- `large-string-direct-v1.log`: `4673f3f478294925ec8c7c641e55f6e5c631f1ad235d04c2a4dc7383e857f9ce`
- `large-string-codemode-v1.log`: `8d19907adb44d1a3e7c5d1959e9187f105294c4396b9d550aa60481f848f272a`
- `capacity-before-sdk.log`: `738424765c116728fbf134b69738023628ff06462525dc67cf509526604017e7`
- `capacity-before-v2-direct.log`: `0ba462c0d79f90fed6bad1b2116136fb5d54e95420bfbc1abf2c0b53142c574e`
- `capacity-before-v2-codemode.log`: `fad93da28b481481f7c386b3c7ed7e801da19edb9d541730bce77a9bde1b1ee3`
