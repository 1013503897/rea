# Code-friendly JavaScript investigation data: design prototype

Status: experimental query/client implemented on this branch; not integrated upstream.
Tracking: [experiment #4063](https://github.com/morluto/rea/issues/4063).
The original design sketch below predates the implementation; its future names
are illustrative. The implemented surface is described first.
Source inspection: fresh main `d7651b6a0`, 2026-10-15. This follows the
`experiment/browser-electron-codemode-20261015` pilot, commit `6494c98c6`.

The design question is whether REA's investigation data and contracts can make
ordinary agent-written JavaScript useful. Adding an executor around existing
MCP calls does not resolve untyped results, repetitive envelopes, missing list
fields, ambiguous paths, or identity transcription.

## Implemented prototype

The canonical `inspect_analysis_view` contract now accepts:

```json
{
  "source": { "kind": "retained-evidence", "evidence_id": "<parent>" },
  "view": {
    "kind": "javascript",
    "collection": "modules",
    "projection": "references",
    "where": { "path": "main.js", "kind": "javascript-module" },
    "offset": 0,
    "limit": 64
  }
}
```

The typed `rows` contain canonical node identity, exact/unknown path, retained
source-range count and unique observation authority/state/confidence triples.
`source_coverage` preserves selection, application/semantic bounds and unknown
counts independently of filtered-page coverage. Omitted filters select all;
`path: null` selects unknown paths and `path: ""` selects empty references.
Paths can match several identities. Original module items remain accessible.
The owner scans the immutable graph once and allocates only the requested rows;
it does not allocate a full matching inventory or source-range arrays.

The experimental [client](client.mjs) borrows canonical TypeScript types;
[discovery](discovery.mjs) generates narrow JSON Schemas from named canonical
schemas, with complete original discovery still available. Both direct and
code treatments receive the same discovery and backend. The client uses normal
`await` and `for await`; failures are explicit `Result` values. Its page iterator
binds parent and filters; offsets refer to that immutable query. This prototype
uses existing offsets, not the originally proposed opaque cursors. No query
cache, report-retention API, IPC/network redesign or production executor was
added. General agent code is confined to the opt-in experimental host.

```js
const app = rea.javascript.fromEvidence(parentEvidenceId);
const counts = {};
const evidenceIds = [];
for await (const result of app.modules.pages({
  where: { path: "main.js", kind: "javascript-module" },
})) {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  evidenceIds.push(result.value.evidence_id);
  for (const row of result.value.page.rows) {
    const id = row.identity;
    if (id.strategy === "artifact-local-key" &&
        id.namespace === "unresolved-semantic-module" &&
        id.key.startsWith("external:")) {
      const name = id.key.slice(9);
      counts[name] = (counts[name] ?? 0) + row.retained_source_range_count;
    }
  }
}
print({ counts, evidenceIds }); // derived output; not minted source Evidence
```

`verify.py` compares this actual public MCP query against all selected original
items from the real Obsidian ASAR, then checks four SDK pages, early exit and
missing-parent errors. The executed run matched all 23 module identities and
ten external specifiers/counts, retaining 36 unselected files. Full structured
replies were 338,208 bytes for the legacy page/items and 23,402 for the new query.
First retained-query round trip was 0.101 s; repeated reads were 0.012/0.015 s.
Whole verification used 21.167 s wall, 20.906 s CPU and 1,167,003,648 bytes peak
at verified payload exit. These are boundary/projection measurements, not agent
performance or a new cache speedup.

## Reproducing and retaining experiments

Use pinned Node/npm and `npm ci && npm run build:cached`. Install
`quickjs-emscripten@0.31.0` in an isolated temporary prefix, not production deps.
Run heavy commands serially under `../analysis-efficiency/resource-run.py
--memory-gib 8 --observe-payload-exit -- COMMAND...`: one CPU, 8 GiB whole
process-family cap, 6 GiB early stop and no swap. Browser acquisition requires
its explicitly selected executable and the existing 256-task ceiling.

Download the official [Obsidian 1.14.4 ASAR gzip](https://github.com/obsidianmd/obsidian-releases/releases/download/v1.14.4/obsidian-1.14.4.asar.gz)
and decompress to `DATA/artifacts/obsidian-1.14.4.asar`. Gzip SHA-256 is
`d1ed428c363968774f0f3906e67d8a53a058ece0b6cdd924b07865977b2ada21`;
ASAR SHA-256 is
`146ef8470d8cbb4a6db209bdc19bf2bad13350444186c0fd93c31087b142b92f`.
No target code is executed by the static acquisition or analysis.

1. `acquire-oracle.py --data DATA` regenerates selected-source producer facts.
2. `../browser-electron-code-mode/capture-web.mjs DATA/excalidraw-proxy ABS_CHROMIUM`
   (run with Node) records the real Excalidraw startup in an owned empty-profile,
   TLS-verified, sandboxed browser. It contacts the public site. A new capture
   has a new digest/oracle; the historical live-web bytes are not reproducible.
3. Run the original `prepare.py --data DATA` and `prepare_dependencies.py --data
   DATA` in `../browser-electron-code-mode/` to regenerate plans/oracles.
4. This directory's `prepare.py --data DATA --output COHORT` freezes the new
   typed-interface tasks, oracle, counterbalanced order and source fingerprints.
5. For every plan entry run the existing `trial.py` under the supervisor with
   `--interface typed --compositional-followup --max-rounds 16`, the declared
   `--arm`, `--task`, fresh `--output COHORT/TASK-ARM`, and absolute `--quickjs`.
   Save supervisor output to `COHORT/TASK-ARM.log`.
6. Run the original `review.py --cohort COHORT`; manually check support,
   limitations and whether code actually composed/filter/grouped facts.
7. `retain.py --cohort COHORT --output SAVED` saves task/oracle, actual model
   actions and CLI events/usage, answers, failures, Evidence-response digests
   and resource receipts, with a byte checksum manifest. It never recursively
   copies profiles, auth, configuration, applications, HARs or full producer
   payloads. `review.py` can regrade saved records using the Evidence index.

Recorded snapshots under [results/](results/) are excluded from reformatting
because task hashes and recorded-byte manifests must remain stable. Downloadable
applications and regenerable bulky Evidence are intentionally not archived.
The retained model sampling/results are valuable non-regenerable observations;
identical future model outputs or original live-web captures are not promised.
Keep original failures. Historical pilot results are a separate cohort, not a
third randomized arm of the new comparison. A fresh model process with full
history per action remains an external controlled protocol; this is not a
native Codex tool-host latency benchmark.

Generate/check the client's declarations without a second hand-maintained schema:

```sh
node_modules/.bin/tsc --ignoreConfig --allowJs --checkJs --declaration \
  --emitDeclarationOnly --outDir .cache/codemode-sdk --target ES2023 \
  --lib ES2023 --types node --module NodeNext --moduleResolution NodeNext \
  --strict --skipLibCheck experiments/codemode-data-contract/client.mjs
```

## Observed contract problems

| Existing boundary                                                  | Consequence                                                      | Proposed change                                                                            |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Module pages contain only node ID, kind and path                   | Reading identities/range counts requires individual item reads   | Named typed module-reference projection with those reusable facts inline                   |
| Generic item/page output uses `jsonValueSchema`                    | A generated SDK cannot describe module fields precisely          | Typed output variants owned by the canonical domain contracts                              |
| One `inspect_analysis_view` description/schema covers many formats | A small tool count still exposes considerable unrelated metadata | Discover narrow generated SDK methods/types on demand; keep the complete catalog available |
| A path can identify an asset and several logical modules           | `main.js` is ambiguous; a caller must preserve node identities   | Snapshot-bound canonical references passed as code values                                  |
| Each item repeats a complete Evidence envelope                     | Repeated metadata enters context when copied verbatim            | A query Evidence envelope with rows and shared provenance/coverage                         |

Source boundaries:
[module projection](../../src/domain/analysisView/javascriptApplicationView.ts),
[generic view schemas](../../src/domain/analysisView/analysisView.ts),
[authenticated retained reads](../../src/application/analysisView/AnalysisViewService.ts),
[current tool contract](../../src/contracts/analysisViewToolContracts.ts).
The existing retention/authentication boundary is useful and should be reused.

## Boundary: shared data primitives, with a generated code interface

1. **Shared application/domain queries.** Read immutable retained Evidence and
   return typed module, IPC or network records. Own selectors, projection,
   ordering, coverage and provenance here. Use the existing parsed facts; do
   not introduce another JavaScript/Electron parser in a code-mode adapter.
2. **CLI/MCP adapters and a generated JavaScript/TypeScript SDK.** Both consume
   those same queries. Code methods expose familiar objects and `async/await`,
   precise inputs/results, and ordinary arrays/iterators. Canonical contracts
   remain the source of truth; avoid a separately maintained SDK semantics.
3. **The agent's existing code host.** Run loops, joins and task-specific
   calculations there, returning only useful results. The initial design does
   not require REA to add a general-purpose server-side execution tool or VM.

Self-owned Electron/browser analysis is a good starting point because REA can
change both the result representation and its query boundary. An external
engine can later supply records through an adapter without dictating this API.

The closest alternative is a thin SDK that forwards the current MCP contract.
It improves syntax but retains the current output/discovery problems. A
task-specific dossier is also useful for recurring questions, but is a separate
organization factor; it should not replace reusable facts needed by scripts.

## First candidate contract

Extend retained JavaScript views with a named typed module projection. This
shares the intent and authority of `inspect_analysis_view`; start there rather
than adding a public tool for every SDK method. For example, a new JavaScript
view variant could describe this request:

```ts
type ModuleReferencesRequest = {
  source: { kind: "retained-evidence"; evidence_id: EvidenceId };
  view: {
    kind: "javascript";
    collection: "modules";
    projection: "references";
    where: { path?: string; kind?: ModuleKind };
    cursor?: string;
    limit?: number;
  };
};

type ModuleReferenceRow = {
  node_id: ApplicationNodeId;
  path: string | null;
  kind: ModuleKind;
  identity: ApplicationNodeIdentity;
  retained_source_range_count: number;
  basis: ModuleReferenceBasis;
};

type ModuleReferencePage = {
  rows: readonly ModuleReferenceRow[];
  source: QuerySourceReference;
  coverage: QueryCoverage;
  limitations: readonly string[];
};
```

These are proposed names and shapes, not current exports. Production schemas
must use the existing identity and tagged error types, exact named contracts,
and validate converted advertised JSON Schemas against the actual clients.

The projection returns the owner's retained range count, not a claim about
unique runtime calls. More detailed locations/observations remain accessible
through exact module reads. Later projections may cover IPC endpoints and
network transactions; their ownership and unknown semantics must first be
defined from existing producing boundaries.

Prefer named domain projections and a small set of typed filters. An arbitrary
JSONPath/SQL language is unnecessary for this first question. JavaScript can do
the task-specific grouping. Push basic selection/projection into the query
owner so neither the model nor its code host must fetch irrelevant full data.

The SDK can generate `app.modules.pages(...)` from this canonical variant,
without publishing a second runtime alias or making catalog ordering select
an operation. Full discovery stays available; the model can read one namespace
and method's actual types/documentation as needed.

## What agent code should look like

Illustrative future API, not a runnable claim:

```ts
const app = rea.javascript.fromEvidence(parentEvidenceId);
const counts = new Map<string, number>();
const sources = [];

for await (const result of app.modules.pages({
  where: { path: "main.js", kind: "javascript-module" },
  projection: "references",
})) {
  if (!result.ok) return result;
  sources.push(result.value.source);
  for (const row of result.value.rows) {
    const id = row.identity;
    if (id.strategy !== "artifact-local-key") continue;
    if (id.namespace === "unresolved-semantic-module" &&
        id.key.startsWith("external:")) {
      const name = id.key.slice("external:".length);
      counts.set(name, (counts.get(name) ?? 0) + row.retained_source_range_count);
    }
  }
}

return rea.report(Object.fromEntries(counts), { sources });
```

The agent chooses the loop, predicate and interpretation. This is a reusable
module-reference API, not an Obsidian-specific dependency tool. Module refs
remain canonical values in program memory; subsequent reads bind the parent
Evidence ID and node ID together rather than asking the model to retype hashes.
A snapshot-bound SDK object is convenience, not proof of authority: the server
still authenticates every reference at the existing Evidence boundary.

The production identity union needs proper narrowing; generated types must
describe when namespace/key are available, rather than pretending every module
has them. Unavailable fields remain explicit unknowns. The illustrated
`rea.report` would retain code-derived output with source/query references,
coverage and script digest, while labelling it as a derivation. Merely running
code does not establish the truth of an arbitrary conclusion or runtime
authorization. Do not mint source-observation Evidence for an agent claim.
The SDK obtains the query reference from the outer canonical Evidence envelope;
the hashed normalized result must not embed its own Evidence ID. Reporting
resolves those references at the existing ownership boundary rather than
trusting client-supplied coverage assertions.

## Ownership, paging and resource semantics

- Bind every read and cursor to immutable parent Evidence, normalized selector,
  projection/version and stable ordering. A cursor for another snapshot/query
  fails explicitly. Exhausting retained rows does not establish complete source
  or runtime coverage. A stopped iterator retains partial consumption.
- Homogeneous exact-item batches preserve caller order, duplicates, per-item
  failures and support references. They are available to direct callers too.
- Share provenance once per query/page while retaining source references for
  rows and explicit row confidence/authority with supporting observation states.
  Mixed or unknown support must not become an observed fact. Keep complete
  Evidence accessible. Caller-requested complete detail is
  not silently replaced with a compact projection.
- Build reusable indexes only over verified immutable facts. A query cache key
  includes parent Evidence ID, selector/projection, ordering and contract
  version; its lifetime belongs to the owning session/snapshot. Artifact
  analysis caching additionally needs bytes, selections, parser/options and
  version. No cache speedup is measured by this probe.
- Live browser/Electron state must first have explicit snapshot identity and
  freshness semantics. Reading a retained capture does not silently refresh,
  navigate, attach, execute target code or acquire more authority.
- Bound pages/serialization before allocation using real transport/resource
  limits, with cancellation and cleanup. SDK iterators release resources on
  early exit; reports deduplicate supporting references and retain metadata,
  not copies of every input row. Concurrency remains bounded.

## Recorded real-artifact probe

`module-reference-probe.mjs` consumes the pilot's real Obsidian owner-produced
module pages/items, not a demo application or a new parser. It proves that a
compact reference-row representation can retain the requested facts:

- 23 canonical `main.js` JavaScript-module identities;
- all ten external specifiers with exact retained source-range counts;
- parent/root artifact identity and supporting view IDs;
- partial application/semantic coverage and 36 unselected files;
- an explicit failure when a required item fact is missing;
- caller edits to a result cannot modify the retained snapshot's facts.

On those recorded inputs, current structured page plus 23 item envelopes were
325,215 UTF-8 bytes. The first projection was 15,471 bytes; retaining explicit
per-row confidence/authority and supporting observation states increased the
final projection to 17,989 bytes. This metadata is necessary, not discarded to
improve the byte count. The final probe, including detached result ownership,
used about 0.56 ms for its first projection. Whole-scope wall time was 0.322 s,
CPU at payload exit 0.096 s, and verified kernel cgroup peak 20,697,088 bytes.
It ran under the existing supervisor: one CPU, 8 GiB cap, 6 GiB early stop,
no swap; no OOM. These are local projection measurements, not analysis timing.

This is a serialization/contract probe. It does not measure agent tokens,
completed-task latency, live-provider behavior, or a new integrated query. It
does not replace production Evidence authentication/retention. The compact
representation benefits direct calls as well as code mode; bytes alone do not
establish a code-mode advantage.

Run with pinned Node and the existing resource supervisor:

```sh
node experiments/codemode-data-contract/module-reference-probe.mjs \
  /tmp/rea-codemode-experiment-20261015/obsidian-oracle
```

## Verification before integration and the next agent comparison

Implement the typed producer projection and shared application query first.
Verify actual CLI/MCP parity, exact references, ambiguous paths, duplicate batch
selectors, unknown fields, partial/truncated sources, cursor mismatch, changed
artifacts, cancellation, resource admission and SDK-converted schemas. Reuse
the original Obsidian artifact and Excalidraw capture, then add genuine tasks
requiring IPC/source or transaction joins; do not add target execution implicitly.

Compare separately:

| Condition                  | Data/query backend                | Interaction                                       |
| -------------------------- | --------------------------------- | ------------------------------------------------- |
| Existing direct workflow   | Existing views                    | Current direct tools                              |
| Redesigned direct workflow | New typed projection/query        | Direct calls, with batching                       |
| Redesigned code workflow   | Identical new query and snapshots | Generated SDK and actual model-written JavaScript |

The first comparison measures the data-interface change; the second measures
code composition with equivalent available facts. Preserve discovery/schema
costs, final identity transcription, errors and failed attempts. Verify actual
composition and a natural tool-feedback loop before scaling Terra-high runs.
Measure completed tasks, actual input/cached/output tokens, largest requests,
wall/CPU and process-family peak memory. Separate analysis preparation, cold and
warm runs and source completeness. Dossier and retained-answer variants should
be isolated follow-ups. Continue to accept null and negative outcomes.

Prior art: [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/) describes
typed APIs and multi-call composition; [Anthropic's MCP execution article](https://www.anthropic.com/engineering/code-execution-with-mcp)
describes on-demand discovery and filtering before model context. Their reported
benefits do not establish REA performance.
