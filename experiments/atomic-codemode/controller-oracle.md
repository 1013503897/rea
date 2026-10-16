# Two-level recovered controller oracle

Freeze this oracle and [question](sqlite-controller-question.txt) before model
launches. Both lanes get the same question without addresses, native IDs or
precomputed paths; this oracle stays outside their isolated workspace. Complete
catalogs are eighteen direct tools or four Code Mode tools over the same API.
The question requires native identities/derived relations absent from the
traditional catalog, so there is no traditional-provider cell or parity claim.
Both clients already expose JavaScript dispatch.

Target: Debian SQLite `3.40.1-2+deb12u2` amd64
`/usr/lib/x86_64-linux-gnu/libsqlite3.so.0.8.6`, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
Engine SHA-256:
`a9ca8a8ac224936afb08a9d4be9c1225feb69473ad9f35764e8d1c4f04875b5b`.
REA was refreshed from main `4838f444939677107902549c59b73439e14d3ae9`
before this work. Freeze runtime/HEAD during both runs. Request
`gpt-6.1-sol/high`, Codex 0.161.0, common exact-name/envelope/stopping/long-wait
guidance, fresh leases/private caches, one CPU and 4 GiB hard / 3 GiB early-stop
bounds. Charge all discovery, retries, waits and actual model usage. Preserve
native timing variation and incomplete attempts.

## Formats and first-level controllers

References select VM entry `0xea6d0`, rather than same-name stub `0x288f0`.
Open format `0x12c500` is produced by `0xf2381:712c` in block 1142; release
format `0x12c538` by `0xf2437:753c` in block 1158. PHI `0xf238b:ceb7`, output
`v100033f25`, binds slots 0/1 to incoming edges `1142:0`/`1158:0`. Shared CALL
`0xf238b:7130` in block 1159 takes this format at input 2, with eight-byte
`register:0x30` (RSI) passing storage. Target `ram:0x296c0`, native label
`sqlite3VdbeError`, does not establish a complete source signature or runtime
binding.

The complete direct controller set of block 1159 is exactly:

- Block 1141, CBRANCH `0xedc01:7065`: selected `1141:1 -> 1142`, true/ne-zero;
  other `1141:0 -> 1143`, false/ne-zero. One-byte condition `v100012864` is
  defined by `0xedc01:7064 INT_SLESS`: slot 0 four-byte zero `v30001285f`,
  slot 1 four-byte `v100012840` from LOAD `0xedbf8:7056`. Guard: signed loaded32 > 0.
- Block 1157, CBRANCH `0xf0389:71b8`: selected `1157:1 -> 1158`, true/ne-zero;
  other `1157:0 -> 1161`, false/ne-zero. One-byte condition `v100012bd9` is
  `0xf0384:71b3 INT_EQUAL`: slot 0 four-byte `v10001280a` from LOAD
  `0xedbe5:7041`, slot 1 four-byte one `v3000393a3`. Guard: loaded32 == 1.

## Exactly one further level

- The complete direct set for 1141 is block 1140, CBRANCH `0xedbf2:7054`.
  Selected `1140:0 -> 1141`, false/ne-zero; other `1140:1 -> 1149`, true/ne-zero.
  One-byte `v10001282b` is `0xedbf0:704e INT_NOTEQUAL`: slot 0 four-byte
  `v10001280a`, LOAD `0xedbe5:7041`, slot 1 four-byte zero `v10001282d`.
  The selected edge negates NOTEQUAL: loaded32 == 0.
- The complete direct set for 1157 is block 1156, CBRANCH `0xf0382:71ab`.
  Selected `1156:1 -> 1157`, true/ne-zero; other `1156:0 -> 1161`, false/ne-zero.
  One-byte `v100012bc0` is `0xf0382:71aa INT_SLESSEQUAL`: slot 0 four-byte
  one `v500038ab1`, slot 1 four-byte `v100012b9e`, LOAD `0xf0378:719d`.
  Guard: signed loaded32 >= 1.

Open outer and release inner comparisons share exactly `v10001280a` (P).
Conjoining their selected predicates would require P == 0 and P == 1. These
are alternatives, not simultaneous prerequisites. Locally open combines
P == 0 with signed S > 0; release combines signed T >= 1 with P == 1.
These are not complete VM-entry path conditions or a demonstrated SQL trigger.

P, S (`v100012840`) and T (`v100012b9e`) all have unique-space coordinate
`0x23d00`/4 but are distinct SSA values. S/T have separate LOAD definitions,
even though machine code reads `[R13+0xd8]` in each path. Matching coordinates
or memory expressions do not equate contents across reads/paths or solve aliases.

## Graph witnesses

Accept any edge-valid witnesses with the required endpoints and omitted block,
not only these shortest examples:

- Selected: `1142 -> 1159`, edge `1142:0`; `1158 -> 1159`, edge `1158:0`.
- Open alternative avoiding 1159:
  `1143 -> 1144 -> 1201 -> 1204 -> 1205 -> 1207`, edges
  `1143:0, 1144:0, 1201:0, 1204:0, 1205:1`.
- Release alternative avoiding 1159:
  `1161 -> 1162 -> 1163 -> 1164 -> 1205 -> 1207`, edges
  `1161:1, 1162:1, 1163:1, 1164:0, 1205:1`.

1207 has zero successors. Check every edge against the retained graph. These
finite recovered paths establish neither machine paths, feasible predicates nor
termination.

## Independent machine checks and grading

ELF64LE PT_LOAD/file reads verify sixteen instruction sites and eight relative
targets; GNU decoding corroborates them. Receipt: `controller-machine-oracle.json`
locally. Earlier sites are in the [savepoint oracle](savepoint-control-oracle.md).
Additional facts:

- `0xedbf0 85f6` TESTs ESI; `0xedbf2 0f8548270000` is JNE `0xf0340`,
  zero falls through to `0xedbf8`. Native successor origins are separate metadata.
- `0xf0378 458b9dd8000000` loads R11D from `[R13+0xd8]`; `0xf037f 4585db`
  TESTs it; `0xf0382 7e0b` is signed JLE `0xf038f`, positive falls through
  to `0xf0384`. Native true/ne-zero here is not machine JLE-taken.
- Other guards remain signed JG `0xedc01 -> 0xf2372` and equality JE
  `0xf0389 -> 0xf242d`; format setups and shared CALL bytes are unchanged.

The full graph has 21,349 operations, 35,755 values, 1,229 blocks and 2,061 edges.
Both actual MCP adapters match all 2,845 control triples against the independent
node-removal/exit-reachability oracle, with source fidelity and exact native edge
metadata. This is not global machine/IR equivalence. Grade the complete answer
and actual calls: both controller levels, all four conditions, shared/distinct
SSA identities, valid witnesses, selected machine corroboration, real source
IDs/digest and explicit recovered/alias/machine/nontermination/runtime limits.
A cheap incomplete/incorrect answer is not an efficiency success. Close the lease.
