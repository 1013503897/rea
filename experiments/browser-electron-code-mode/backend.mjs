import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createJavaScriptClient } from "../codemode-data-contract/client.mjs";
import { moduleReferenceDiscovery } from "../codemode-data-contract/discovery.mjs";

const settings = JSON.parse(await readFile(process.argv[2], "utf8"));
const resultCalls = settings.code_api === "typed-result";
const asynchronous = settings.code_api === "typed-async" || resultCalls;
await mkdir(settings.output, { recursive: true, mode: 0o700 });
const client = new Client({ name: "rea-organization-pilot", version: "1" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(settings.runtime, "scripts/rea.mjs"), "mcp"],
  env: {
    ...process.env,
    REA_LOG_LEVEL: "silent",
    NODE_OPTIONS: "--max-old-space-size=512",
  },
  stderr: "pipe",
});
const closeClient = async () => {
  try {
    await client.close();
  } finally {
    await transport.close();
  }
};
let contracts;
let narrowDiscovery;
try {
  await client.connect(transport);
  transport.stderr?.resume();
  const allTools = (await client.listTools()).tools;
  contracts = allTools.filter(({ name }) => settings.tools.includes(name));
  if (contracts.length !== settings.tools.length)
    throw new Error("Unknown allowed tool");
  if (asynchronous && (!resultCalls || settings.view_namespace !== "capture"))
    narrowDiscovery = await moduleReferenceDiscovery(
      settings.runtime,
      resultCalls,
    );
} catch (error) {
  try {
    await closeClient();
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      "Backend startup and cleanup failed",
    );
  }
  throw error;
}
let ordinal = 0;
let wasm;

const call = async (name, args) => {
  if (!settings.tools.includes(name))
    throw new Error("Tool outside the experiment allowlist");
  if (ordinal >= 64)
    throw new Error(
      "Trial backend-call limit reached (64 including preparation)",
    );
  const index = ++ordinal;
  const started = performance.now();
  let response;
  try {
    response = await client.callTool(
      { name, arguments: args },
      { timeout: 360_000 },
    );
  } catch (error) {
    await appendFile(
      resolve(settings.output, "calls.jsonl"),
      JSON.stringify({
        ordinal: index,
        name,
        arguments: args,
        elapsed_ms: performance.now() - started,
        transport_error: String(error),
      }) + "\n",
    );
    throw error;
  }
  const value = response.structuredContent ?? response;
  const filename = `call-${String(index).padStart(3, "0")}.json`;
  await writeFile(resolve(settings.output, filename), JSON.stringify(response));
  await appendFile(
    resolve(settings.output, "calls.jsonl"),
    JSON.stringify({
      ordinal: index,
      name,
      arguments: args,
      elapsed_ms: performance.now() - started,
      is_error: response.isError === true,
      evidence_id: value.evidence_id ?? null,
      structured_bytes: Buffer.byteLength(JSON.stringify(value)),
      response_file: filename,
    }) + "\n",
  );
  return value;
};

const describe = (name) => {
  if (narrowDiscovery && name === "inspect_analysis_view")
    return narrowDiscovery;
  if (name === "inspect_analysis_view.complete" && narrowDiscovery)
    name = "inspect_analysis_view";
  const contract = contracts.find((tool) => tool.name === name);
  if (!contract) throw new Error("Unknown allowed tool");
  return {
    name: contract.name,
    description: contract.description,
    inputSchema: contract.inputSchema,
  };
};

const asyncInvoke = (vm, pending, deferreds) =>
  vm.newFunction("__call", (handle) => {
    // Start the host operation while its argument is alive. Guest promises
    // resolve between job drains, avoiding asyncify suspension in a job.
    const request = JSON.parse(vm.getString(handle));
    const deferred = vm.newPromise();
    deferreds.push(deferred);
    const work = (async () => {
      let value;
      try {
        value = {
          ok: true,
          value: await call(request.name, request.arguments),
        };
      } catch (error) {
        value = { ok: false, error: String(error) };
      }
      const serialized = vm.newString(JSON.stringify(value));
      try {
        deferred.resolve(serialized);
      } finally {
        serialized.dispose();
      }
    })().finally(() => pending.delete(work));
    pending.add(work);
    return deferred.handle;
  });

const settleCellPromise = async (vm, promise, pending, waited) => {
  try {
    while (true) {
      const state = vm.getPromiseState(promise);
      if (state.type !== "pending")
        return state.type === "fulfilled"
          ? { value: state.value }
          : { error: state.error };
      if (vm.runtime.hasPendingJob()) {
        const jobs = vm.runtime.executePendingJobs();
        if (jobs.error) return { error: jobs.error };
      } else if (pending.size) {
        const waiting = performance.now();
        await Promise.race(pending);
        waited(performance.now() - waiting);
      } else {
        return {
          error: vm.newError(
            "Cell awaits an unsettled promise with no pending host operation",
          ),
        };
      }
    }
  } finally {
    promise.dispose();
  }
};

