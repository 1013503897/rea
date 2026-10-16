# SQLite indirect-dispatch oracle

Freeze this question/oracle before measured model launches. The question supplies
a function name, two formats and selected case values, without code/table/graph
addresses. This is a scoped investigation. Both atomic adapters share facts;
no traditional-provider cell exists for its required native identities. The
direct client also has its own JavaScript executor.

Target: Debian SQLite `3.40.1-2+deb12u2` amd64,
`/usr/lib/x86_64-linux-gnu/libsqlite3.so.0` -> `.0.8.6`, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
Final engine SHA-256:
`a9ca8a8ac224936afb08a9d4be9c1225feb69473ad9f35764e8d1c4f04875b5b`.

Callable entries `0x288f0` and `0xea6d0` share the VDBE name; the two format
references establish owning entry `0xea6d0` before deep analysis. Names do not
establish runtime binding. One snapshot has 21,349 recovered operations, 35,755
values, 1,229 blocks, zero omitted definitions and one indirect branch:
`0xea801:fe`, block 8. The switch facet has 182 labelled rows and mappings,
149 distinct targets/edges, partial=false, and zero missing/no-label/unmapped/
unknown-target rows. Consumed mask is `0xff`; signed_render_hint=false is not
itself an unsignedness proof.

The current selector is eight-byte `v100031675` at `register:0x10`, defined by
`0xea7f6:c353 CPUI_INT_ZEXT`. Its one-byte input `v10000024f` is defined by LOAD
`0xea7e1:de`. Those widths/definitions are verified in structured native facts.
The machine reads one byte, indexes through R15B/EDX, computes a target in RAX
and jumps through RAX. The normalized BRANCHIND input is not that jump address.
Storage offsets do not specify arbitrary computed contents.

Independent GNU disassembly and ELF program-header/file reads establish:

| Address | Bytes          | Machine fact                    |
| ------- | -------------- | ------------------------------- |
| 0xea7e1 | 440fb638       | MOVZX R15D,byte [RAX]           |
| 0xea7e5 | 4180ffb5       | CMP R15B,0xb5                   |
| 0xea7e9 | 0f87a9010000   | JA 0xea998; fallthrough 0xea7ef |
| 0xea7ef | 488d0d121f0400 | LEA RCX,[0x12c708]              |
| 0xea7f6 | 410fb6d7       | MOVZX EDX,R15B                  |
| 0xea7fa | 48630491       | MOVSXD RAX,dword [RCX+RDX*4]    |
| 0xea7fe | 4801c8         | ADD RAX,RCX                     |
| 0xea801 | ffe0           | JMP RAX                         |

Table base is `0x12c708`: 182 entries for zero-extended byte values `0..0xb5`,
each a signed little-endian 32-bit displacement added to the base. Local
`.cache/atomic-codemode/sqlite-switch-machine-oracle.json` records all bytes,
file offsets and 149 unique targets, reconstructed before native verification.
Both MCP paths compare all 182 native labelled rows to that independent table.

| Case / row | Table address | Raw bytes / signed displacement | Native edge -> block | Original target |
| ---------- | ------------- | ------------------------------- | -------------------- | --------------- |
| 0x0 / 0    | 0x12c708      | d814fcff / -256808              | 8:0 -> 1140          | 0xedbe0         |
| 0x2a / 42  | 0x12c7b0      | a8e7fbff / -268376              | 8:34 -> 864          | 0xeaeb0         |
| 0x34 / 52  | 0x12c7d8      | e8e5fbff / -268824              | 8:42 -> 778          | 0xeacf0         |
| 0x39 / 57  | 0x12c7ec      | e8e5fbff / -268824              | 8:42 -> 778          | 0xeacf0         |
| 0xb5 / 181 | 0x12c9dc      | 16eefbff / -266730              | 8:8 -> 1011          | 0xeb51e         |

The middle pair shares an edge/target but keeps distinct case identities.
Row and edge ordinals differ: row 181 maps to edge 8. Relations carry case_id
and a separate relation id; multiple edges share case_id and page separately.

Native model default: `8:42`, block 778, origin `0xeacf0`, raw default index 42,
default_is_folded=false. Known values `0x34..0x39` share it. It is not the
machine out-of-range guard destination `0xea998`. No explicit native row is
labelled `0xb6`. If the selected local byte were `0xb6`, unsigned JA bypasses
the table and reaches `0xea998`; this does not prove that such input occurs.

Grade the complete answer and trace: correct ownership before one VM capture,
selected case reads, source-byte versus normalized-selector widths, row/edge
identities and shared targets, selected raw displacement arithmetic, the two
different defaults, real source IDs/digest and static coverage limitations.
No whole case inventory/C report/graph fetch, source field/opcode-name guesses,
SQL trigger or runtime binding claim. Full recovery does not prove complete
machine flow, memory aliases, nontermination or feasible inputs. Producer
equality is not independent machine/IR equivalence. Include discovery, schema
reads, errors/retries, all responses and final answers in whole-task costs.
