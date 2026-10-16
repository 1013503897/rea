# Known-target references versus recovered call operations

This question and acceptance oracle are fixed before either real-model lane.
The question is `sqlite-reference-question.txt`. Both lanes expose the same
fourteen fact methods; the server adapters have four/seventeen MCP tools. Use the
same preserved engine `64c6b3fe5737056fc29c10b0aad6c7cbd489ad7d17bd1726141b77bdcf5e15b7`,
artifact, model/effort request, common envelope guidance and resource limits.
The task explicitly requests reference aggregates for the VM rather than
decompilation. Its cost comparison is limited to this selected task and these
adapters, with a client that already supports JavaScript dispatch in both lanes.

The artifact is Debian ELF `libsqlite3.so.0.8.6`, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
Independent GNU objdump decoding from exported function entries establishes:

- Wrapper `sqlite3Fts3ExprParse`, entry `0x65180`, has nine known-target machine
  CALL references. Its optimized recovered graph retains eight call operations.
  The omitted machine call is `0x6534b -> 0x29370` (`__stack_chk_fail@plt`), bytes
  `e8 20 40 fc ff`. Do not patch or reinterpret the graph as complete machine
  semantics; retain the distinction between representations.
- VM `sqlite3VdbeExec`, entry `0xea6d0`, has ELF symbol size `0x7e7e`. GNU objdump
  identifies 396 direct immediate CALL instructions, 171 exact destinations and
  16 calls to `0x296c0`. The set of all 396 `(origin,target)` pairs exactly equals
  the native outgoing call-reference set; this is stronger than a row-count-only
  comparison.
- The selected VM instruction is `0xf238b -> 0x296c0` (`sqlite3VdbeError@plt`).
  A name or PLT entry does not establish runtime symbol binding.
- Independent disassembly also finds 21 indirect CALL instructions in the VM.
  The requested native known-target totals do not include them. The model must
  preserve unknown indirect/discovery/runtime coverage; it need not discover the
  number 21 using an additional full instruction read. Reporting 396 as every
  possible runtime or machine call would be wrong.

The question's required final facts are the nine/eight wrapper counts, the
verified differing machine call, all three VM aggregates, the selected VM call,
real source Evidence and the stated coverage limits. Exact instruction versus
function scope and source-row identity are also checked by the public MCP
verifier. An empty or unattributed function query must remain unknown, not proof
of no references.

Raw independent disassembly and the full pair comparison are retained locally
in `.cache/atomic-codemode/outgoing-oracle-vm.asm` and
`outgoing-vm-independent-oracle.json`. The model workspace contains neither.
Native CLI probes separately show source sizes and costs; fewer source bytes are
not a model-token or completed-task speed result.
