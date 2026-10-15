// Experimental tools are added to the complete production catalog, never shipped.
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { run } from "../../dist/main.js";
import { createServer } from "../../dist/server/createServer.js";
import { createEvidence } from "../../dist/domain/evidence.js";
import { projectAnalysisError } from "../../dist/domain/analysisErrorProjection.js";
import { toolContract } from "../../dist/contracts/toolContracts.js";
import { expandProviderCapabilities } from "../../dist/contracts/toolOutputSchemaPrimitives.js";
import { FactQueries, contextFor } from "./facts.mjs";

const contextSchema = z.strictObject({ ref: z.string(), lease: z.string() });
const location = z.strictObject({
  kind: z.literal("location"),
  address: z.string().min(1),
});
const stringId = z.strictObject({
  kind: z.literal("string"),
  address: z.string().min(1),
  encoding: z.string().nullable(),
});
const paging = {
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().default(20),
};
const stringsInput = z.strictObject({
  query: toolContract("search_strings").inputSchema,
  ...paging,
  fields: z.array(z.enum(["value", "string"])).default(["value"]),
});
const contracts = [
  [
    "experiment_find_strings",
    "Find string facts with scoped identities, selected fields, paging and retained source Evidence. Experimental; provider discovery coverage remains unknown.",
    stringsInput,
    "findStrings",
  ],
  [
    "experiment_incoming_refs",
    "Read incoming reference facts for a batch of string identities from this session. Preserve per-target failures and unknown reference kinds. Reuse the context ref and lease returned by find_strings.",
    z.strictObject({
      context: contextSchema,
      targets: z.array(stringId),
      ...paging,
    }),
    "incomingReferences",
  ],
  [
    "experiment_resolve_functions",
    "Resolve a batch of instruction locations to provider-analyzed containing functions. Unsupported or failed resolution stays unknown; never guess the nearest symbol.",
    z.strictObject({ context: contextSchema, locations: z.array(location) }),
    "resolveFunctions",
  ],
  [
    "experiment_trace_string_uses",
    "Compose the same string, incoming reference and containing-function facts in one call. Page limits and partial outcomes remain explicit.",
    stringsInput.extend({
      reference_limit: z.number().int().positive().default(20),
      include_functions: z.boolean().default(true),
    }),
    "traceStringUses",
  ],
];

const encode = (value) => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
  structuredContent: value,
  ...(value.status === "error" ? { isError: true } : {}),
});

const createFacts = (session, analysis, signal) => {
  const status = session.status();
  const context = contextFor(
    session.activeTarget().sha256,
    session.analysisProfile("search_strings"),
    status.analysis_run.run_id,
  );
  const capabilities = expandProviderCapabilities(status.capabilities);
  const facts = new FactQueries({
    supports: (operation) =>
      capabilities.some(
        (capability) =>
          capability.operation === operation && capability.available,
      ),
    context: () => context,
    observe: async (operation, parameters) => {
      const outcome = await analysis.execute(
        operation,
        toolContract(operation).inputSchema.parse(parameters),
        { signal: signal },
      );
      if (!outcome.ok)
        return {
          ok: false,
          error: projectAnalysisError(outcome.error),
        };
      const execution = outcome.value;
      const evidence = createEvidence(
        execution.subject ?? session.activeTarget(),
        execution.provider,
        {
          operation,
          parameters,
          result: execution.result,
          analysisProfile: execution.analysisProfile,
          rawResult: execution.rawResult,
          limitations: execution.limitations,
          relationshipCoverage: execution.relationshipCoverage,
          locations: execution.locations,
        },
      );
      const recorded = session.recordEvidence(evidence);
      return recorded.ok
        ? { ok: true, value: evidence }
        : {
            ok: false,
            error: projectAnalysisError(recorded.error),
          };
    },
  });

  return facts;
};

await run({
  env: process.env,
  serve: serveStdio,
  writeStderr: (value) => process.stderr.write(value),
  setExitCode: (value) => {
    process.exitCode = value;
  },
  registerShutdown: (handler) => {
    const registrations = [
      [process, "SIGINT"],
      [process, "SIGTERM"],
      [process.stdin, "end"],
      [process.stdin, "close"],
    ];
    for (const [emitter, event] of registrations) emitter.once(event, handler);
    return () => {
      for (const [emitter, event] of registrations) emitter.off(event, handler);
    };
  },
  createServer(source, options) {
    const server = createServer(source, options);
    const session = source.session;
    for (const [name, description, inputSchema, method] of contracts) {
      server.registerTool(
        name,
        { description, inputSchema, annotations: { readOnlyHint: true } },
        async (input, request) => {
          const admitted = await session.withAdmittedAnalysis(
            name,
            request.mcpReq.signal,
            async (analysis) => {
              const facts = createFacts(
                session,
                analysis,
                request.mcpReq.signal,
              );
              return facts[method](inputSchema.parse(input));
            },
          );
          return encode(
            admitted.ok
              ? admitted.value
              : {
                  status: "error",
                  error: projectAnalysisError(admitted.error),
                },
          );
        },
      );
    }
    server.registerTool(
      "experiment_read_evidence",
      {
        description:
          "Read complete retained source Evidence explicitly by evidence_id while the existing session record owner retains it. Closing the binary expires these records.",
        inputSchema: z.strictObject({ evidence_id: z.string().min(1) }),
        annotations: { readOnlyHint: true },
      },
      (input) => {
        const evidence = session.evidenceById(input.evidence_id);
        return encode(
          evidence === undefined
            ? {
                status: "error",
                error: {
                  code: "not_found",
                  message: "Evidence is not retained in this server.",
                },
              }
            : { status: "ok", evidence },
        );
      },
    );
    return server;
  },
});
