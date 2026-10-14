#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { estimateTokenCount } from "tokenx";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDirectory = resolve(
  process.env.REA_MCP_STARTUP_OUTPUT ?? join(sourceRoot, ".cache/mcp-startup-probe"),
);
const iterations = 5;
const requestTimeoutMs = 180_000;
const packageManifestPath = resolve(
  sourceRoot,
  ".cache/verified-package/manifest.json",
);
const packageArchivePath = resolve(
  sourceRoot,
  ".cache/verified-package/package.tgz",
);
const packageManifest = JSON.parse(await readFile(packageManifestPath, "utf8"));
const packageArchive = await readFile(packageArchivePath);
const packageSha256 = createHash("sha256").update(packageArchive).digest("hex");
const packageLockSha256 = createHash("sha256")
  .update(await readFile(join(sourceRoot, "package-lock.json")))
  .digest("hex");
assert.equal(packageSha256, packageManifest.sha256, "verified package digest mismatch");
assert.equal(
  packageManifest.sourceSha,
  process.env.REA_MCP_STARTUP_QUALIFIED_SHA,
  "package must match the exact qualification source",
);
assert.equal(process.version, "v24.18.0", "probe must use pinned Node 24.18.0");
assert.equal(process.platform, "win32");
await mkdir(outputDirectory, { recursive: true });

const metricsPreloadPath = join(outputDirectory, "server-metrics-preload.cjs");
await writeFile(
  metricsPreloadPath,
  `const fs = require("node:fs");\n` +
    `const started = process.hrtime.bigint();\n` +
    `const startedUsage = process.resourceUsage();\n` +
    `const metricsPath = process.env.REA_MCP_STARTUP_METRICS_PATH;\n` +
    `process.on("exit", () => {\n` +
    `  if (metricsPath === undefined) return;\n` +
    `  const ended = process.hrtime.bigint();\n` +
    `  const usage = process.resourceUsage();\n` +
    `  fs.writeFileSync(metricsPath, JSON.stringify({\n` +
    `    startedAt: new Date(Date.now() - Number(ended - started) / 1e6).toISOString(),\n` +
    `    processElapsedMs: Number(ended - started) / 1e6,\n` +
    `    userCPUTimeDeltaMicros: usage.userCPUTime - startedUsage.userCPUTime,\n` +
    `    systemCPUTimeDeltaMicros: usage.systemCPUTime - startedUsage.systemCPUTime,\n` +
    `    resourceUsageMaxRssRaw: usage.maxRSS,\n` +
    `    resourceUsageMaxRssUnit: "raw Node process.resourceUsage().maxRSS value; platform unit not converted",\n` +
    `    exitRssBytes: process.memoryUsage().rss\n` +
    `  }) + "\\n");\n` +
    `});\n`,
  "utf8",
);

const report = {
  schemaVersion: 1,
  host: {
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    npmVersion: process.env.REA_MCP_STARTUP_NPM_VERSION ?? null,
    cpuCount: Number(process.env.NUMBER_OF_PROCESSORS ?? 0) || null,
    osRelease: await import("node:os").then(({ release }) => release()),
  },
  diagnosticSha: process.env.GITHUB_SHA,
  sourcePackageLockSha256: packageLockSha256,
  package: {
    version: packageManifest.packageVersion,
    sourceSha: packageManifest.sourceSha,
    qualifiedRunId: packageManifest.runId,
    nodeVersion: packageManifest.nodeVersion,
    sha256: packageSha256,
  },
  conditions: {
    sourceEntry: "checked-out scripts/rea.mjs and locally source-built dist; first process starts after npm ci, build and artifact restoration",
    packagedEntry: "fresh npm install of the exact verified-release-package/package.tgz into an isolated prefix",
    samplesPerEntry: iterations,
    firstSampleMeaning: "first fresh server process after build or install; runner OS/filesystem/AV cache is uncontrolled and must not be called cold",
    subsequentSamples: "four additional fresh Node server processes; runner page cache may remain warm",
    providerDiscovery: "USERPROFILE/HOME/APPDATA/LOCALAPPDATA isolated per sample; no target selected and no provider engine launched",
    requestTimeoutMs,
    processFamilyMemory: "unmeasured; only the server Node process resourceUsage is reported",
    tokenEstimate: "tokenx estimate over every actual JSON-RPC message sent and received, including initialize, both tools/list calls, notifications and full results; estimate is not model billing",
    mcpExchanges: "complete parsed MCP JSON-RPC message objects are retained per sample, with monotonic elapsed offsets",
    instrumentation: "a minimal --require preload records one server Node process resourceUsage row on normal process exit",
  },
  entries: [],
  exchangeTotals: [],
};

