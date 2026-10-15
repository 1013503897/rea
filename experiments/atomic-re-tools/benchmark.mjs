import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import Ajv2020 from "ajv/dist/2020.js";
import { requireMcpOperationResult } from "../../scripts/lib/mcp-verifier-results.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [provider, variant, binary, pattern, prefix, verification] =
  process.argv.slice(2);
assert.ok(["ghidra", "kuna"].includes(provider));
assert.ok(["baseline", "fine", "batch", "workflow"].includes(variant));
assert.ok(binary && pattern && prefix);
await mkdir(dirname(prefix), { recursive: true });
const verifier = createVerifierRun();
const client = new Client({ name: "rea-atomic-experiment", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    resolve(
      variant === "baseline"
        ? "dist/main.js"
        : "experiments/atomic-re-tools/server.mjs",
    ),
  ],
  env: {
    ...process.env,
    REA_LOG_LEVEL: "error",
    REA_MCP_OUTPUT_SCHEMA_PROFILE:
      process.env.REA_MCP_OUTPUT_SCHEMA_PROFILE ?? "full",
    REA_KUNA_CACHE_DIR: resolve(`${prefix}.kuna-cache`),
    REA_KUNA_JOBS: "1",
    GHIDRA_HEADLESS_MAXMEM: "1G",
    REA_GHIDRA_STARTUP_TIMEOUT_MS: "120000",
  },
  stderr: "pipe",
});
let stderr = "";
transport.stderr?.on("data", (part) => {
  stderr = (stderr + part).slice(-32_768);
});
const wire = [],
  calls = [],
  checks = [],
  failures = [];
let phase = "lifecycle";
const call = async (name, arguments_ = {}, expectError = false) => {
  const started = performance.now();
  const response = await client.callTool(
    { name, arguments: arguments_ },
    { timeout: 180000 },
  );
  wire.push({ request: { name, arguments: arguments_ }, response, phase });
  calls.push({ name, phase, elapsed_ms: performance.now() - started });
  if (expectError) {
    assert.equal(response.isError, true);
    return JSON.parse(
      response.content.find((part) => part.type === "text").text,
    );
  }
  assert.notEqual(
    response.isError,
    true,
    JSON.stringify(response).slice(0, 2000),
  );
  return name.startsWith("experiment_")
    ? JSON.parse(response.content.find((part) => part.type === "text").text)
    : requireMcpOperationResult(response, name);
};
const contextInput = (context) => ({ ref: context.ref, lease: context.lease });
const stringLimit = 3,
  referenceLimit = 4;
const query = { pattern, mode: "literal", case_sensitive: true };
const identity = (row) => ({
  kind: "string",
  address: row.address,
  encoding: row.string?.encoding ?? null,
});

const readBatch = async (name, common, { key, items, individually }) => {
  if (!individually) return call(name, { ...common, [key]: items });
  const results = [];
  for (const item of items)
    results.push(...(await call(name, { ...common, [key]: [item] })).results);
  return { results };
};
const readExperimentalTask = async (supportsOwners) => {
  const input = { query, limit: stringLimit, fields: ["value"] };
  if (variant === "workflow") {
    const traced = await call("experiment_trace_string_uses", {
      ...input,
      reference_limit: referenceLimit,
    });
    return {
      found: traced.strings,
      refs: traced.references,
      owners: traced.functions,
    };
  }
  const found = await call("experiment_find_strings", input);
  const context = contextInput(found.context);
  const refs = await readBatch(
    "experiment_incoming_refs",
    { context, limit: referenceLimit },
    {
      key: "targets",
      items: found.items.map((row) => row.id),
      individually: variant === "fine",
    },
  );
  const locations = [
    ...new Map(
      refs.results
        .flatMap((row) => row.items ?? [])
        .map((row) => [row.from.address, row.from]),
    ).values(),
  ];
  const owners = await readBatch(
    "experiment_resolve_functions",
    { context },
    {
      key: "locations",
      items: locations,
      individually: variant === "fine" && supportsOwners,
    },
  );
  return { found, refs, owners };
};

let catalog,
  firstSourceId,
  firstContext,
  outcomes = [];
