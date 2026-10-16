// Capture the existing public MCP function dossier, without changing its contract.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  requireMcpOperationResult,
  requireMcpToolError,
} from "../../scripts/lib/mcp-verifier-results.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [provider, binary, procedure, prefix] = process.argv.slice(2);
assert.ok(
  ["ghidra", "kuna"].includes(provider) && binary && procedure && prefix,
);
await mkdir(dirname(prefix), { recursive: true });
const verifier = createVerifierRun();
const client = new Client({
  name: "rea-relation-experiment",
  version: "0.1.0",
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("dist/main.js")],
  env: {
    ...process.env,
    REA_LOG_LEVEL: "error",
    REA_MCP_OUTPUT_SCHEMA_PROFILE: "off",
    GHIDRA_HEADLESS_MAXMEM: "1G",
    REA_GHIDRA_STARTUP_TIMEOUT_MS: "120000",
    REA_KUNA_CACHE_DIR: resolve(`${prefix}.kuna-cache`),
    REA_KUNA_JOBS: "1",
  },
  stderr: "pipe",
});
let stderr = "";
transport.stderr?.on("data", (part) => {
  stderr = (stderr + part).slice(-32_768);
});
const wire = [],
  calls = [],
  failures = [];
let catalog;
const call = async (name, arguments_ = {}, acceptRetained = false) => {
  const start = performance.now();
  const response = await client.callTool(
    { name, arguments: arguments_ },
    { timeout: 180000 },
  );
  wire.push({ request: { name, arguments: arguments_ }, response });
  calls.push({ name, elapsed_ms: performance.now() - start });
  if (response.isError === true && acceptRetained) {
    const error = requireMcpToolError(response);
    const source = error.details?.reported_limits?.evidence_reference;
    assert.equal(error.code, "resource_constraint");
    assert.equal(source?.kind, "retained-evidence");
    await call("inspect_analysis_view", {
      source,
      view: { kind: "native", facet: "value_flow_summary" },
    });
    return { retained: source, initial_error: error };
  }
  assert.notEqual(
    response.isError,
    true,
    JSON.stringify(response).slice(0, 1600),
  );
  return requireMcpOperationResult(response, name);
};
try {
  await client.connect(transport);
  catalog = await client.listTools();
  assert.ok(
    catalog.tools.every((tool) => !Object.hasOwn(tool, "outputSchema")),
  );
  await call("open_binary", { path: resolve(binary), provider_id: provider });
  await call("binary_session");
  for (const phase of ["first", "warm"]) {
    const dossier = await call("analyze_function", { procedure }, true);
    await writeFile(`${prefix}.${phase}.json`, JSON.stringify(dossier));
  }
  await call("export_evidence_bundle", {
    path: resolve(`${prefix}.bundle.json`),
  });
} catch (error) {
  failures.push(String(error.stack ?? error));
} finally {
  try {
    await call("close_binary");
  } catch (error) {
    failures.push(String(error));
  }
  await client.close().catch((error) => failures.push(String(error)));
  await transport.close().catch((error) => failures.push(String(error)));
}
const lifecycle = await completeVerifierRun(verifier);
let cleanupVerified = false;
try {
  assertVerifierCleanupComplete(lifecycle.process_lineage);
  cleanupVerified = true;
} catch (error) {
  failures.push(String(error));
}
await writeFile(`${prefix}.wire.json`, JSON.stringify(wire));
await writeFile(`${prefix}.catalog.json`, JSON.stringify(catalog));
await writeFile(`${prefix}.stderr.txt`, stderr);
const report = {
  provider,
  binary: resolve(binary),
  procedure,
  target_sha256: createHash("sha256")
    .update(await readFile(binary))
    .digest("hex"),
  node_version: process.versions.node,
  calls,
  failures,
  lifecycle,
};
await writeFile(`${prefix}.report.json`, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    provider,
    calls,
    failures,
    cleanup_verified: cleanupVerified,
  }),
);
if (failures.length) process.exitCode = 1;
