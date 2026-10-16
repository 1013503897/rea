# Stripped OpenSSH warning/caller oracle

Freeze before real-model launches. All lanes receive the same
[question](ssh-warning-question.txt), without code addresses or precomputed
facts. This oracle accepts equivalent machine-supported answers; native SSA IDs
are optional, so a traditional provider can satisfy the same question.

Artifact: `/usr/bin/ssh`, Debian `openssh-client 1:9.2p1-2+deb12u10` amd64,
1,129,504-byte stripped PIE ELF. SHA-256:
`04f2ff5f506a3f332e7adeb1478a4c551ae74acdd328e6fb5c2495664d4064e6`.
All lanes use preserved engine `a9ca8a8ac224936afb08a9d4be9c1225feb69473ad9f35764e8d1c4f04875b5b`.
Native profiles differ: atomic captures selected functions, whereas the
traditional assembly query waits for its whole-program export. Report this as
a workflow comparison, not a causal dispatch-only ablation.

Independent GNU disassembly from the selected entries, ELF byte reads and
unwind FDEs establish the machine oracle. FDE ranges are
`0x25cb0..0x25e6b`, `0x280c0..0x2a4d8`, and the other caller's
`0x2a4e0..0x2aad1`. GNU's nearest exported-symbol labels in the stripped binary
are not original function names. No target execution or source-repository answer
is used. Embedded logging labels may support a labelled inference, not binding.

Required local facts:

- Banner format `0xc8628`, reference instruction `0x25d14`, owner `0x25cb0`.
  The strict diagnostic is `0xc9018`, reference `0x28e6c`, owner `0x280c0`.
  The banner function has two captured incoming calls: `0x28d53` from `0x280c0`
  and `0x2aa97` from `0x2a4e0`. Select the first caller by the second diagnostic,
  not by address/name ordering. Reference discovery remains incomplete globally.
- Caller `MOV RDI,R15` at `0x28d50`, direct CALL `0x28d53 -> 0x25cb0`.
  At warning entry RDI is saved to R13 (`0x25cbc`) and remains the incoming
  pointer at the first helper CALL `0x25cc3 -> 0x42c20`. No original source
  parameter ordinal or pointee contents are established by this fact alone.
- Banner LEA `0x25d14` loads `0xc8628` into RAX; `0x25d29` stores it at
  caller pre-CALL `[RSP]`; direct CALL `0x25d2f -> 0x68480`. Five initial
  register pushes, a later `SUB RSP,8` and one further push place this slot at
  warning-entry RSP minus 56. CALL adds its return address, so the same slot is
  callee-entry `RSP+8`. This is a machine-derived stack coordinate, not a source
  signature guessed from recovered input ordinal 7.
- The caller later loads four bytes from `0x1144c8` into R8D at `0x28e58`,
  TESTs R8D at `0x28e63`, and JE at `0x28e66` goes to `0x28b70` for zero.
  Nonzero falls through to `0x28e6c`, sets up the strict diagnostic and calls
  the same formatting/logging entry `0x68480` at `0x28e8d`.
- After that call, `0x28e92`/`0x28e93` pop two stack slots and
  `0x28e94` jumps to cleanup `0x285d1`. The returning cleanup path writes
  `EAX=0xffffffff` at `0x28617` and jumps to common epilogue `0x29619`.
  Report low 32 bits `0xffffffff` (signed 32-bit -1), not an invented original
  prototype or unverified all-ones 64-bit value. Other calls/stack checks may
  prevent this path returning at runtime.
- The banner call occurs before this local policy decision. Selecting it does
  not alone prove rejection. Zero enters further checks at `0x28b70`; it is not
  proof of acceptance, successful login or any actual runtime path/output.

Optional native corroboration: warning format PTRSUB `0x25d2f:469` feeds input
7 of call `0x25d2f:85`, with passing `stack:0x8/8` and raw stack offset
`0xffffffffffffffc0`. Caller `0x28d53:779` passes one value in
`register:0x38/8`; warning input `v30000002e` has the same location and feeds
`0x25cc3:1e` input 1. The identities belong to separate snapshots. Native guard
`0x28e63:891` compares `v50000a21b` (four-byte RAM version, defined by
`0x28e53:67cd`) against zero and produces a one-byte Boolean. Its CBRANCH
`0x28e66:896` selects recovered blocks 85/86; its normalized polarity/display
label is not a statement about hardware ZF. Independent machine bytes control
the required successor interpretation. Location lookup finds 250 versions and
369 occurrences here; neither enumeration nor an alias-completeness claim is
required for the analyst question.

Preparation checks are recorded in [the value-query study](value-query-study.md).
Real traditional MCP preflight also returns the string, exact xref, selected C
and assembly successfully with the same engine (97.609 family wall / 97.090 CPU
seconds, 822.5 MiB kernel peak). Its assembly request takes about 81.9 seconds
waiting for whole-program export. That is an unmeasured-model preparation run,
not a scored task. Fresh measured leases use separate empty cache paths.

Use complete atomic catalogs (18 direct / 4 Code Mode tools), and an explicitly
focused traditional client allowlist while leaving its production catalog
complete. All clients already expose JavaScript dispatch; whole-task usage must
include schemas, discovery, errors, waits and retries. Use identical common
envelope/stopping, exact-name discovery and long-wait guidance, requested
`gpt-6.1-sol/high`, Codex 0.161.0, isolated workspaces and one-CPU / 4 GiB hard /
3 GiB early-stop bounds. Freeze runtime/HEAD during the three runs and report
target/engine freshness, cleanup and every unavailable scope. No PR/merge.