const installPrefix = process.env.REA_MCP_STARTUP_INSTALL_PREFIX;
assert.ok(installPrefix, "REA_MCP_STARTUP_INSTALL_PREFIX is required");
const entryOptions = [
  {
    name: "source-tree",
    packageRoot: sourceRoot,
    entrypoint: join(sourceRoot, "scripts/rea.mjs"),
  },
  {
    name: "installed-package",
    packageRoot: resolve(installPrefix),
    entrypoint: resolve(
      installPrefix,
      "node_modules/rea-agents/scripts/rea.mjs",
    ),
  },
];
const selectedName = process.argv[2];
assert.ok(
  entryOptions.some(({ name }) => name === selectedName),
  "pass either source-tree or installed-package",
);
const previousReportPath = join(outputDirectory, "mcp-startup-report.json");
if (selectedName === "installed-package") {
  try {
    const previousReport = JSON.parse(await readFile(previousReportPath, "utf8"));
    report.entries.push(...previousReport.entries);
    report.exchangeTotals.push(...(previousReport.exchangeTotals ?? []));
    report.totalEstimatedTokenCount = previousReport.totalEstimatedTokenCount ?? 0;
  } catch (cause) {
    if (!(cause instanceof Error) || !("code" in cause) || cause.code !== "ENOENT")
      throw cause;
  }
}

