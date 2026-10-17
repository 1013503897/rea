# Frozen SQLite pooled-string task

Freeze this question and oracle before the three model runs. The target is the
Linux x86-64 `/usr/lib/x86_64-linux-gnu/libsqlite3.so.0.8.6`, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
It is inspected statically, never executed. The independent fixture oracle is
`verify-string-span-machine.py`; its fixed expectations are checked against ELF
loaded bytes, GNU disassembly and relocation records, without reading Kuna output.
This is a selected corpus check, not a proof of global reference completeness.

Both exact inventory strings are ASCII with an observed NUL and 14 encoded bytes:

| String        | Inclusive span    | Target offsets and occurrence counts |
| ------------- | ----------------- | ------------------------------------ |
| no such table | 0x11b376–0x11b383 | 0: 1; 8: 6                           |
| sqlite_schema | 0x11b33f–0x11b34c | 0: 1; 7: 3                           |

The complete selected data occurrence set is:

| From    | Target   | Owner entry | Native name               |
| ------- | -------- | ----------- | ------------------------- |
| 0x4215c | 0x11b376 | 0x420d0     | sqlite3LocateTable        |
| 0x2d709 | 0x11b37e | 0x2d600     | sqlite3AlterRenameTable   |
| 0x4565e | 0x11b37e | 0x45590     | sqlite3StartTable         |
| 0x4573d | 0x11b37e | 0x45590     | sqlite3StartTable         |
| 0x48b2e | 0x11b37e | 0x47ff0     | sqlite3EndTable           |
| 0xbad38 | 0x11b37e | 0xb90e0     | sqlite3Pragma             |
| 0xbd1f0 | 0x11b37e | 0xbd1b0     | sqlite3InitOne            |
| 0x422c5 | 0x11b33f | 0x42280     | sqlite3PreferredTableName |
| 0x41f0b | 0x11b346 | 0x41db0     | sqlite3FindTable          |
| 0x41f65 | 0x11b346 | 0x41db0     | sqlite3FindTable          |
| 0x41fb2 | 0x11b346 | 0x41db0     | sqlite3FindTable          |

Order is irrelevant; all eleven distinct sites and owner entries are required.
Nine interior-target occurrences are suffix pointers (`table`, `schema`), not
nine uses of the entire original inventory literal. Scope is retained static
data references, not exhaustive machine dataflow, dynamic aliases or executed use.

At `0x2d709`, bytes `488d156edc0e00` form `0x11b37e` in RDX. There is no RDX
overwrite before the direct call at `0x2d716` to `0x29060`. The PLT jump slot is
`0x159fc8`, whose ELF JUMP_SLOT symbol is `sqlite3CheckObjectName`; this does not
establish the runtime bound implementation. Decoding must start at a known
instruction boundary, e.g. `0x2d706`, rather than a guessed mid-instruction start.

At `0x42158`, `AND R13D,1` (`4183e501`) sets flags. The LEAs at `0x4215c`
(`488d1513920d00`) and `0x42163` load the base `no such table` pointer into RDX
and `no such view` (`0x11b369`) into RAX. These LEAs preserve flags.
`CMOVNE RDX,RAX` at `0x4216a` (`480f45d0`) keeps the table component when the
masked result is zero and selects view when nonzero. The separate test/branch
at `0x4216e`/`0x42171` must not be substituted for this selection. On the
selected fallthrough path, RDX is still the message component at the call at
`0x42185` to `0x2a1e0`; RSI separately receives the format pointer `0x11b38c`
at `0x4217c`. The PLT slot `0x15a888` has symbol `sqlite3ErrorMsg`.
Runtime values, feasibility, effects and binding remain unknown.

Grade complete answers against these facts and verify cited Evidence IDs,
artifact/engine identity and selected source rows. An answer that misses interior
targets, merges the three FindTable sites, claims whole-message use from span
membership or reverses CMOVNE behavior fails. Record failures and retries rather
than selecting only successful runs. Full real-model task costs include tool
schemas, reference help, rejected calls, responses, cached/uncached input, output
and reasoning tokens, wall time, local family CPU and kernel family peak memory.

Use one frozen runtime, engine and target for traditional (the complete supported
16-tool selector), atomic Direct (22 tools) and Code Mode (4 tools), serially in
fresh isolated profiles. All have the common client JavaScript executor.
The canonical provider has exact-address xrefs, so complete spans can be
enumerated; only the atomic API exposes the new native span occurrence query.
Consequently this is a workflow/profile comparison, not a controlled test of
adapter overhead alone. Native Kuna already aggregates string-span counts and
owner functions, but that aggregation lacks individual reference endpoints and
is not exposed as an equivalent traditional MCP operation.
