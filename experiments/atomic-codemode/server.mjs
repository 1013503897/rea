// Complete experimental catalog; it does not truncate the production REA catalog.
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { AtomicSession, methods, reference } from "./api.mjs";
import { executeJavaScript } from "./executor.mjs";
import { TARGET_CONTENT_RESULT_META } from "../../dist/server/toolResultEncoding.js";
import { appendFile } from "node:fs/promises";

const session = new AtomicSession();
const createServer = () => {
  const server = new McpServer({ name: "rea-codemode", version: "0.1.0" });
  const encode = (value) => ({
    content: [{ type: "text", text: JSON.stringify(value) }],
    _meta: TARGET_CONTENT_RESULT_META,
  });
  const register = (name, description, inputSchema, handler) =>
    server.registerTool(
      name,
      { description, inputSchema, annotations: { readOnlyHint: true } },
      async (input, request) => {
        try {
          const result = await handler(input, request.mcpReq.signal);
          if (process.env.REA_ATOMIC_TRACE)
            await appendFile(
              process.env.REA_ATOMIC_TRACE,
              JSON.stringify({ tool: name, input, result }) + "\n",
              { mode: 0o600 },
            );
          if (name === "execute_javascript") {
            const { calls, ...answer } = result;
            return encode({
              ...answer,
              execution: { host_calls: calls?.length ?? 0 },
              authority: "script-derived",
              context: answer.context ?? null,
            });
          }
          return encode(result);
        } catch (error) {
          return encode({
            ok: false,
            context: session.context,
            error: {
              code: error.code ?? "analysis_failed",
              message: error.message,
              details: error.details ?? {},
            },
          });
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
    "Look up the rea JavaScript API by method name or analyst concept before writing Code Mode calls. Empty query returns the complete API reference.",
    z.strictObject({ query: z.string().default("") }),
    (input) => {
      const docs = reference(input.query);
      if (process.env.REA_ATOMIC_ADAPTER === "direct") {
        docs.language =
          "Direct MCP calls: use facts_<method> with the same JSON arguments; results have {ok,context,data}.";
        docs.methods = docs.methods.map((method) => ({
          ...method,
          name: method.name.replace("rea.", "facts_"),
          example: undefined,
        }));
      }
      return docs;
    },
  );
  if (process.env.REA_ATOMIC_ADAPTER === "direct") {
    for (const [name, contract] of Object.entries(methods))
      register(
        `facts_${name}`,
        contract.description,
        contract.input,
        (input, signal) => session.call(name, input, signal),
      );
  } else {
    register(
      "execute_javascript",
      "Execute a JavaScript async function body against the open binary's atomic rea API. Use reference first. Await rea methods, compose/filter locally, and return a small JSON answer with evidence IDs and unknowns. No Node/filesystem/network APIs. Fresh JS environment per call; analysis facts are reused across calls.",
      z.strictObject({
        code: z.string().min(1).max(32768),
        timeout_ms: z.number().int().min(100).max(120000).default(120000),
      }),
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
