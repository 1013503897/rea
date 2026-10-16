# Savepoint format/control oracle

Pinned before model trials; not provided to measured models. This question gives
a function name and messages, not entry, instruction, graph or value addresses.
It is still a scoped local investigation, not general unseeded reconstruction.
Both atomic adapters share the same native facts and authority. No traditional
provider cell exists for this question, whose required graph identities are not
a fair provider-independent outcome for such a cell.

Target: Debian SQLite `3.40.1-2+deb12u2` amd64,
`/usr/lib/x86_64-linux-gnu/libsqlite3.so.0` -> `.0.8.6`, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
Preserved engine: `677b9795d49a65e459054ecbd3c0df37d603b541d72df9f74b46778947ed3936`.

The exact-name inventory has entries `0x288f0` (16 bytes) and `0xea6d0` (32,384
bytes), with identical names and no aliases. The inventory alone does not label
PLT versus implementation. Incoming data references from the two strings identify
the owning `sqlite3VdbeExec` entry `0xea6d0`; the CLI reproducer verifies this
composition. Do not select by catalog order or claim the name establishes binding.

| Format                                                | Address / NUL-inclusive bytes | Producer / block    | Merge input                |
| ----------------------------------------------------- | ----------------------------- | ------------------- | -------------------------- |
| cannot open savepoint - SQL statements in progress    | 0x12c500 / 51                 | 0xf2381:712c / 1142 | 0, v100012a75, edge 1142:0 |
| cannot release savepoint - SQL statements in progress | 0x12c538 / 54                 | 0xf2437:753c / 1158 | 1, v10001352e, edge 1158:0 |

Both `CPUI_PTRSUB` format producers use constant-zero input 0 and the eight-byte
address constant at input 1. Both feed PHI `0xf238b:ceb7` in block 1159, output
`v100033f25`, passed in RSI (eight-byte register storage at `0x30`) at recovered
input index 2 of shared CALL `0xf238b:7130`. The native target is `ram:0x296c0`,
label `sqlite3VdbeError`, independently verified as the machine direct CALL target;
runtime binding and complete source signatures remain unknown.

## Local recovered conditions

| Setup               | Controller / CBRANCH     | True edge / destination | False edge / destination | Condition           |
| ------------------- | ------------------------ | ----------------------- | ------------------------ | ------------------- |
| open, block 1142    | block 1141, 0xedc01:7065 | 1141:1 -> 1142          | 1141:0 -> 1143           | v100012864, ne-zero |
| release, block 1158 | block 1157, 0xf0389:71b8 | 1157:1 -> 1158          | 1157:0 -> 1161           | v100012bd9, ne-zero |

The open condition is one-byte `v100012864`, defined by
`0xedc01:7064 CPUI_INT_SLESS`: input 0 is four-byte constant zero
`v30001285f`; input 1 is four-byte `v100012840`, defined by
`0xedbf8:7056 CPUI_LOAD`. Thus the local recovered guard is a **signed** positive
loaded 32-bit value, not an unsigned nonzero test.

The release condition is one-byte `v100012bd9`, defined by
`0xf0384:71b3 CPUI_INT_EQUAL`: input 0 is four-byte `v10001280a`, defined by
`0xedbe5:7041 CPUI_LOAD`; input 1 is four-byte constant one `v3000393a3`.
Its local guard is equality to one. Both load contents and aliases remain unknown.
Models need not invent source member names for either memory object.

Derived controllers return precisely the two relations above for dependents
1142/1158 in the actual retained-source replay. Coverage is complete for finite
paths to recovered zero-successor exits; nontermination and runtime reachability
remain unknown. These are direct/local control relations, not all transitive
earlier guards or proof of feasible execution.

## Independent selected machine evidence

GNU objdump over the same ELF independently supplies these bytes/transfers;
ELF file/virtual mappings also verify their raw bytes. The complete recovered
graph, including these identities, deeply equals the earlier diagnostic native
golden. That producer comparison is not independent machine/IR equivalence.

| Address | Bytes          | Machine fact                    |
| ------- | -------------- | ------------------------------- |
| 0xedbe5 | 8b7004         | MOV ESI,[RAX+4]                 |
| 0xedbec | 89742440       | MOV [RSP+0x40],ESI              |
| 0xedbf8 | 418b9dd8000000 | MOV EBX,[R13+0xd8]              |
| 0xedbff | 85db           | TEST EBX,EBX                    |
| 0xedc01 | 0f8f6b470000   | JG 0xf2372; fallthrough 0xedc07 |
| 0xf0384 | 837c244001     | CMP dword [RSP+0x40],1          |
| 0xf0389 | 0f849e200000   | JE 0xf242d; fallthrough 0xf038f |
| 0xf2381 | 488d3578a10300 | LEA RSI,[0x12c500]              |
| 0xf238b | e83073f3ff     | CALL 0x296c0                    |
| 0xf2437 | 488d35faa00300 | LEA RSI,[0x12c538]              |
| 0xf2446 | e940ffffff     | JMP 0xf238b                     |

The earlier load at `0xedbe5` and spill at `0xedbec` correspond to the native
value later compared at `0xf0384`; selected bytes do not prove all intervening
memory/runtime behavior. Machine setup/branch windows and native optimized CFG
edges are separate evidence representations. PHI is an IR operation at a shared
origin, not a machine instruction.

Expected recovered coverage is now a full block-member graph: 21,349 operations,
35,755 values, 1,229 blocks and zero omitted definition IDs. It includes 416
recovered calls; 395 known CALL targets and 21 unresolved CALLIND targets. This
does not establish full machine-flow/call coverage or memory alias resolution.
The previous call-rooted projection lacked both CBRANCH/Boolean definitions and
the open-path LOAD, as well as all CFG access; those absences remain recorded.

Grade the complete answer and actual trace, not keywords alone: both formats and
shared call/PHI alternatives, both edges for each local condition, precise Boolean
and memory widths/signedness, focused machine checks, real source IDs/digest,
scope/earlier-guard/alias/nontermination/runtime limits, and retained-capture reuse.
