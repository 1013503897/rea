# Shared native byte reads: checkpoint

The user cleared the active goal after implementation and real preflight.
Work stopped before new model trials. No PR or merge into main is requested.
Main was refreshed to `5112fe07a` in `2dc3820b6`. LeanToken returned not_indexed
for this experimental path; scoped native reads were used instead.

Opt in with `REA_ATOMIC_NATIVE_BYTE_BATCH=1` and an exact experimental native
engine pin. Unset/0 preserves single-window acquisition. The 19 shared methods,
22 Direct tools and four Code Mode tools are unchanged. The byte batch reads
only selected static loaded-image ranges; no target execution or modification.

`disassemble/kuna_batch.rs` shares one existing ConsoleProgram load, range
resolution, mapped-end clipping and data renderer across at most 16 windows /
64 KiB selected bytes. It rejects ignored options and bounds encoded output
against the existing 8 MiB capture ceiling. Each native row retains its exact
request, ordinal and success or window_unavailable error. Global load or report
encoding failure fails explicitly. The old read path can initialize again when
a bounded anonymous region lacks a name; this is source-derived reasoning, not
a measured count of internal translator initialization.

`NativeByteBatchReads` caches validated exact address/length facts for this target
lease, deduplicates missing ranges, batches only missing work and preserves caller
order. Source + source_row identify a window in retained raw Evidence; duplicates
or reordered calls can share that row. Partial reads remain partial. Successful
siblings survive bad per-row data; global failures preserve cached facts. Transient
capture failures are not cached here. Close clears the cache. Its retained entries
are bounded by source admission (128 sources times at most 16 windows); no global
cache or live-memory freshness claim is added.

Old and new byte reports use one normalization owner. Exact JSON numeric tokens
preserve u64 aliases and reject rounded fractional counters, with shared KunaJson
support; alias disagreements fail instead of publishing contradictory facts.
Original-file mapping and runtime memory remain unknown/not-observed.

## Executed evidence

- Native disassemble tests: 15 passed, including the two new protocol/budget tests.
- Runtime build passed; final experimental JS tests: 128 passed.
- Kuna reference files/ranges boundary tests: 27 passed.
- Changed-file lint/format, module boundaries, affected-source typecheck and
  converted actual MCP schema/catalog checks passed.
- Real SDK, Direct and Code Mode LLVM checks passed all prior five literal-query
  goldens, paging, projection, exact ten independent byte windows and 13 complete
  retained source hashes per lane.
- Both actual MCP adapters passed SQLite mixed success/error, short reads,
  repeated exact windows and the full 64 KiB request.
- Same-engine SDK comparison passed reordered/duplicate reuse, mixed cached/new
  windows, all raw hashes and stale Evidence rejection after reopen.
- Actual producer cancellation preserved cached facts in partial_observation,
  allowed a fresh retry and completed owned cleanup. Target bytes were unchanged.

The existing full repository typecheck memory refusal is not a pass. No full
check:fast/check:pr, full native workspace gate, new architecture/provider parity,
or new real-model result is claimed for this phase. Earlier model outcomes retain
their own immutable revisions. The prepared byte-batch oracle is unexecuted by models.

## Same-engine acquisition comparison

Both runs use engine `bce4dc97fda99a028aca6b2b40a0a593c87b5224ac9e03221a69313faba2d3e8`, the same LLVM artifact and independent
file oracle. Only acquisition is toggled between 0 and 1. Cold means a new lease,
not dropped OS caches. These are single scripted observations with no model tokens.

| Phase                       | Single-window ms / CPU s |  Batched ms / CPU s |
| --------------------------- | -----------------------: | ------------------: |
| cold_ten_windows            |    94269.834 / 94.110456 | 8505.789 / 8.488729 |
| warm_reordered_duplicates   |         2.598 / 0.002657 |   10.494 / 0.010407 |
| mixed_cached_and_new_window |      6385.777 / 6.374731 | 6446.780 / 6.438594 |

Cold ten-window retrieval drops from about 94.3 to 8.5 seconds. The warm sample
is slower in the batch run; it is retained without claiming a warm speedup.
New unseen windows still incur program initialization. The old workflow retains
11 native sources for the completed task; batching retains two.

| Whole task   |  Wall s | Local family CPU s | Kernel family peak MiB |
| ------------ | ------: | -----------------: | ---------------------: |
| before       | 102.304 |         101.898599 |                  861.9 |
| after        |  16.533 |          16.327818 |                  858.1 |
| cancellation |  15.324 |          15.107833 |                  862.8 |

Counters are verified at payload exit while the observer lives, not final whole-
scope counters. Memory includes charged file cache. Heavy work was serial, one
CPU, hard 4 GiB/no swap, with early stopping at 3 GiB (3.25 GiB for builds).
The first compiled native version was replaced before real provider verification
to distinguish request_address_hex from numeric native address aliases; original
builds/logs remain. No failed run was relabeled as passing.

## Reproduction anchors

The canonical native patch targets Kuna `fe01d6294eb0d1053ce343c8943646df88e143fc`.
Binaries, captures and explicit provider settings remain ignored. Source patch
SHA-256: `56d2cd197bfcab9566c055c32ee0aece4805c7708f0a0117a8fa06a768969055`.

- `native-byte-batch-before-v1.json`: `ec7c9ab21ef91ff6f965d8e6efc9da97c4a6593d19fde660ba5cb2b1c4459dcb`.
- `native-byte-batch-after-v1.json`: `9737291a03ad7c12700bf124134c4c06d4ef5beb8c31dda102eaa5ae0752aa47`.
- `native-byte-batch-cancellation-v1.json`: `6dd58baed164df0747573b143c31f01d12d5d697ca7c3ff4813b545c355d0d18`.
- `native-byte-batch-llvm-sdk-v1.json`: `04d2ee586f376c41d86d1e9c4508c6b84fcb04d71b7ce2aab6b2580169367a1e`.
- `native-byte-batch-llvm-direct-v1.json`: `53be8d5e5ce0f70d015be98d7ac0b500702fb414bd7a0b41be023a660717eff0`.
- `native-byte-batch-llvm-codemode-v1.json`: `d94e171953fcc86a09b38e730564fae0d42068e1d2ac59b5547bd3c4837d5d42`.
