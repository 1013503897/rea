# Calls and values surviving full-graph capacity

The question is `sqlite-boundary-question.txt`. Fix it and this acceptance oracle
before either real-model run. Both lanes use the same complete fourteen-method
API, preserved engine, model/effort request, common guidance and resource limits.
This task requires VM decompilation once per fresh lease; it is different work
from the earlier shallow-reference question. Do not compare their task times as
an adapter speedup. Actual client JavaScript dispatch is available in both lanes.

Artifact: Debian `libsqlite3-0:amd64` version `3.40.1-2+deb12u2`,
`libsqlite3.so.0.8.6`, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
The selected VM implementation entry is `0xea6d0`, not its same-name PLT entry.

Pre-model public MCP capture with the new exporter establishes:

- Code is available. Full graph is unavailable with `atomic operation capacity
  exceeded`. Calls remain available: 416 retained block-member operations,
  consisting of 395 CALL and 21 CALLIND. The 395 direct targets are known, all
  21 indirect targets remain unknown. Call-boundary values are available (1,294),
  covering targets, arguments and outputs only, with 21,349 operations scanned
  over 1,229 recovered blocks. These do not supply a complete definition/use graph.
- At `0xf115c`, recovered call ID `0xf115c:6a84` targets `ram:0x296c0`.
  Input zero is `v1000118d6`, `fspec:0x102f4`, annotation true, width 8.
  Three recovered inputs use passing storage `register:0x38/8`, `0x30/8`,
  `0x10/8` (RDI, RSI, RDX in this verified x86-64 lane).
- At `0xf238b`, call ID `0xf238b:7130` has the same resolved target.
  Input zero is `v100012a80`, `fspec:0x1030c`, annotation true, width 8.
  Two recovered inputs use passing storage `register:0x38/8`, `0x30/8`.
- Both first arguments are the same snapshot-local SSA value `v30000004b`,
  `register:0x38/8`, `is_input:true`, definition null. Other retained argument
  values have defining operation IDs outside this boundary view. Exact SSA
  identity is supported; source parameter ordinals and general aliases are not.

Independent GNU objdump decoding from the exported VM entry verifies the two
machine CALL targets and register setup. The earlier complete direct-call pair
oracle contains both. Of the 396 physical direct immediate calls, the only one
absent from the recovered 395 is `0xf2493 -> 0x29370` (stack check failure).
The question does not require rediscovering this extra call; the recovered-call
count must not be claimed as complete machine/runtime coverage.

Required final facts: correct selected entry and facet availability/scope; both
call-count groups and target-unknown distinction; both resolved targets separated
from annotation offsets; argument slots/locations; shared first-input identity;
selected machine checks; explicit unreadable definition/use and alias/runtime
limits; real Evidence and subject digest. Do not require the model to report
every additional native metadata counter. Check that its API source arguments
show only one VM analysis and all relevant reads reuse its snapshot/Evidence.

Raw public verification is retained as `facets-v3-mcp.json` and its Evidence
directory under `.cache/atomic-codemode/`. The ordinary VM record (C, mappings,
variables and other ordinary metadata) equals the prior captured engine output.
The independent oracle and precomputed answer are absent from the model workspace.
