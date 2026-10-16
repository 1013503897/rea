# Real-model trials (ongoing)

The first trial used the committed `5aa1c5c64` runtime, requested model alias
`gpt-6.1-sol` with high reasoning, Codex CLI 0.161.0 and the zlib question in this
directory. The resolved server-side model build is not inferred. Its actual
registered MCP server name was `rea-codemode`, with only the four Code Mode tools.
Shell/file tools, web search, delegation and client-side Code Mode were disabled;
the actual trace establishes server-side `execute_javascript` use.

The model independently found the string and xref, requested the owning function's
snapshot, used operations/relations/slices and inspected reconstructed C. Its
answer identifies both error-block branches, the message/STORE origins, wrapper
bit condition and modulo-31 check, and correctly distinguishes local guards from
runtime reachability. It names memory, phi, traversal-budget and CFG limitations.
It records the exact target digest and real source Evidence IDs and closes the
target. These observations agree with the previous independent machine-byte and
arithmetic oracles; this is one stochastic local-question trial, not evidence of
general RE superiority.

| Measurement                                  | First Code Mode trial |
| -------------------------------------------- | --------------------: |
| Completed outer MCP calls                    |                    14 |
| Actual API calls                             |                    30 |
| Reconstructed C page reads                   |                    16 |
| Native source captures                       |                     3 |
| Cumulative model input tokens                |               581,617 |
| Cached input tokens (included above)         |               530,176 |
| Output tokens                                |                 3,822 |
| Reasoning output tokens (included in output) |                   869 |
| Model runner wall seconds                    |               130.348 |
| Bounded family elapsed seconds               |               130.824 |
| Bounded family CPU seconds                   |                11.842 |
| Kernel process-family memory peak MiB        |                 540.7 |
| OOM kills                                    |                     0 |

Artifact bytes were unchanged. The copied-authentication profile was removed;
both owner/observer cleanup checks passed. Memory includes charged file cache.
Actual token usage is cumulative across turns, including discovery and retries,
not a tokenizer estimate of the final answer. Cached and uncached tokens are
reported separately without assigning an unverified price.

The first empty workspace was nested beneath the trial output directory in the
repository. No source or oracle was copied into it and shell/file tools were
disabled. Subsequent trials move the profile under `/tmp` to remove ancestor
repository-instruction discovery as a possible confound. The first trial must
not be silently relabeled as having that stronger isolation.

The trace exposes two design shortcomings. Reference lookup supplied parameters
but omitted result shapes, making initial calls sequential shape discovery.
The C reader's arbitrary 128-line maximum made code compose many page reads even
though the complete function easily fits guest memory. Return contracts and
byte-budgeted internal C reads are being tested next. The missing native CFG and
phi predecessor relationships remain capability gaps, not problems to conceal
with reconstructed-C guesses.

Private captures remain under `.cache/atomic-codemode/zlib-codemode-v1/`, with
`events.jsonl`, `codex-tool-context.jsonl`, `answer.txt`, `summary.json`, explicit
trial settings and cleanup proof. The adjacent trace retains actual model code
and inner API calls; the `*-evidence/` directory retains the three complete native
sources and their identity/digest metadata. Credentials and raw captures are not
committed. Direct atomic, revised Code Mode and traditional-provider trials have
not yet established an equivalent completed-task comparison.
