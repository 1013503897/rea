# Exact value locations and use occurrences

Real stripped OpenSSH exposed two missing query directions: selecting retained
SSA versions by an observed storage coordinate, and finding uses of a function
input/constant without a defining operation. Literal-constant lookup is not
storage lookup, and operation-definition users cannot represent input uses.

`values(locations:[{space,offset,size_bytes}])` now matches exact retained
coordinates and widths. It preserves multiple SSA versions, intersects ID/input
filters, honors field selection and pages results. IDs retain caller order;
otherwise distinct locations retain caller order, then native value order.
Empty selections select none. `unretained_locations` reports coordinates with no
known retained match before other filters. `location_coverage` preserves the
count of values with unresolved spaces; an empty location request leaves that
count null. These are not alias, pointer-content or live-memory queries.

`relations(kind:"value_uses", seeds:[valueID])` returns exact operand occurrences,
including constants and inputs with null definitions. Its rows have the same
`{operation,input_index,value_id,definition,phi_predecessor,phi_predecessor_edge}`
grain as operands. Repeated slots/PHI incoming edges stay distinct. Paging spans
distinct seed order, then native operation/slot order. Missing value seeds and
partial retained-use scope remain explicit. Call-boundary-only captures support
location lookup; `value_uses` is explicitly unavailable there.

One value-query owner serves full graphs, bounded projections and call-boundary
values; the duplicate input-filter implementations are removed. Operand-row
construction is shared by forward and reverse reads. Native operation-relation
routing also has one owner across full/projection/unavailable views. Both new
indexes build lazily, contain only retained facts, and expire with their resident
snapshot model; arbitrary missing queries do not grow retained state. Existing
two-model/retained-source and execution/resource bounds are unchanged. CLI, SDK
and both MCP adapters share these implementations; the catalog stays 15 methods,
18 direct tools or 4 Code Mode tools. No native engine rebuild is required.

## Real artifact and verification

Target: Debian `openssh-client 1:9.2p1-2+deb12u10` amd64 `/usr/bin/ssh`, stripped
ELF, SHA-256 `04f2ff5f506a3f332e7adeb1478a4c551ae74acdd328e6fb5c2495664d4064e6`.
Engine remains preserved `a9ca8a8a...`, upstream `fe01d629...` plus the pinned
experimental exporter. The caller `0x280c0` contains 11,534 recovered operations,
19,504 values and 245 blocks. Location `ram:0x1144c8/4` has 250 retained versions
and 369 input occurrences; this does not mean 250 physical objects or prove the
global unchanged across calls. Independent GNU decoding finds the four-byte
load/TEST/JE at `0x28e58`/`0x28e63`/`0x28e66`; unwind FDEs corroborate the selected
function starts. Native `INDIRECT`/PHI versions do not solve memory aliases.

Both actual MCP routes verify every selected version and occurrence against
the prior retained complete graph, preserving C, calls and all ordinary native
function fields. They also find the warning callee's incoming RDI value and its
first call use without a whole graph/report read. Case-sensitive spaces,
missing coordinates, source identity, field selection and paging are checked.
Each route executes fifteen MCP requests. The 78 shared JS tests pass, including
projection/call-only scope, null spaces, repeated input slots and PHI bindings.

| Executed scope                   | Family wall s | Family CPU s | Kernel peak MiB |
| -------------------------------- | ------------: | -----------: | --------------: |
| Shared 78 tests                  |         4.653 |        4.409 |            88.9 |
| Real Code Mode MCP               |         9.081 |        8.730 |           372.3 |
| Real direct MCP                  |         9.080 |        8.800 |           338.9 |
| Retained-source query diagnostic |         1.327 |        1.145 |           156.9 |

All use one CPU, 4 GiB hard / 3 GiB early-stop bounds, verified cleanup and OOM 0.
Kernel peaks include charged file cache, not RSS. The public MCP checks verify
adapter parity; they issue each query separately rather than optimizing a
multi-query Code Mode script. First indexed tasks take 148.5 ms / 0.149 CPU
seconds Code Mode and 79.7 ms / 0.080 direct. Same-lease selected-value/use reuse
takes 9.7 ms / 0.011 CPU and 4.3 ms / 0.005 respectively. Cumulative peaks only
upper-bound isolated warm memory. No model-token or general speed claim follows.

## Equivalent core query diagnostic

`profile-value-queries.mjs` replays the same retained real source and completes
the same task: select all versions at that exact location and all their retained
operand occurrences. Both strategies return exactly the same 250 values and
369 occurrences. It uses the existing paged API as the scan baseline.

| Strategy                                      | Core reads | Core-result JSON bytes | Elapsed ms | Family CPU s |
| --------------------------------------------- | ---------: | ---------------------: | ---------: | -----------: |
| Page values and operation inputs              |        244 |              5,632,444 |     213.34 |        0.214 |
| Exact locations and value uses, first indexes |          6 |                 85,421 |      53.51 |        0.054 |
| Same indexed task, warm                       |          6 |                 85,421 |       2.72 |        0.003 |

Parsing the retained source separately takes 611.4 ms / 0.652 CPU seconds. These
query timings include diagnostic JSON byte accounting. They measure core reads
on a previously captured native graph: no fresh native computation, MCP wire,
schema/discovery, model rounds or tokens. The scan reads all 19,504 values and
11,534 operations; the indexed path reads 250 values and selected use rows.
The memory peak is cumulative across strategies. OS caches/host contention and
query order are uncontrolled. This establishes a useful query boundary, not a
native analysis acceleration or completed-agent efficiency advantage.

Local receipts use `.cache/atomic-codemode/ssh-values-{code,direct}-v1*`,
`ssh-value-query-profile*`, and `value-query-shared-tests.log`. The
[real-agent comparison](ssh-warning-study.md) now completes the stripped
application's warning/caller/stack-format/local-guard task in all three lanes.
Code Mode uses the new queries correctly; direct atomic answers with machine
facts alone and has lower observed whole-task costs. The new core-query result
must not be substituted for that completed-task comparison.
