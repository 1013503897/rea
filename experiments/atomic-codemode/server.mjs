// Complete experimental catalog; it does not truncate the production REA catalog.
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { methods, reference } from "./api.mjs";
import { AtomicSession } from "./session.mjs";
import { executeJavaScript } from "./executor.mjs";
import { referenceInput } from "./reference.mjs";
import { EXECUTION_LIMITS, MAX_MCP_RESULT_BYTES } from "./limits.mjs";
import { encodeMcpResult } from "./mcp-result-encoding.mjs";
import { projectFactFailure } from "./fact-error.mjs";
import { appendFile } from "node:fs/promises";

const DIRECT_REFERENCE_LANGUAGE =
  "Direct MCP calls: use the displayed facts_* tools with the same JSON arguments; results have {ok,context,data}.";
const executionInput = z.strictObject({
  code: z.string().min(1).max(EXECUTION_LIMITS.code_utf8_bytes),
  timeout_ms: z
    .number()
    .int()
    .min(EXECUTION_LIMITS.timeout_ms.minimum)
    .max(EXECUTION_LIMITS.timeout_ms.maximum)
    .default(EXECUTION_LIMITS.timeout_ms.default),
});
const mcpPayload = (name, observation) => {
  if (name !== "execute_javascript") return observation;
  const { calls, ...answer } = observation;
  return {
    ...answer,
    execution: { host_calls: calls?.length ?? 0 },
    authority: "script-derived",
    context: answer.context ?? null,
  };
};
const session = new AtomicSession();
const createServer = () => {
  const server = new McpServer({ name: "rea-codemode", version: "0.1.0" });
  const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
  const apiNames = Object.fromEntries(
    Object.keys(methods).map((name) => [
      name,
      direct ? `facts_${name}` : `rea.${name}`,
    ]),
  );
  const register = (name, description, inputSchema, handler) =>
    server.registerTool(
      name,
      { description, inputSchema, annotations: { readOnlyHint: true } },
      async (input, request) => {
        try {
          const observation = await handler(input, request.mcpReq.signal),
            calls = observation.calls,
            { result, reply } = encodeMcpResult(mcpPayload(name, observation));
          if (process.env.REA_ATOMIC_TRACE)
            await appendFile(
              process.env.REA_ATOMIC_TRACE,
              JSON.stringify({
                tool: name,
                input,
                result:
                  name === "execute_javascript" ? { ...result, calls } : result,
              }) + "\n",
              { mode: 0o600 },
            );
          return reply;
        } catch (error) {
          return encodeMcpResult({
            ok: false,
            context: session.context,
            error: projectFactFailure(error),
          }).reply;
        }
      },
    );
  register(
    "open_binary",
    "Open one local binary for static Kuna analysis. Returns artifact/engine identity and a target lease. Does not execute or modify the target.",
    z.strictObject({ path: z.string().min(1) }),
    (input) => session.open(input.path),
  );
  register(
    "close_binary",
    "Close this target lease and owned native resources; retained snapshots and Evidence expire.",
    z.strictObject({}),
    () => session.close(),
  );
  register(
    "reference",
    "Discover fact methods with view:index and an empty query: returns names and short intent summaries without schemas. Then request only needed full contracts and semantics with view:contracts and exact displayed names or canonical IDs separated by spaces/commas. One topic query searches full descriptions; empty query with view:contracts returns all contracts. These are static declared methods, not live provider availability.",
    referenceInput,
    (input) => ({
      ...reference(input.query, {
        names: apiNames,
        view: input.view,
        includeExamples: !direct,
        language: direct ? DIRECT_REFERENCE_LANGUAGE : undefined,
        execution: !direct,
      }),
      transport_limits: { mcp_result_utf8_bytes: MAX_MCP_RESULT_BYTES },
    }),
  );
  if (direct) {
    for (const [name, contract] of Object.entries(methods))
      register(
        apiNames[name],
        contract.description,
        contract.input,
        (input, signal) => session.call(name, input, signal),
      );
  } else {
    register(
      "execute_javascript",
      `Execute a JavaScript async function body against the open binary's atomic rea API. Use reference first. Await rea methods, compose/filter locally, and return a small JSON answer with evidence IDs and unknowns. Omit timeout_ms for the ${EXECUTION_LIMITS.timeout_ms.default} ms wall deadline (also the maximum); guest CPU is separately bounded. No Node/filesystem/network APIs. Fresh JS environment per call; analysis facts are reused across calls.`,
      executionInput,
      (input, signal) =>
        executeJavaScript(session, input.code, {
          signal,
          timeoutMs: input.timeout_ms,
        }),
    );
  }
  return server;
};
const handle = serveStdio(createServer, {
  onerror: (error) => process.stderr.write(`${error.message}\n`),
});
let closing;
const shutdown = () =>
  (closing ??= (async () => {
    session.abort();
    await session.close();
    await handle.close();
  })().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }));
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
process.stdin.once("end", shutdown);
