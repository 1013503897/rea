# Cross-function context experiment: pinned question and oracle

This is an experiment acceptance oracle, unavailable to the isolated model.
The question is `sqlite-call-question.txt`. Fix this question and the required
facts before launching either model lane. Both adapters expose the same complete
fourteen-method fact API; Code Mode has four MCP tools, direct has seventeen.
Use the same pinned engine, artifact, model request, reasoning effort, common
envelope guidance, fresh target leases and resource limits. Do not change runtime
sources or HEAD during the model batch. One sample per lane cannot establish a
general advantage, and the client itself already offers JavaScript dispatch in
both lanes. This comparison isolates the server calling adapter, not all forms of
composition or a traditional provider workflow.

The artifact is the local Debian ELF `libsqlite3.so.0.8.6`, SHA-256
`2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8`.
Independent GNU objdump decoding from the function entries covers `0x64060`
through `0x65400`; existing earlier captures independently pin the same flow.
No target execution or source-code answer is used.

Required facts for an equal completed answer:

- Wrapper entry `0x65180`; direct machine CALL `0x65211` targets internal helper
  `0x64060`. The recovered call operation has an fspec annotation as input zero;
  that annotation's offset is not the target address.
- Caller LEA `0x65201` passes post-prologue `RSP+0x20` in RDI. Structured passing
  storage is `register:0x38`, width 8. The SSA argument and the callee's retained
  input are separate snapshot-local identities; matching their storage supplies a
  candidate connection. The direct machine transfer and pointer setup support
  this particular connection. Do not globally infer source parameter ordinal,
  alias completeness or runtime binding from a slot number or a name.
- The helper preserves the input context pointer in RBP. Its 32-bit field at
  context offset `0x30` is incremented at `0x64693`/`0x64696`/`0x64699` for an
  opening parenthesis and decremented at `0x64c92` for a closing parenthesis.
  The parser's token/branch context must support the parenthesis interpretation;
  an ADD/SUB instruction alone does not identify the meaning of a field.
- In the wrapper this is `[RSP+0x50]`, initialized to zero with the other context
  tail fields. After helper return zero, LOAD `0x65268` and TEST/JZ
  `0x65270`/`0x65272` check it. Zero skips the malformed block; nonzero frees the
  expression at `0x65274`, clears its output pointer at `0x65279`, then reaches
  the malformed diagnostic at `0x65281` through formatter call `0x65290`.
- Return-code-one errors can also reach the malformed block, via
  `0x65239`/`0x6523c`; return code 18 selects a separate depth-limit diagnostic
  at `0x65330`. No demonstrated runtime-feasibility or full memory-alias claim.

The producer verifier additionally checks two formatter call targets:
`0x5f031 -> 0x2adc0` (free PLT) and `0x5f062 -> 0x27e50` (vmprintf PLT), whereas
their input-zero fspec offsets are `0x10000`/`0x10001`. Resolving these PLT entries
to runtime implementations is outside this task.

Native producer fidelity is checked against previously retained captures of all
three functions: C, ordinary metadata/line mappings, blocks, operations, values
and coverage are identical. Only schema version and structured call records are
added. Older sources used pretty JSON; their smaller/newer encoded sizes must
not be attributed to the call exporter. The earlier compact-writer change is a
separate experiment. Unsupported old schema graphs remain unavailable with valid
C retained, rather than acquiring guessed call records.

The first paired question runs at `01e5c5955` both explain the primary state flow
correctly but omit the oracle's separate return-1/return-18 distinctions. Because
the initial question did not explicitly enumerate those codes, the next round
clarifies that requirement in `sqlite-call-question.txt` before either lane
starts. The required facts and independent oracle stay unchanged. Earlier
questions and costs remain pinned to their original commits; neither incomplete
sample is counted as a full-oracle success.
