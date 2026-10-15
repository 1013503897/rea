// Contract probe over real, already-retained REA results. Not a public tool,
// source parser, provider implementation, or agent-performance benchmark.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const encode = (value) => JSON.stringify(value);
const size = (value) => Buffer.byteLength(encode(value));

function moduleReferences(snapshot, input) {
  if (input.kind !== "javascript-module" || input.projection !== "references")
    return { ok: false, error: { tag: "unsupported_projection" } };
  const matches = snapshot.page.normalized_result.items.filter(
    (row) => row.path === input.path && row.kind === input.kind,
  );
  const missing = matches.filter((row) => !snapshot.items.has(row.node_id));
  if (missing.length)
    return {
      ok: false,
      error: {
        tag: "unavailable_item_facts",
        node_ids: missing.map((row) => row.node_id),
      },
    };
  const owners = matches.map((row) => snapshot.items.get(row.node_id));
  return structuredClone({
    ok: true,
    value: {
      rows: owners.map((owner) => {
        const item = owner.normalized_result.item;
        return {
          node_id: item.node_id,
          path: item.path,
          kind: item.kind,
          identity: item.identity,
          retained_source_range_count: item.source_ranges.length,
          basis: {
            authority: owner.authority,
            confidence: owner.confidence,
            supporting_observation_states: [
              ...new Set(
                item.observations.map(
                  (observation) => observation.evidence.state,
                ),
              ),
            ],
          },
        };
      }),
      source: {
        parent_evidence_id: snapshot.page.normalized_result.parent_evidence_id,
        artifact_sha256: snapshot.page.subject.digest.sha256,
        supporting_view_evidence_ids: owners.map((owner) => owner.evidence_id),
      },
      coverage: {
        scope: "matching identities in the retained module inventory",
        inventory_exhausted: snapshot.page.normalized_result.coverage.exhausted,
        matched: matches.length,
        returned: owners.length,
        source_selection: snapshot.summary.source_selection,
        application: snapshot.summary.coverage.application,
        semantic: snapshot.summary.coverage.semantic,
      },
      limitations: snapshot.page.limitations,
    },
  });
}

const directory = process.argv[2];
if (!directory?.startsWith("/"))
  throw new Error("Pass the absolute Obsidian oracle directory from the pilot");
const records = [];
for (const name of await readdir(directory)) {
  if (!/^call-\d+\.json$/u.test(name)) continue;
  const response = JSON.parse(await readFile(resolve(directory, name), "utf8"));
  const evidence = response.structuredContent;
  assert.ok(evidence && !response.isError);
  records.push(evidence);
}
const page = records.find(
  (record) =>
    record.normalized_result.kind === "page" &&
    record.normalized_result.view.collection === "modules",
);
assert.ok(page?.normalized_result.coverage.exhausted);
assert.equal(page.normalized_result.view.offset, 0);
const parent = page.normalized_result.parent_evidence_id;
assert.ok(
  records.every(
    (record) => record.normalized_result.parent_evidence_id === parent,
  ),
);
const summary = records.find(
  (record) => record.normalized_result.kind === "summary",
)?.normalized_result.summary;
assert.ok(summary);
const items = new Map(
  records
    .filter((record) => record.normalized_result.kind === "item")
    .map((record) => [record.normalized_result.item.node_id, record]),
);
const snapshot = { page, summary, items };
const input = {
  path: "main.js",
  kind: "javascript-module",
  projection: "references",
};
const started = performance.now();
const result = moduleReferences(snapshot, input);
const projectionMs = performance.now() - started;
assert.ok(result.ok);
assert.equal(result.value.rows.length, 23);

// Ordinary JavaScript chooses the task-specific interpretation, using canonical
// owner-projected identity fields. REA need not add an Obsidian-specific tool.
const externalSpecifiers = {};
for (const row of result.value.rows) {
  if (
    row.identity.namespace !== "unresolved-semantic-module" ||
    !row.identity.key.startsWith("external:")
  )
    continue;
  const name = row.identity.key.slice("external:".length);
  externalSpecifiers[name] =
    (externalSpecifiers[name] ?? 0) + row.retained_source_range_count;
}
assert.deepEqual(externalSpecifiers, {
  child_process: 1,
  crypto: 1,
  electron: 2,
  fs: 3,
  net: 1,
  "original-fs": 2,
  os: 2,
  path: 3,
  url: 1,
  util: 1,
});
const missingItems = new Map(items);
missingItems.delete(result.value.rows[0].node_id);
assert.equal(
  moduleReferences({ ...snapshot, items: missingItems }, input).error.tag,
  "unavailable_item_facts",
);
assert.equal(result.value.coverage.application.status, "partial");
assert.equal(result.value.coverage.source_selection.unselected_files, 36);
const editableResult = moduleReferences(snapshot, input);
const originalKey = editableResult.value.rows[0].identity.key;
editableResult.value.rows[0].identity.key = "caller-edited";
editableResult.value.coverage.application.status = "caller-edited";
assert.equal(
  moduleReferences(snapshot, input).value.rows[0].identity.key,
  originalKey,
);
assert.equal(
  moduleReferences(snapshot, input).value.coverage.application.status,
  "partial",
);
const selectedOwners = result.value.rows.map((row) => items.get(row.node_id));
process.stdout.write(
  encode({
    scope:
      "Recorded real Obsidian Evidence; projection/serialization probe only",
    parent_evidence_id: parent,
    artifact_sha256: result.value.source.artifact_sha256,
    current_structured_views_bytes: size({ page, items: selectedOwners }),
    proposed_projection_bytes: size(result),
    projection_ms: projectionMs,
    output_sha256: createHash("sha256").update(encode(result)).digest("hex"),
    external_specifiers: externalSpecifiers,
    assertions:
      "23 canonical module identities; exact 10 specifiers/counts; missing facts fail; source partiality retained; caller edits cannot poison snapshot",
    measured_agent_tokens: null,
    measured_agent_latency: null,
    live_provider_verification: false,
  }) + "\n",
);
