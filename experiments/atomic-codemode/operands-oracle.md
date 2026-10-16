# Wide native operand retrieval oracle

Pinned before any model launch on this question; not supplied to measured models.
This is a seeded relationship-retrieval task in a complex function, not an
unseeded behavior reconstruction, source-level explanation or runtime proof.

Target: Debian SQLite 3.40.1-2+deb12u2 amd64,
`/usr/lib/x86_64-linux-gnu/libsqlite3.so.0` -> `.0.8.6`, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
Engine: preserved `a0685486518e09d3c65f756325a7e9fed8df123a2a988aca2972a72335ce8edc`.

From the retained public-budget native projection: operation `0xea998:14649` is
`CPUI_MULTIEQUAL`, block 1203, output `v30000f159`, 156 native input slots.
It is not dead. Input relationships must retain their own identities even when
four selected slots refer to one value:

| Input index | Value      | Predecessor | Predecessor edge |
| ----------- | ---------- | ----------: | ---------------- |
| 0           | v300034de6 |           7 | 7:1              |
| 1           | v300034de6 |           8 | 8:72             |
| 77          | v300034de6 |         633 | 633:0            |
| 105         | v10000cb23 |         738 | 738:0            |
| 155         | v300034de6 |         668 | 668:0            |

Distinct values and retained immediate definitions:

| Value      | Space  | Offset             | Width | Definition    | Opcode/output                |
| ---------- | ------ | ------------------ | ----: | ------------- | ---------------------------- |
| v300034de6 | stack  | 0xfffffffffffffec0 |     8 | 0xea7d8:146d5 | CPUI_MULTIEQUAL / v300034de6 |
| v10000cb23 | unique | 0x23e00            |     8 | 0xebd6c:1a344 | CPUI_CAST / v10000cb23       |

Both values are nonconstant, nonannotation and not native function inputs.
Their offsets are storage offsets, not computed values or machine destinations.
Slot 156 is absent for this retained 156-slot operation. `0xffff:0` is not
retained; its existence outside the projection remains unknown, not an empty
operation. Selected operands plus definition identities suffice; no complete
input array, C report, exhaustive graph or transitive slice is required.

Public projection: 4,096 operations, 7,469 values and 326 definition-frontier
entries. Complete recovered CFG is unavailable; uses concern the retained set,
aliases and runtime feasibility remain unknown. Selected immediate definitions
are retained, without closing the global frontier. Evidence references and
target digest must be real. These producer-gold identities were also compared
to the earlier full diagnostic capture; neither is independent machine/IR proof.
