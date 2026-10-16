# Native function-boundary oracle

Freeze the question, oracle, runtime and complete catalogs before real models.
Question contains the observed formats but no addresses/counts/native IDs.
The target is the same stripped Debian OpenSSH client as the warning study:
`/usr/bin/ssh`, SHA-256
`04f2ff5f506a3f332e7adeb1478a4c551ae74acdd328e6fb5c2495664d4064e6`.
Use the new pinned experimental engine for both lanes, not a stock capability
claim. Verify the final engine's complete prior function records unchanged except
for the added independent parameters facet before scoring model answers.

References select banner function `0x25cb0` (banner `0xc8628`, xref `0x25d14`)
and strict-diagnostic caller `0x280c0` (format `0xc9018`, xref `0x28e6c`).
The selected direct call is `0x28d53 -> 0x25cb0`; another incoming caller is
not the requested caller. These are native/reference observations, not guessed
original source names. Global reference discovery remains incomplete.

Both native prototypes report model label `__stdcall`, model_unknown false,
inputs_locked/output_locked false, variadic false, input_errors/output_errors
false. The label is not evidence for a Windows ABI, original signature or
runtime binding; flags report native state, not model correctness. Every native
parameter/output in these two captures has type/name/size locks, this_pointer,
indirect_storage and hidden_return false.

Banner prototype has four entries, all eight bytes:

| Native index | Storage             |
| ------------ | ------------------- |
| 0            | register:0x38 (RDI) |
| 1            | register:0x30 (RSI) |
| 2            | register:0x10 (RDX) |
| 3            | register:0x8 (RCX)  |

Its output is explicitly is_void true, size 0 and null storage; native type_name
is an empty string, which must not erase the explicit void observation.
Its complete retained graph has three is_input values. Only native entries 0
and 3 have exact retained input matches; entries 1/2 do not. No original source
arity or absence of source parameters follows from either count/missing match.

Caller prototype has ten native entries:

| Native index | Storage / bytes   |
| ------------ | ----------------- |
| 0            | register:0x38 / 8 |
| 1            | register:0x30 / 8 |
| 2            | register:0x10 / 8 |
| 3            | register:0x8 / 2  |
| 4            | register:0x80 / 8 |
| 5            | register:0x88 / 4 |
| 6            | stack:0x8 / 4     |
| 7            | stack:0x10 / 4    |
| 8            | stack:0x18 / 4    |
| 9            | stack:0x20 / 8    |

Its output is is_void false, eight-byte register:0x0 (RAX), type_name xunknown8.
This is a recovered return descriptor, not proof of original 64-bit C return
type. Its complete graph has 44 is_input values; every native parameter tuple
has an exact input match. Extra input varnodes do not thereby become formals.
Preserve stack coordinates as native values without inventing a cross-call
stack rebase, alias/subregister/split/join interpretation or source ordinals.

Selected caller CALL `0x28d53:779` passes value `v10000a9cf` at recovered input 1 in RDI
(register:0x38 / 8), matching banner native slot 0's storage. The banner's
matched input value is `v30000002e`; its first helper call `0x25cc3:1e`
uses that identity at input 1 and targets `0x42c20`. Exact caller value IDs and
all matched callee/caller input IDs must be checked against the actual delivered
sources, retaining separate snapshot scopes even when storage or IDs coincide.
[Existing independent machine evidence](ssh-warning-oracle.md) verifies
`MOV RDI,R15` at `0x28d50`, CALL `0x28d53 -> 0x25cb0`, incoming RDI saved
to R13 at `0x25cbc`, and helper CALL `0x25cc3 -> 0x42c20` with RDI unchanged.
A matching register and known direct target support this selected transfer;
they are not cross-function SSA equality or general aliases/runtime feasibility.

Score the complete answer for owner/caller, both full native parameter
inventories and return/flag semantics, raw input counts and exact matches,
explicit missing/unknown interpretation, selected cross-function pointer and
machine corroboration, source identities, target digest, scope and close.
Both routes get the same question, complete twenty/four-tool catalogs, requested
`gpt-6.1-sol/high` via Codex 0.161.0, fresh isolated leases/private caches and
common discovery/envelope/wait guidance. Charge whole-task cumulative/cached/
uncached input, output/reasoning, model responses, calls/retries/waits, wall/CPU
and kernel family memory. Preserve every attempt. No traditional-provider cell
is claimed for these native-only model facts. Remote model build/compute,
OS/model caches and host contention remain uncontrolled. No PR/main merge.

The banner's two exact retained input matches are slot 0 `v30000002e` and
slot 3 `v3000004b5`. Caller slots 0–9 match respectively `v30000005b`,
`v300000072`, `v30000007a`, `v700000032`, `v300000008`, `v500000082`,
`v50000b767`, `v50000b044`, `v500002b57`, `v10001374c`. These are evidence-
scoped native IDs, not cross-function globally stable object identities.