for (const entry of entryOptions.filter(({ name }) => name === selectedName)) {
  assert.ok(entry.packageRoot, `${entry.name}: package root is required`);
  const entryReport = {
    name: entry.name,
    packageRoot: entry.packageRoot,
    serverEntrypoint: entry.entrypoint,
    samples: [],
  };
  report.entries.push(entryReport);

  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const sampleStartedAt = new Date().toISOString();
    const sampleStarted = performance.now();
    const messageLog = [];
    const stderrChunks = [];
    const metricsPath = join(
      outputDirectory,
      `${entry.name}-${String(iteration).padStart(2, "0")}-server.json`,
    );
    const serverEnvironment = isolatedServerEnvironment(
      entry.name,
      iteration,
      metricsPreloadPath,
      metricsPath,
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry.entrypoint, "mcp"],
      cwd: entry.packageRoot,
      env: serverEnvironment,
      stderr: "pipe",
    });
    transport.stderr?.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
    const elapsed = () => +(performance.now() - sampleStarted).toFixed(2);
    observeTransport(transport, messageLog, elapsed);
    const client = new Client({ name: "rea-1685-startup-probe", version: "1" });
    const sample = {
      iteration,
      firstProcessAfterBuildOrInstall: iteration === 1,
      startedAt: sampleStartedAt,
      launchElapsedMs: null,
      initializeElapsedMs: null,
      firstToolsListElapsedMs: null,
      firstToolsListDurationMs: null,
      warmToolsListElapsedMs: null,
      warmToolsListDurationMs: null,
      toolCount: null,
      firstToolsListResponseBytes: null,
      warmToolsListResponseBytes: null,
      firstToolsListWireRequests: 0,
      warmToolsListWireRequests: 0,
      serverVersion: null,
      closeRequestedElapsedMs: null,
      serverExitMetrics: null,
      serverExitMetricsError: null,
      stderr: "",
      stderrTruncated: false,
      stderrArtifact: null,
      stderrBytes: null,
      stderrSha256: null,
      messages: messageLog,
      error: null,
      completed: false,
    };
    entryReport.samples.push(sample);

    try {
      const originalStart = transport.start.bind(transport);
      let startBegin;
      transport.start = async (...arguments_) => {
        startBegin = performance.now();
        await originalStart(...arguments_);
        sample.launchElapsedMs = +(performance.now() - startBegin).toFixed(2);
      };
      const connectBegin = performance.now();
      await client.connect(transport, { timeout: requestTimeoutMs });
      sample.initializeElapsedMs = +(performance.now() - connectBegin).toFixed(2);
      sample.serverVersion = client.getServerVersion() ?? null;

      const priorToolListRequests = countToolListRequests(messageLog);
      const firstListBegin = performance.now();
      const firstList = await client.listTools(undefined, {
        timeout: requestTimeoutMs,
      });
      const firstListToolRequests = countToolListRequests(messageLog);
      sample.firstToolsListDurationMs = +(performance.now() - firstListBegin).toFixed(2);
      sample.firstToolsListElapsedMs = elapsed();
      sample.firstToolsListWireRequests =
        firstListToolRequests - priorToolListRequests;
      sample.toolCount = firstList.tools.length;
      sample.firstToolsListResponseBytes = Buffer.byteLength(
        JSON.stringify(firstList),
      );

      const warmListBegin = performance.now();
      const warmList = await client.listTools(undefined, {
        timeout: requestTimeoutMs,
        cacheMode: "refresh",
      });
      sample.warmToolsListWireRequests =
        countToolListRequests(messageLog) - firstListToolRequests;
      sample.warmToolsListDurationMs = +(performance.now() - warmListBegin).toFixed(2);
      sample.warmToolsListElapsedMs = elapsed();
      sample.warmToolsListResponseBytes = Buffer.byteLength(
        JSON.stringify(warmList),
      );
      assert.equal(warmList.tools.length, firstList.tools.length);
      assert.ok(sample.firstToolsListWireRequests > 0, "first tools/list must reach the server");
      assert.ok(sample.warmToolsListWireRequests > 0, "warm tools/list must reach the server");
      sample.completed = true;
    } catch (cause) {
      sample.error = cause instanceof Error ? cause.stack ?? cause.message : String(cause);
    } finally {
      sample.closeRequestedElapsedMs = elapsed();
      try {
        await client.close();
      } catch (cause) {
        sample.error ??= `MCP client close failed: ${cause instanceof Error ? cause.message : String(cause)}`;
      }
      try {
        await transport.close();
      } catch (cause) {
        sample.error ??= `stdio transport close failed: ${cause instanceof Error ? cause.message : String(cause)}`;
      }
      const stderr = Buffer.concat(stderrChunks);
      const stderrPath = join(
        outputDirectory,
        `${entry.name}-${String(iteration).padStart(2, "0")}.stderr.log`,
      );
      await writeFile(stderrPath, stderr);
      sample.stderrArtifact = stderrPath;
      sample.stderrBytes = stderr.length;
      sample.stderrSha256 = createHash("sha256").update(stderr).digest("hex");
      sample.stderr = stderr.toString("utf8");
      if (stderr.length > 1_000_000) {
        sample.stderr = stderr.subarray(-1_000_000).toString("utf8");
        sample.stderrTruncated = true;
      }
      try {
        sample.serverExitMetrics = await readExitMetrics(metricsPath, 15_000);
      } catch (cause) {
        sample.serverExitMetricsError = cause instanceof Error ? cause.message : String(cause);
      }
      sample.totalElapsedMs = elapsed();
      sample.estimatedTokenCount = messageLog.reduce(
        (total, { json }) => total + estimateTokenCount(json),
        0,
      );
      sample.messageCount = messageLog.length;
    }
  }
}

report.exchangeTotals = report.entries.flatMap(({ name, samples }) =>
  samples.map(({ iteration, messages, estimatedTokenCount, messageCount }) => ({
    entry: name,
    iteration,
    messageCount,
    estimatedTokenCount,
    transmittedUtf8Bytes: messages.reduce((total, { utf8Bytes }) => total + utf8Bytes, 0),
  })),
);
report.totalEstimatedTokenCount = report.exchangeTotals.reduce(
  (total, { estimatedTokenCount }) => total + estimatedTokenCount,
  0,
);

