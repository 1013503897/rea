# Main refresh and shared-owner compatibility

The experiment was refreshed from main
`60bf1024592888b5efb78f9c9458b4633da298bd` at merge commit `8e0aa73db`.
This updates only the experimental branch; no PR or integration merge is intended.
The [OpenSSH model comparison](ssh-warning-study.md) remains a historical result
at frozen runtime `09677946c`. Its model runs were not repeated on this new
compiled runtime, and its costs must not be relabeled as current measurements.

## Producing boundaries

Main now requires caller-owned file resources when inspecting Kuna. The session
owns an `ArtifactResourceScope` before attempting an open, including when no
target lease is established. A failed descriptor close keeps its exact owner;
close retries it, and another open cannot acquire a replacement until cleanup
succeeds. The shared native-installation adapter reuses main's error projection
and cleanup leases. The diagnostic native profiler uses the same adapter and
retains its own file scope through final cleanup. No fallback installation
parser or parallel resource manager was added.

Main also replaced the whole-string inventory parser with
`KunaStringInventoryReader`. The experiment feeds its bounded retained source
through that owner and freezes the validated inventory once. The underlying
capture still retains complete source Evidence; this adapter update does not
establish streaming native capture or a new analysis speedup.

The initial source test invocation failed to load the removed string-parser
export. After updating that boundary, 65 Code Mode/API tests and the 15 shared
atomic-fact tests pass. The two new cases verify failed-open cleanup and
replacement admission. Focused lint reports no warnings, and formatting passes.

## Real artifact checks

The unchanged preserved `a9ca8a8a...` experimental engine is used throughout.
Both actual MCP adapters repeat the stripped OpenSSH value task, checking all
250 selected SSA versions and 369 operand occurrences against the earlier
complete native graph. Both caller/emitter function records equal the prior
goldens, including C, calls and graph fields. Each route executes fifteen MCP
requests; these are verification scripts, not new model trials.

A first Code Mode verifier attempt omitted its required evaluator Evidence
directory. Its reads succeeded but its later producer comparison failed. That
attempt remains recorded; the verifier now validates the required setting
before analysis, and both complete reruns pass with separate source directories.

Linux MCP failure injection rejects two close attempts for the actual engine
fingerprint descriptor. Procfs confirms the same descriptor remains open after
the failed initial open and blocked replacement, then disappears after the
successful close retry. The lease stays null until a later open succeeds.
Both adapters also repeat the existing native-close failure/retry scenario.
These failures are injected, not observed OS or engine cleanup incidents.

Real zlib SDK reads preserve cached strings, aliases and source metadata against
caller mutation and verify the complete Evidence digest. SDK cleanup/replacement
retry checks pass on SSH. The native profiler completes two zlib `inflateReset`
captures at `0xbf00` with equal function records; internal timing is disabled.
The generated traditional baseline still contains exactly the sixteen declared
native/session/view tools, matching the earlier corrected manifest. Declared
catalog coverage does not prove every operation's live behavior.

## Executed resource costs

| Scope                              | Family wall s | Family CPU s | Kernel peak MiB |
| ---------------------------------- | ------------: | -----------: | --------------: |
| Locked dependency install          |        20.462 |       19.525 |         1,601.2 |
| Runtime and packaged-skill build   |        85.441 |       84.797 |         2,730.4 |
| Code Mode/API tests, 65            |         4.447 |        4.234 |            87.5 |
| Shared atomic-fact tests, 15       |         0.623 |        0.439 |            43.9 |
| SSH value queries, Code Mode       |         9.382 |        9.146 |           336.5 |
| SSH value queries, direct          |         8.976 |        8.759 |           346.5 |
| Engine descriptor retry, Code Mode |         2.036 |        1.769 |           198.0 |
| Engine descriptor retry, direct    |         1.935 |        1.728 |           184.8 |
| Native close retry, Code Mode      |         1.831 |        1.650 |           188.9 |
| Native close retry, direct         |         1.744 |        1.559 |           182.4 |
| SDK inventory immutability         |         1.530 |        1.285 |           123.8 |
| SDK cleanup/replacement retry      |         1.831 |        1.602 |           128.1 |
| Native profiler, two captures      |         1.931 |        1.683 |           110.2 |
| Actual baseline catalog generation |         3.943 |        3.727 |           438.2 |

All use one CPU, 4 GiB hard / 3 GiB early-stop memory bounds, OOM/kill 0 and
verified payload cleanup. Kernel process-family peaks include charged file
cache, not RSS. Source receipts remain under `.cache/atomic-codemode/main-refresh-*`.
The unsuccessful initial test/load attempt costs 3.138 wall / 2.942 CPU seconds,
79.8 MiB; the incomplete verifier attempt costs 9.181 / 8.941 seconds, 353.2 MiB.
Both also have OOM 0 and verified cleanup.

The successful query verifiers retain separate fresh leases/native caches:

| Phase                                       | Code Mode wall / CPU s | Direct wall / CPU s |
| ------------------------------------------- | ---------------------: | ------------------: |
| Two fresh native captures                   |          7.354 / 7.346 |       7.139 / 7.087 |
| First indexed task, all 250 values/369 uses |          0.233 / 0.234 |       0.167 / 0.168 |
| Same-lease selected one-value/use read      |          0.008 / 0.009 |       0.008 / 0.006 |

The last two rows complete different tasks; they do not measure a warm-task
speedup. The native profiler's fresh/second-process captures take 643.1/453.9 ms,
with private native cache reuse, without separate CPU or peak measurements.
The family table includes startup, capture, reads and cleanup. Cumulative peaks
do not isolate warm memory; OS caches and host contention are uncontrolled.
No new real-agent token measurement was performed in this refresh. Full
repository/native test suites, other providers, and new real-agent comparisons
on this refreshed runtime remain unverified.
