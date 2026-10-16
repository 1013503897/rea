# Architecture storage composition oracle

Freeze this question, runtime, full catalogs and oracle before the real models.
The question extends the [function-boundary question](function-boundary-question.txt)
with exact native storage names and address-space descriptors. All correctness
criteria and independent instruction checks in the [boundary oracle](function-boundary-oracle.md)
remain required. This is a new task; old timings are not an equivalent before/after
comparison. No addresses, counts or tuple/name answers are embedded in the prompt.

The selected artifact remains `/usr/bin/ssh`, SHA-256
`04f2ff5f506a3f332e7adeb1478a4c551ae74acdd328e6fb5c2495664d4064e6`.
Both lanes use the same immutable experimental engine SHA-256
`c48ad95784ce7b26beb966b054fe103b11922c8aa8cbe7c4144f3daa1d5d45fe`,
upstream `fe01d6294eb0d1053ce343c8943646df88e143fc` plus the committed overlay.
The full earlier function records must remain unchanged except the previously
added parameters facet; adding the CLI metadata operation must not alter IR.

The bootstrapped model is `x86:LE:64:default:gcc`, default code space `ram`.
Its canonical exact register map contains 1,440 rows, and its nine populated
spaces fill nine native index slots. The required descriptors are:

| Space    | Index | Native kind    | Address bytes | Unit bytes | Endianness |
| -------- | ----- | -------------- | ------------- | ---------- | ---------- |
| ram      | 3     | IPTR_PROCESSOR | 8             | 1          | little     |
| register | 4     | IPTR_PROCESSOR | 4             | 1          | little     |
| stack    | 8     | IPTR_SPACEBASE | 8             | 1          | little     |

Banner native slots 0–3 name RDI, RSI, RDX, RCX respectively. Caller slots 0–5
name RDI, RSI, RDX, CX, R8, R9D; its four stack tuples have no retained exact
register-map match. Caller return storage names RAX. Explicit void on the
banner output is preserved; it has no return storage to name. Same-offset
caller CX (two bytes) and banner RCX (eight bytes) are different exact tuples.
No subregister/alias relation or original ABI follows from that observation.

The selected caller value `v10000a9cf` has own storage register:0xb8/8 (R15),
whereas CALL `0x28d53:779` passes it in register:0x38/8 (RDI). Banner slot 0 and
its matched input `v30000002e` have RDI storage; the first helper call uses it
at recovered operand 1. Different snapshot-local SSA identities must remain
separate. The machine MOV/call/helper evidence stays independently required.
Native exact metadata names these coordinates; it does not establish live
memory, source signatures, runtime binding, aliasing or general stack rebasing.

Score the complete final answer, delivered native/source identities and target
digest, the original counts/indices/flags/exact input matches, all new tuple/name
and space descriptors, selected transfer plus machine corroboration, coverage
and lease close. Record every real attempt, including failure. Both actual
MCP routes receive all nineteen methods (twenty-two direct tools or four Code
Mode tools), the same question, requested gpt-6.1-sol/high and isolated profiles.
Native caches are fresh per lease; OS/model caches and model build are unknown.
Compare whole-task tokens, outputs/reasoning, calls/retries/waits, elapsed/CPU
and kernel family memory. No native-only traditional-provider cell is invented.
