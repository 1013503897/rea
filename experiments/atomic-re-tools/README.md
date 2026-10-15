# Atomic RE tools: an experiment

Experimental branch only: no PR, merge, production registration, or Code Mode.
Started from REA main `5b16f2431062eea6ffd245a9e05512790007cb13`.

The question is whether composable facts improve **completed reverse-engineering
tasks**, especially on complex software. Three outcomes matter together:

1. Time, native work, CPU and process-family memory, including startup and retries.
2. Whole-task estimated tokens: catalog, arguments, results and necessary follow-up.
3. Correct answers with traceable evidence, meaningful coverage and explicit unknowns.

Smaller replies, fewer tool names and fewer calls are intermediate measurements,
not proof of a better investigation. Negative results are useful experiment results.

## Working definition

An atom is a coherent fact or relationship about an identified object, with its
producing evidence and uncertainty. It need not be a single field, MCP call,
instruction, native command or engine pass. A string's encoding and the status of
that encoding belong together; separating them can change the meaning.

Candidate reusable building blocks:

| Object / fact                        | Relationships and questions                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Artifact and analysis context        | Which bytes, architecture, address space and analysis profile produced this?            |
| Location and byte span               | What is mapped here? Where are the source bytes? Is the span initialized?               |
| Instruction                          | What bytes decoded here, and with which mode and provenance?                            |
| Function                             | Which entry is identified? Which locations does the engine actually assign to its body? |
| String, symbol, type                 | What was observed or recovered, and what remains unknown?                               |
| Reference / call / control-flow edge | What are both endpoints, the reference site, kind and coverage?                         |
| Decompiled view                      | Which engine reconstruction and machine locations support this selected text?           |

An inventory extent is an upper bound, not proof that an interior address belongs
to the preceding function. A reference to a string's start address is not proof
of a runtime string use, and misses references into its interior. Different
providers' recovered functions and types are not automatically the same entities.

Identity needs artifact digest + analysis profile + address space + object kind
and location/discriminator. A separate session lease controls whether a handle
is still usable. Identity, existence, lookup success and readiness are distinct.

## Hypotheses to try to falsify

- Fine-grained getters can lose to coherent fact batches through repeated
  envelopes, schemas and round trips.
- A small workflow can be built from the same facts without maintaining a second
  analysis implementation. Explicit selection must survive composition.
- Batching at MCP may reduce agent turns without saving any native analysis.
  The engine's unit of work must be measured separately from the fact/read unit.
- Richer structured relations can improve investigation completeness more than
  another wrapper around whole-function C text.
- On complex targets, a narrow result can omit the decisive evidence. Compare
  coverage and final answers, counting all extra reads and failed paths.

## First prototype

`facts.mjs` consumes REA's existing normalized observations. It does not parse
assembly/C or guess ownership. The same methods support individual reads,
homogeneous batches, and one string-reference-function workflow. Native analysis,
target admission, caches, cancellation and full Evidence ownership stay in REA.

`server.mjs` adds experimental tools to the **complete** production MCP catalog.
It does not hide unrelated schemas to manufacture catalog savings. The additional
schemas are included in costs. Its operations are static reads; it never executes
the target or mutates an attached analysis database.

`benchmark.mjs` compares production calls, individual fact calls, batches and
composition using actual MCP clients and actual Kuna/Ghidra. Verification runs
are separate from timed equivalent-work runs. Each performance run repeats the
task in one session to distinguish first queries and warm native caches. Cold
Ghidra import/open cost must also be reported, not hidden in the query timer.

The prototype projects the current address-only `xrefs` contract. Reference kinds
stay unknown. Unsupported containing-function resolution stays unknown without
futile retries. This is intentionally a way to expose integration gaps rather
than claim that the adapter can recover information already discarded upstream.
Full Evidence is explicitly readable while its existing session owner retains
it; closing the binary expires those records. Paging covers the provider-returned
set and never establishes complete artifact discovery.

This is not a production contract proposal. Overlays, non-default address spaces,
typed edges, native batching and live agent decision quality need further work.
No measured claim about improved complex-program reasoning is established yet.

## Reproduce

Use the repository's pinned Node/npm and run `npm ci`, then
`npm run build:cached`. Supply existing installations through `REA_KUNA_COMMAND`,
`GHIDRA_INSTALL_DIR` and `JAVA_HOME`; this experiment installs no provider.

```sh
node --test experiments/atomic-re-tools/facts.test.mjs

# Existing bounded runner: one CPU, 4 GiB hard memory cap, early stop at 3 GiB.
# Its payload-exit counters include all processes in the owned scope.
python3 experiments/analysis-efficiency/resource-run.py --observe-payload-exit -- \
  node experiments/atomic-re-tools/benchmark.mjs \
  kuna batch /usr/lib/x86_64-linux-gnu/libz.so.1 incorrect \
  .cache/atomic-re-tools/kuna-batch
```

Use `baseline`, `fine`, `batch`, or `workflow`, and `ghidra` or `kuna`.
Append `--verify` for additional lifecycle, paging, negative and Evidence checks;
those runs must not be used as equivalent-work performance samples. Binaries,
provider projects, captured catalogs/traffic and local measurements stay ignored
under `.cache/atomic-re-tools/`, never in commits. Summarize reproducible results
and limitations here as experiments finish.