const reportPath = join(outputDirectory, "mcp-startup-report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  reportPath,
  diagnosticSha: report.diagnosticSha,
  runtimeQualifiedSha: report.package.sourceSha,
  packageSha256,
  nodeVersion: process.version,
  totalEstimatedTokenCount: report.totalEstimatedTokenCount,
  entries: report.entries.map(({ name, samples }) => ({
    name,
    samples: samples.map((sample) => ({
      iteration: sample.iteration,
      launchElapsedMs: sample.launchElapsedMs,
      initializeElapsedMs: sample.initializeElapsedMs,
      firstToolsListDurationMs: sample.firstToolsListDurationMs,
      warmToolsListDurationMs: sample.warmToolsListDurationMs,
      toolCount: sample.toolCount,
      serverMaxRssRaw: sample.serverExitMetrics?.resourceUsageMaxRssRaw ?? null,
      completed: sample.completed,
      error: sample.error,
    })),
  })),
})}\n`);

if (
  report.entries.some(({ samples }) =>
    samples.some(({ completed, serverExitMetrics }) => !completed || serverExitMetrics === null),
  )
)
  process.exitCode = 1;

function isolatedServerEnvironment(entryName, iteration, preloadPath, metricsPath) {
  const sampleRoot = join(
    tmpdir(),
    "rea-1685-mcp-startup",
    `${entryName}-${String(iteration).padStart(2, "0")}`,
  );
  const home = join(sampleRoot, "home");
  const appData = join(sampleRoot, "appdata");
  const localAppData = join(sampleRoot, "localappdata");
  const temp = join(sampleRoot, "temp");
  for (const path of [home, appData, localAppData, temp])
    requireMkdir(path);
  const environment = {};
  for (const key of [
    "PATH",
    "SystemRoot",
    "WINDIR",
    "ComSpec",
    "SystemDrive",
    "ProgramFiles",
    "ProgramW6432",
  ]) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  Object.assign(environment, {
    USERPROFILE: home,
    HOME: home,
    APPDATA: appData,
    LOCALAPPDATA: localAppData,
    TEMP: temp,
    TMP: temp,
    NODE_OPTIONS: `--require=${preloadPath}`,
    REA_MCP_STARTUP_METRICS_PATH: metricsPath,
  });
  return environment;
}

function requireMkdir(path) {
  mkdirSync(path, { recursive: true });
}

function observeTransport(transport, messages, elapsed) {
  const originalSend = transport.send.bind(transport);
  transport.send = async (message, ...arguments_) => {
    recordMessage("client-to-server", message, messages, elapsed);
    return originalSend(message, ...arguments_);
  };

  let messageHandler = transport.onmessage;
  Object.defineProperty(transport, "onmessage", {
    configurable: true,
    get: () => messageHandler,
    set: (handler) => {
      messageHandler =
        typeof handler === "function"
          ? (message) => {
              recordMessage("server-to-client", message, messages, elapsed);
              return handler(message);
            }
          : handler;
    },
  });
}

function recordMessage(direction, message, messages, elapsed) {
  const json = JSON.stringify(message);
  messages.push({
    direction,
    method: typeof message?.method === "string" ? message.method : null,
    id: typeof message?.id === "string" || typeof message?.id === "number" ? message.id : null,
    elapsedMs: elapsed(),
    utf8Bytes: Buffer.byteLength(json),
    json,
  });
}

function countToolListRequests(messages) {
  return messages.filter(
    (message) =>
      message.direction === "client-to-server" && message.method === "tools/list",
  ).length;
}

async function readExitMetrics(path, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (cause) {
      if (!(cause instanceof Error) || !("code" in cause) || cause.code !== "ENOENT")
        throw cause;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  }
  throw new Error(`Server process did not write exit metrics within ${timeoutMs} ms`);
}