const execute = async (source) => {
  if (typeof source !== "string" || Buffer.byteLength(source) > 65_536)
    throw new Error("A code cell must be at most 64 KiB");
  if (!wasm) {
    const require = createRequire(import.meta.url);
    const { newQuickJSAsyncWASMModule } = require(settings.quickjs);
    wasm = await newQuickJSAsyncWASMModule();
  }
  const vm = wasm.newContext();
  vm.runtime.setMemoryLimit(128 * 1024 * 1024);
  vm.runtime.setMaxStackSize(512 * 1024);
  const started = performance.now();
  let suspended = 0;
  let outputBytes = 0;
  const printed = [];
  const before = ordinal;
  const pending = new Set();
  const deferreds = [];
  vm.runtime.setInterruptHandler(
    () => performance.now() - started - suspended > 5_000,
  );
  const invokeSync = async (handle) => {
    const { name, arguments: args } = JSON.parse(vm.getString(handle));
    const pending = performance.now();
    let value;
    try {
      value = { ok: true, value: await call(name, args) };
    } catch (error) {
      value = { ok: false, error: String(error) };
    }
    suspended += performance.now() - pending;
    return vm.newString(JSON.stringify(value));
  };
  const invoke = asynchronous
    ? asyncInvoke(vm, pending, deferreds)
    : vm.newAsyncifiedFunction("__call", invokeSync);
  const docs = vm.newFunction("__describe", (handle) =>
    vm.newString(JSON.stringify(describe(vm.getString(handle)))),
  );
  const print = vm.newFunction("print", (...handles) => {
    for (const handle of handles) {
      const value = vm.dump(handle);
      outputBytes += Buffer.byteLength(JSON.stringify(value) ?? "null");
      if (outputBytes > 512 * 1024)
        throw new Error("Printed output exceeds the 512 KiB cell limit");
      printed.push(value ?? null);
    }
  });
  try {
    vm.setProp(vm.global, "__call", invoke);
    vm.setProp(vm.global, "__describe", docs);
    vm.setProp(vm.global, "print", print);
    const callSource = asynchronous
      ? "async call(name,args) { const response=JSON.parse(await __call(JSON.stringify({name,arguments:args}))); if(!response.ok) throw new Error(response.error); return response.value; },"
      : "call(name,args) { const response=JSON.parse(__call(JSON.stringify({name,arguments:args}))); if(!response.ok) throw new Error(response.error); return response.value; },";
    vm.unwrapResult(
      vm.evalCode(`
      const rea = {
        ${callSource}
        describe(name) { return JSON.parse(__describe(name)); }
      };
      ${asynchronous ? `rea.javascript = (${createJavaScriptClient.toString()})(rea.call);` : ""}
      ${
        resultCalls
          ? `{
        const rawCall = rea.call;
        rea.call = async (name,args) => {
          try {
            const value = await rawCall(name,args);
            return value.error ? {ok:false,error:{kind:'tool-error',details:value.error}} : {ok:true,value};
          } catch (error) { return {ok:false,error:{kind:'transport-error',details:String(error)}}; }
        };
      }`
          : ""
      }
    `),
    ).dispose();
    let result = await vm.evalCodeAsync(
      `(${asynchronous ? "async " : ""}() => {\n${source}\n})()`,
      "agent-cell.js",
    );
    if (asynchronous && !result.error)
      result = await settleCellPromise(
        vm,
        result.value,
        pending,
        (milliseconds) => {
          suspended += milliseconds;
        },
      );
    if (result.error) {
      const error = vm.dump(result.error);
      result.error.dispose();
      return {
        status: "code_error",
        error,
        printed,
        backend_calls: ordinal - before,
      };
    }
    result.value.dispose();
    return { status: "completed", printed, backend_calls: ordinal - before };
  } finally {
    // If a cell throws after starting reads, retain ownership until all complete.
    if (pending.size) await Promise.allSettled(pending);
    for (const deferred of deferreds) deferred.dispose();
    invoke.dispose();
    docs.dispose();
    print.dispose();
    vm.dispose();
  }
};

const lines = createInterface({ input: process.stdin });
try {
  for await (const line of lines) {
    let response;
    try {
      const request = JSON.parse(line);
      if (request.kind === "menu")
        response = contracts.map(({ name, description }) => ({
          name,
          description:
            name === "inspect_analysis_view" && narrowDiscovery
              ? narrowDiscovery.description
              : description.split(". ")[0],
        }));
      else if (request.kind === "docs") response = describe(request.tool);
      else if (request.kind === "call")
        response = await call(request.tool, request.arguments);
      else if (request.kind === "code") response = await execute(request.code);
      else if (request.kind === "close") break;
      else throw new Error("Unsupported experiment request");
      process.stdout.write(
        JSON.stringify({ ok: true, value: response }) + "\n",
      );
    } catch (error) {
      process.stdout.write(
        JSON.stringify({
          ok: false,
          error: { kind: "experiment_error", message: String(error) },
        }) + "\n",
      );
    }
  }
} finally {
  lines.close();
  process.stdin.pause();
  await closeClient();
}
