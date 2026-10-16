# Phi alternatives through bounded native facts

Fix `sqlite-projection-question.txt` and this oracle before either model launch.
Both lanes receive the same fourteen methods, native engine, model/effort request,
common guidance and resource bounds. This is a seeded follow-up investigation,
not discovery from an unknown entry. The task differs from counting boundary
calls, so its costs are not a before/after speedup comparison with that task.

Artifact: Debian SQLite `3.40.1-2+deb12u2`, `libsqlite3.so.0.8.6`, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
Implementation entry is `0xea6d0`, with a distinct same-name PLT entry.

Real public projection verification and comparison with the earlier full native
diagnostic graph establish these retained identities. The complete graph remains
unavailable; bounded operations/values are available. It is not necessary for the
answer to enumerate every global budget/counter or all unselected frontier IDs.

| Call origin / identity | Recovered RSI value | Immediate PHI definition |
| ---------------------- | ------------------- | ------------------------ |
| `0xf115c` / `0xf115c:6a84` | `v1000340ac` | `0xf1152:cf0f` |
| `0xf238b` / `0xf238b:7130` | `v100033f25` | `0xf238b:ceb7` |

Both calls resolve through native call specifications to `ram:0x296c0`.
RSI is recovered input slot two, with passing storage `register:0x30/8`;
that slot is not an established source parameter ordinal. The immediate
definitions are `CPUI_MULTIEQUAL`, not a guessed linear register assignment.

| PHI | Operand index | Value ID | Native predecessor / edge | Defining producer |
| --- | ------------: | -------- | ------------------------- | ----------------- |
| `0xf1152:cf0f` | 0 | `v1000118a8` | `1087` / `1087:0` | `0xf2086:6a72` |
| `0xf1152:cf0f` | 1 | `v10001358b` | `1153` / `1153:0` | `0xf1146:7560` |
| `0xf238b:ceb7` | 0 | `v100012a75` | `1142` / `1142:0` | `0xf2381:712c` |
| `0xf238b:ceb7` | 1 | `v10001352e` | `1158` / `1158:0` | `0xf2437:753c` |

Each producer is native `CPUI_PTRSUB` with two nonannotation constant-space
operands, zero and the following exact u64 offset, both width eight. The addresses
are independently checked through machine LEA instructions; do not treat PTRSUB
as arbitrary integer subtraction or a native origin as a physical branch target.

| Producer origin | Verified address | NUL-terminated format text |
| --------------- | ---------------- | -------------------------- |
| `0xf2086` | `0x12c600` | `cannot change %s wal mode from within a transaction` |
| `0xf1146` | `0x12c698` | `no such savepoint: %s` |
| `0xf2381` | `0x12c500` | `cannot open savepoint - SQL statements in progress` |
| `0xf2437` | `0x12c538` | `cannot release savepoint - SQL statements in progress` |

GNU objdump decoding from the exported VM entry independently verifies all four
LEA origins and addresses. `0xf208d` jumps to `0xf1152`, whose local setup reaches
the `0xf115c CALL 0x296c0` (`e85f85f3ff`). The alternate release setup jumps at
`0xf2446` to `0xf238b`; that CALL targets `0x296c0` (`e83073f3ff`). Open setup
locally reaches the latter call. These selected static transfers do not establish
runtime path feasibility, memory stability or full function control dependence.

Independent direct file reads check these string bytes only after `readelf -lW`
binds addresses to identical file offsets in the read-only LOAD segment
`0x11a000..0x154bfc`. Native loaded-image byte queries have their own source IDs.
The byte sequences, including terminators, occupy 52, 22, 51 and 54 bytes in the
table's order. Adjacent bytes must not be merged into the reported format.

Required final facts: correct entry/target digest and facet scope; both call/PHI
links, all four operand-to-producer alternatives with predecessor edge IDs; the
four correct addresses and strings; verified LEA/call/jump facts; real Evidence;
one VM analysis with subsequent reads reusing its snapshot; clear limits for
unexpanded definitions, complete uses/CFG, aliases and runtime behavior. Judge
these facts and source arguments separately from answer verbosity or RPC count.
The oracle and repository are absent from the isolated model workspace.
