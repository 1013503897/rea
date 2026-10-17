# Frozen real FFmpeg inventory task

Target: Linux `/usr/lib/x86_64-linux-gnu/libavcodec.so.59.37.100`, 14,955,104
bytes, SHA-256 `28c258cc42cbaf9813bf91b41666d2b8063d10aa77aaaf424fac0079f6497b7e`.
It is read statically and never executed. Native engine remains pinned to
`2e398e7229e30b6d2387a802db8a0050764119a6b457020d334855e36e69d6c5`.

Independent ELF PT_LOAD/file reads establish the two selected encoded byte runs.
The preceding byte and each final byte are NUL. Each display text ends with LF;
there are 27 text bytes and 28 encoded bytes including NUL. Each query matches
one retained ASCII object, `nul_terminated:true`, in the pinned native inventory.

| Text query                 | Address  | Inclusive end | First 16 bytes                   | Final 8 bytes    |
| -------------------------- | -------- | ------------- | -------------------------------- | ---------------- |
| Invalid extradata size: %d | 0xb52f2e | 0xb52f49      | 496e76616c6964206578747261646174 | 7a653a2025640a00 |
| Unsupported codec version! | 0xba3ed1 | 0xba3eec      | 556e737570706f7274656420636f6465 | 7273696f6e210a00 |

Both queries share one captured inventory in one lease. Its raw JSON is
16,810,900 bytes and contains 60,601 validated rows. These size/count facts are
producer fidelity, not an independent proof of complete artifact-wide string
recognition. Exact raw hashes include the private input pathname, so source IDs
and hashes differ by lease. Source metadata must say `capture_complete:true`;
that means the stdout capture completed, not that every possible string was
recognized. A bounded source window must actually be read and match that source.

Grade full original answers against this oracle, actual selected-byte replies,
all cited IDs and complete retained raw captures. Preserve false/unknown coverage,
failures and exact window lengths. Do not repair or rerun a model answer to pick
a winner. Direct and Code Mode share the same 19 fact methods; both clients have
common JavaScript orchestration. Code Mode must actually call its isolated MCP
execution tool. Record all schemas/help, responses, calls/retries, input including
cached and uncached input, output including reasoning, wall, local CPU and kernel
process-family peak. Unknown remote costs remain unknown.

The old experimental interface cannot answer this task: it refuses the complete
native inventory at its 8 MiB buffer limit before selecting rows. That original
failure is separate from successful completed-task adapter costs. No successful
historical workflow timing, complex-program reasoning superiority, broad provider
parity, cross-session caching or stable Code Mode speedup is implied.
