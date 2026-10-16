# Real-agent savepoint control investigation

The [question and oracle](savepoint-control-oracle.md) were committed at
`e2205313a` before either model launch. Both lanes have the same atomic facts,
target, engine, question and common envelope/stopping guidance. They start with
the function name and two messages, without supplied code addresses. This tests
the newly available full recovered graph, not provider parity or superiority
over a traditional RE interface.

## Initial pair: natural discovery

Both complete answers pass the frozen source/answer review:

- Incoming string references select `0xea6d0` from two same-name entries before
  one retained VM capture. Neither lane fetches the complete C report or graph.
- Both format pointers merge through `0xf238b:ceb7` and reach CALL
  `0xf238b:7130`, with the correct predecessor/edge bindings and RSI storage.
- Each answer supplies both successor edges for each nearest local conditional
  predecessor. The open guard is signed four-byte `0 < loaded32`; release is
  four-byte equality to one. Both trace one-byte Booleans to the right LOADs,
  preserve operand indexes/widths and stop before guessing loaded contents.
- Focused instruction windows check loads, the spill, signed JG/equality JZ,
  format setups and shared machine CALL. Independent GNU/ELF verification checks
  eleven instruction sites against the same target bytes. PHI/edge identities
  remain separate from machine instructions and transfers.
- Real source IDs and the target digest are present. Each answer limits itself
  to recovered graph/local guards and states machine-flow, alias,
  nontermination, earlier-path and runtime-feasibility limits. Neither uses
  derived controllers or claims a SQL trigger. Both close the lease.

Each answer cites ten observed source IDs. Both have one successful VM capture,
whose recovered graph equals the complete producer golden; facts come from the
preserved `677b9795...` engine. Full answers, events, tool context, traces and
resource receipts are retained locally under
`.cache/atomic-codemode/sqlite-savepoint-control-{direct,codemode}-v1*`.

| Whole-task measure                | Direct atomic | Code Mode |
| --------------------------------- | ------------: | --------: |
| Cumulative input tokens           |       515,024 |   610,715 |
| Included cached input             |       466,304 |   563,328 |
| Uncached input                    |        48,720 |    47,387 |
| Output tokens                     |         5,537 |     6,345 |
| Included reasoning output         |         1,344 |     1,502 |
| Observed model responses          |            17 |        18 |
| MCP attempts, including rejection |            24 |        15 |
| Successful atomic fact reads      |            20 |        21 |
| Model wall seconds                |       206.269 |   223.636 |
| Family wall seconds               |       207.427 |   224.133 |
| Family CPU seconds                |        53.794 |    52.777 |
| Kernel process-family peak MiB    |         874.9 |     883.2 |

Code Mode's fifteen attempts include a rejected `timeout_ms:200000` request;
the actual schema maximum is 120,000. It retries within that bound. The client
also initially tries to JSON-parse the validation error's text and gets a
SyntaxError. Both costs remain in the ledger. There are no recorded inner-API
failures or resource aborts. Direct has no failed MCP attempt. MCP attempts,
successful host reads, client execution calls and model responses are distinct
counts; the trace has no handler entry for the schema rejection.

In this one sample, Code Mode reduces uncached input by about 2.7% but increases
cumulative input by 18.6%, output by 14.6% and model wall time by 8.4%. Fewer MCP
requests do not establish a whole-task advantage. The lanes also choose slightly
different fact selections and output detail. This is an observational pair,
not a controlled estimate of a single dispatch mechanism's causal effect.

The first client discovery call in both lanes applies a broad `rea.*...` regular
expression to all tool names/descriptions. It matches unrelated tools, including
creation tools, and prints large, truncated metadata. This is a real observed
agent cost, not an analysis-provider failure; it also adds noise to comparing
the two interfaces. A repeat should give both lanes the same exact-name discovery
policy while retaining every advertised tool and charging that guidance to the
whole task. No analysis steps, addresses or answers should be added.

Both runs request `gpt-6.1-sol/high` through Codex 0.161.0; the resolved service
build is unknown. Per-response usage sums match the runner ledger. Cached input
is already included in input, and reasoning is included in output. One CPU,
4 GiB hard / 3 GiB early-stop limits apply. Kernel peak includes charged file
cache; it is not RSS. Both runs have OOM 0, verified payload/profile cleanup,
unchanged runtime fingerprints, engine and target digests. Each lease is fresh;
OS/provider-service caches and remote compute costs are uncontrolled/unmeasured.

## Discovery-controlled repeat

Pending. The intended repeat keeps the same question, oracle, native engine and
all atomic methods, reverses lane order, and uses the runner's existing
`--enabled-tools` / `--guide-enabled-tools` options with server name `rea`.
Each manifest lists that lane's complete catalog, so no analysis tool is removed.
This changes discovery guidance and namespace together for both lanes; it is a
separate stratum from the natural-discovery pair, not a retroactive replacement.