try {
  await client.connect(transport);
  catalog = await client.listTools();
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  for (const tool of catalog.tools.filter((tool) =>
    tool.name.startsWith("experiment_"),
  )) {
    assert.equal(
      ajv.validateSchema(tool.inputSchema),
      true,
      JSON.stringify(ajv.errors),
    );
    ajv.compile(tool.inputSchema);
  }
  await call("open_binary", { path: resolve(binary), provider_id: provider });
  const status = await call("binary_session");
  const supportsOwners = status.capabilities.some(
    (row) => row.operation === "resolve_containing_procedure" && row.available,
  );
  for (phase of ["cold", "warm"]) {
    const started = performance.now();
    let strings, references, functions;
    if (variant === "baseline") {
      const all = await call("search_strings", query);
      strings = all
        .slice(0, stringLimit)
        .map((row) => ({ id: identity(row), value: row.value }));
      references = [];
      for (const string of strings)
        references.push({
          target: string.id,
          items: (await call("xrefs", { address: string.id.address })).slice(
            0,
            referenceLimit,
          ),
        });
      const locations = [...new Set(references.flatMap((row) => row.items))];
      functions = [];
      for (const address of locations)
        functions.push(
          supportsOwners
            ? {
                address,
                resolution: await call("resolve_containing_procedure", {
                  address,
                }),
              }
            : { address, status: "unknown" },
        );
    } else {
      const { found, refs, owners } =
        await readExperimentalTask(supportsOwners);
      assert.equal(found.status, "ok");
      assert.ok(refs.results.every((row) => row.status === "ok"));
      firstSourceId ??= found.evidence_id;
      firstContext ??= found.context;
      strings = found.items.map((row) => ({ id: row.id, value: row.value }));
      references = refs.results.map((row) => ({
        target: row.target,
        items: row.items.map((edge) => edge.from.address),
      }));
      functions = owners.results.map((row) =>
        row.status === "ok"
          ? { address: row.location.address, resolution: row.resolution }
          : { address: row.location.address, status: "unknown" },
      );
    }
    outcomes.push({
      phase,
      elapsed_ms: performance.now() - started,
      strings,
      references,
      functions,
    });
  }
  assert.deepEqual(outcomes[0].strings, outcomes[1].strings);
  assert.deepEqual(outcomes[0].references, outcomes[1].references);
  assert.deepEqual(outcomes[0].functions, outcomes[1].functions);
  assert.ok(outcomes[0].strings.length > 0);
  phase = "verification";
  if (variant !== "baseline" && verification === "--verify") {
    const raw = await call("experiment_read_evidence", {
      evidence_id: firstSourceId,
    });
    assert.equal(raw.evidence.operation, "search_strings");
    assert.equal(
      raw.evidence.analysis_profile.digest,
      firstContext.analysis_profile_digest,
    );
    assert.equal(
      raw.evidence.subject.digest.sha256,
      createHash("sha256")
        .update(await readFile(binary))
        .digest("hex"),
    );
    assert.deepEqual(
      raw.evidence.normalized_result
        .slice(0, stringLimit)
        .map((row) => ({ id: identity(row), value: row.value })),
      outcomes[0].strings,
    );
    const duplicate = await call("experiment_incoming_refs", {
      context: contextInput(firstContext),
      targets: [outcomes[0].strings[0].id, outcomes[0].strings[0].id],
      limit: 1,
    });
    assert.deepEqual(duplicate.results[0], duplicate.results[1]);
    const nextPage = await call("experiment_find_strings", {
      query,
      offset: stringLimit,
      limit: stringLimit,
    });
    assert.deepEqual(
      nextPage.items.map((row) => row.id),
      raw.evidence.normalized_result
        .slice(stringLimit, stringLimit * 2)
        .map(identity),
    );
    const negative = await call("experiment_find_strings", {
      query: { pattern: "\u0000REA-atomic-negative\u0000" },
    });
    assert.equal(negative.items.length, 0);
    assert.equal(negative.coverage.status, "unknown");
    const stale = await call(
      "experiment_incoming_refs",
      {
        context: {
          ref: "different-artifact-or-profile",
          lease: firstContext.lease,
        },
        targets: [outcomes[0].strings[0].id],
      },
      true,
    );
    assert.equal(stale.status, "error");
    await call("close_binary");
    assert.equal(
      (
        await call(
          "experiment_read_evidence",
          { evidence_id: firstSourceId },
          true,
        )
      ).error.code,
      "not_found",
    );
    await call("open_binary", { path: resolve(binary), provider_id: provider });
    const expired = await call(
      "experiment_incoming_refs",
      {
        context: contextInput(firstContext),
        targets: [outcomes[0].strings[0].id],
      },
      true,
    );
    assert.equal(expired.status, "error");
    checks.push(
      "retained-evidence",
      "paging",
      "duplicate-targets",
      "negative-unknown",
      "foreign-context",
      "expired-lease",
    );
  }
} catch (error) {
  failures.push(String(error.stack ?? error));
}
phase = "lifecycle";
try {
  await call("close_binary");
} catch (error) {
  failures.push(String(error));
}
await client.close().catch((error) => failures.push(String(error)));
await transport.close().catch((error) => failures.push(String(error)));
const lifecycle = await completeVerifierRun(verifier);
try {
  assertVerifierCleanupComplete(lifecycle.process_lineage);
} catch (error) {
  failures.push(String(error));
}
const report = {
  provider,
  variant,
  binary: resolve(binary),
  pattern,
  node_version: process.versions.node,
  target_sha256: createHash("sha256")
    .update(await readFile(binary))
    .digest("hex"),
  string_limit: stringLimit,
  reference_limit: referenceLimit,
  outcomes,
  calls,
  checks,
  failures,
  verification_only: verification === "--verify",
  lifecycle,
};
await writeFile(`${prefix}.wire.json`, JSON.stringify(wire));
await writeFile(`${prefix}.catalog.json`, JSON.stringify(catalog));
await writeFile(`${prefix}.report.json`, JSON.stringify(report, null, 2));
await writeFile(`${prefix}.stderr.txt`, stderr);
console.log(
  JSON.stringify({
    provider,
    variant,
    calls: calls.length,
    outcomes: outcomes.map(({ strings, references, functions, ...rest }) => ({
      ...rest,
      strings: strings.length,
      references: references.flatMap((row) => row.items).length,
      functions: functions.length,
    })),
    failures,
  }),
);
assert.deepEqual(failures, []);
