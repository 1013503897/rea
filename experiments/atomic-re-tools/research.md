# What might count as an RE atom?

This is an experiment record, not a claim that a new universal instruction set
has been discovered. APIs already expose many relevant primitives. The open
question here is how to make their evidence, cost and composition useful to an
agent investigating a real program.

## Existing mechanisms and what they establish

- Ghidra has a program database, `ReferenceManager.getReferencesTo`, function-body
  ownership through `FunctionManager.getFunctionContaining`, listing objects and
  decompiler IR. Fine-grained **engine APIs already exist**. A poor MCP projection
  can still discard their metadata or require excessive round trips.
  Sources: [ReferenceManager](https://ghidra.re/ghidra_docs/api/ghidra/program/model/symbol/ReferenceManager.html),
  [FunctionManager](https://ghidra.re/ghidra_docs/api/ghidra/program/model/listing/FunctionManager.html).
- Binary Ninja distinguishes code/data, type and variable references, including
  IL-level references. This shows why one undifferentiated `xref` is insufficient
  for some questions. It does not establish that an MCP interface using these
  APIs will be token-efficient or that another provider can reproduce the facts.
  Sources: [type/variable references](https://binary.ninja/2021/04/12/type-and-variable-xrefs.html),
  [BinaryView API](https://dev-api.binary.ninja/binaryninja.binaryview-module.html).
- Kuna's Rust engine and SLEIGH compiler derive from Ghidra, while its standalone
  loader/analyzer tier and CLI are separate components. Port lineage does not
  imply identical observations or a shared live program database.
  Source: [NOTICE](https://github.com/Noelo-Lab/kuna/blob/fe01d6294eb0d1053ce343c8943646df88e143fc/NOTICE).
- In **tested Kuna 1.833**, an `xrefs` command loads a program and builds an
  `XrefIndex` for its query. A different CLI invocation does that again.
  `strings` with attribution instead loads/indexes once and joins references over
  each string's byte extent. That is already internal composition, even though
  the CLI does not expose an arbitrary persistent query interface.
  Sources: [xref producer](https://github.com/Noelo-Lab/kuna/blob/fe01d6294eb0d1053ce343c8943646df88e143fc/decompiler/crates/kuna-cli/src/xrefs.rs),
  [string attribution](https://github.com/Noelo-Lab/kuna/blob/fe01d6294eb0d1053ce343c8943646df88e143fc/decompiler/crates/kuna-cli/src/strings.rs).

These are source-derived observations. They are not measurements of current
upstream main, a guarantee of decompilation correctness, or a novelty claim.

## Granularity has at least three independent dimensions

| Dimension | Example | Consequence |
| --- | --- | --- |
| Fact unit | One typed reference with both endpoints and provenance | Can be retained and joined without reading unrelated C text |
| Transport unit | A batch of references for several selectors | Amortizes headers and agent turns; need not change native work |
| Compute unit | One image load and reference walk | Can serve many fact queries; may cost much more than one returned row |

Calling all three "atomic tools" hides the main optimization opportunity. A tiny
getter can repeat a whole-program analysis. Conversely, one expensive shared
analysis can provide precise, small, independently addressable facts.

## Candidate semantic core

1. **Identified objects and located observations**: artifact, image/address-space,
   byte span, decoded instruction, symbol, string candidate, recovered function,
   variable and type. Keep width, encoding, storage and confidence where needed
   to interpret a value. A recovered object is an analysis claim, not necessarily
   a source-language object that existed before compilation.
2. **Relations and constraints**: maps-to, owns/contains, references, calls,
   flows-to, defines/uses, argument binding, type/storage association and branch
   guard. Keep source and destination, reference site, kind, supporting evidence
   and unknown/partial coverage. Do not collapse a call site into just a callee.
3. **Evidence views**: retain the original observations and expose the requested
   fields, range or neighborhood. A readable decompilation is an important view;
   it does not replace a machine-grounded relation or prove original source.

Useful query operations resemble selection, projection, traversal, join and
aggregation. This is a design vocabulary, **not a proposal to add a SQL/graph
language or Code Mode**. Start with named, typed analyst questions; add more
general execution only if repeated real workflows demonstrate the need.

## Composition rules that prevent false conclusions

- Entity identity and an observation's identity differ. Artifact/profile/location
  can identify a function candidate; `evidence_id` identifies one exact claim
  about it. Keep disagreeing claims instead of deduplicating them by address.
- A session lease prevents using a handle after close/reopen. It is not a frozen
  analysis revision. In particular, Kuna's whole-project and early single-function
  reconstructions can differ under the same selected profile. Target admission
  prevents a target switch; it does not establish a consistent analysis snapshot.
- A string spans bytes. A point-address xref and a reference anywhere inside that
  object answer different questions. A data-pointer reference is not automatically
  a runtime call, string consumption, or a reachable execution path.
- Omission, an unsupported operation, cancellation, an unowned reference and an
  examined empty set are different outcomes. No empty set proves global absence
  unless the producing analysis actually establishes that coverage.
- Field selection must not detach a value from the metadata that makes it
  meaningful. For example, the first prototype keeps REA's complete `string`
  metadata record as one selectable field, including its encoding status.
- Expensive producer work should be shared with explicit identity, lifetime,
  invalidation and cancellation ownership. A client-side batch is insufficient
  evidence that native work was shared.

## What complex-program effectiveness would require

Navigation is only the first tier. Finding a string and its users is weaker than
explaining why a branch rejects input or how data reaches a privileged operation.
The next tier needs definition/use, call-argument and memory-flow relationships,
with explicit analysis assumptions. The existing prototypes do **not** supply
those relationships, and slicing C text cannot manufacture them.

For every harder trial, specify the analyst question, independent answer/evidence
oracle, input artifact/profile, initial knowledge and allowed budget. Compare:

- whether the actual question was answered correctly;
- decisive evidence recovered and relevant evidence omitted;
- remaining unknowns and unsafe conclusions;
- all calls, follow-up reads, failures, latency, CPU, family memory and estimated
  token traffic, including tool discovery and retained Evidence reads.

Source inspection can establish architectural opportunities. Scripted equivalent
workflows can establish transport and engine costs. Neither alone establishes
that a live agent reasons better on complex software; a controlled agent trial
is a separate validation step. Likewise, byte/token reductions alone do not
establish improved correctness or analyst productivity.
