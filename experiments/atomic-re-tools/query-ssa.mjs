// A composition over one validated, immutable snapshot; no new engine work.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { backwardSlice, parseKunaSsaDump } from "./kuna-ssa.mjs";
import { assertVerifierCleanupComplete } from "../../scripts/lib/verifier-run.mjs";

export const queryLiteralUses = (snapshot, literal, maxOperations = 48) => {
  const allSeeds = snapshot.findConstant(literal);
  const seeds = allSeeds.slice(0, 16);
  const allUses = [
    ...new Set(seeds.flatMap((id) => snapshot.uses(id).map((e) => e.use))),
  ];
  const selectedUses = allUses.slice(0, 16);
  const consumers = selectedUses.map((id) => snapshot.operation(id));
  const controlEdges = consumers.flatMap((row) => snapshot.incoming(row.block));
  const branchIds = [
    ...new Set(
      controlEdges.flatMap((edge) =>
        edge.operation === null ? [] : [edge.operation],
      ),
    ),
  ];
  const guards = backwardSlice(snapshot, branchIds, { maxOperations });
  const facts = [
    ...new Map(
      [
        ...seeds.map((id) => snapshot.operation(id)),
        ...consumers,
        ...guards.operations,
      ].map((row) => [row.id, row]),
    ).values(),
  ];
  const selected = new Set(facts.map((row) => row.id));
  return {
    literal,
    snapshot: snapshot.identity,
    constant_operations: seeds,
    direct_uses: selectedUses,
    control_edges: controlEdges,
    operations: facts,
    coverage: {
      status: "partial",
      seed_matches: allSeeds.length,
      omitted_seed_matches: allSeeds.length - seeds.length,
      omitted_direct_uses: allUses.length - selectedUses.length,
      dependencies: guards.coverage,
      unexpanded_definition_ids: [
        ...new Set(
          facts.flatMap((row) =>
            row.definitions
              .filter((edge) => !selected.has(edge.definition))
              .map((edge) => edge.definition),
          ),
        ),
      ],
      control_flow: snapshot.coverage.control_flow,
      unrepresented_outgoing_blocks:
        snapshot.coverage.unrepresented_outgoing_blocks.length,
      source_issues: snapshot.coverage.issues.length,
      scope:
        "literal equality, its direct printed uses, their explicit incoming edges and bounded branch definitions",
      address_object_identity: "unknown",
      call_argument_bindings: "unknown",
    },
  };
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const main = async () => {
  const [prefix, values, output] = process.argv.slice(2);
  assert.ok(prefix && values && output);
  const literals = values.split(",");
  assert.ok(
    literals.length <= 16 &&
      literals.every((s) => /^0x[0-9a-f]{1,16}$/u.test(s)),
  );
  const report = JSON.parse(await readFile(`${prefix}.report.json`, "utf8"));
  assert.equal(report.view, "raw");
  assert.deepEqual(report.failures, []);
  assert.equal(report.calls.length, 1);
  assert.equal(
    report.engine.version,
    "1.833",
    "Decoder is pinned to the inspected printer format",
  );
  assertVerifierCleanupComplete(report.lifecycle.process_lineage);
  const source = report.calls[0];
  const raw = await readFile(source.file, "utf8");
  assert.equal(sha256(raw), source.sha256);
  assert.equal(Buffer.byteLength(raw), source.bytes);
  assert.equal(
    sha256(await readFile(report.binary)),
    report.target_sha256,
    "Artifact changed since capture",
  );
  const start = performance.now();
  const snapshot = parseKunaSsaDump(raw);
  const parseIndexMs = performance.now() - start;
  const runs = [];
  for (const phase of ["first-projection", "reused-index"]) {
    const before = performance.now();
    const answers = literals.map((literal) =>
      queryLiteralUses(snapshot, literal),
    );
    const serialized = JSON.stringify(answers);
    runs.push({
      phase,
      query_and_serialization_ms: performance.now() - before,
      answers,
      serialized_bytes: Buffer.byteLength(serialized),
    });
  }
  assert.deepEqual(runs[0].answers, runs[1].answers);
  await writeFile(
    output,
    JSON.stringify(
      {
        source: {
          artifact_sha256: report.target_sha256,
          engine: report.engine,
          procedure: report.procedure,
          capture_report: `${prefix}.report.json`,
          raw: source,
          profile:
            "one-function native decompile defaults + --raw; no annotations",
        },
        parse_index_ms: parseIndexMs,
        coverage: snapshot.coverage,
        runs,
        lifetime:
          "One local process; validated immutable snapshot reused without native analysis. No cross-session cache.",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      output,
      parse_index_ms: parseIndexMs,
      runs: runs.map(({ answers, ...timing }) => ({
        ...timing,
        selected_operations: answers.map((a) => a.operations.length),
      })),
    }),
  );
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
