import { getQuickJS } from "quickjs-emscripten";
import { methods } from "./api.mjs";
import { MAX_BRIDGE_BYTES as MAX_BRIDGE, EXECUTION_LIMITS } from "./limits.mjs";
import { serializeJson } from "./json-capacity.mjs";
import { evidenceIds, serializationFailure } from "./fact-provenance.mjs";
import { projectFactFailure } from "./fact-error.mjs";

const MAX_OUTPUT = EXECUTION_LIMITS.output_utf8_bytes;
const failure = (code, message) => ({ ok: false, error: { code, message } });
const projectGuestError = (code, error) => {
  const message =
    typeof error?.message === "string" ? error.message : String(error);
  // Check raw size first: JSON escaping expands each code unit at most sixfold,
  // so the second check has a 6×32 KiB string bound plus a fixed envelope.
  if (
    Buffer.byteLength(message) > MAX_OUTPUT ||
    Buffer.byteLength(JSON.stringify({ code, message })) > MAX_OUTPUT
  )
    return {
      code: "output_budget",
      message: `JavaScript error exceeds the ${MAX_OUTPUT / 1024} KiB output budget; its message is omitted. Native Evidence remains retained.`,
      details: {
        original_error_code: code,
        original_message_code_units: message.length,
        original_message_omitted: true,
      },
    };
  return { code, message };
};
export const executeJavaScript = async (
  session,
  code,
  {
    signal = new AbortController().signal,
    timeoutMs = EXECUTION_LIMITS.timeout_ms.default,
    cpuBudgetMs = EXECUTION_LIMITS.execution_cpu_ms,
  } = {},
) => {
  if (Buffer.byteLength(code) > EXECUTION_LIMITS.code_utf8_bytes)
    return failure(
      "code_budget",
      `JavaScript source exceeds ${EXECUTION_LIMITS.code_utf8_bytes / 1024} KiB`,
    );
  const started = performance.now();
  const context = session.context;
  const lease = context?.lease;
  const stop = new AbortController();
  const combined = AbortSignal.any([signal, stop.signal]);
  const deadline = Date.now() + timeoutMs;
  const timer = setTimeout(() => stop.abort(), timeoutMs);
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(EXECUTION_LIMITS.execution_heap_mib * 1024 * 1024);
  runtime.setMaxStackSize(EXECUTION_LIMITS.execution_stack_bytes);
  const budget = { used: 0, deadline: 0, exhausted: false };
  const runGuest = (work) => {
    budget.deadline = Date.now() + Math.max(1, cpuBudgetMs - budget.used);
    const before = performance.now();
    try {
      return work();
    } finally {
      budget.used += performance.now() - before;
    }
  };
  runtime.setInterruptHandler(() => {
    budget.exhausted ||= Date.now() >= budget.deadline;
    return budget.exhausted || combined.aborted || Date.now() >= deadline;
  });
  const vm = runtime.newContext();
  const pending = new Set();
  const calls = [];
  const state = { disposed: false, evidence: new Set() };
  const pump = () => {
    if (!state.disposed) {
      const result = runGuest(() => runtime.executePendingJobs());
      if (result.error) {
        result.error.dispose();
        stop.abort();
      }
    }
  };
  installBridge(vm, session, { combined, lease, calls, pending, pump, state });
  let outcome;
  try {
    const text = await evaluateGuest(vm, code, { runGuest, pump, combined });
    if (Buffer.byteLength(text) > MAX_OUTPUT)
      outcome = {
        ok: false,
        error: {
          code: "output_budget",
          message: `Return a smaller projection (${MAX_OUTPUT / 1024} KiB UTF-8 output budget); native Evidence remains retained`,
        },
      };
    else
      outcome = {
        ok: true,
        value: text === "undefined" ? null : JSON.parse(text),
      };
  } catch (error) {
    outcome = {
      ok: false,
      error: projectGuestError(
        budget.exhausted
          ? "cpu_budget"
          : combined.aborted
            ? "cancelled"
            : "javascript_error",
        budget.exhausted
          ? "Guest synchronous execution budget exceeded"
          : error,
      ),
    };
  } finally {
    clearTimeout(timer);
    stop.abort();
    await Promise.allSettled(pending);
    state.disposed = true;
    vm.dispose();
    runtime.dispose();
  }
  return {
    ...outcome,
    context,
    evidence_ids: [...state.evidence],
    calls,
    elapsed_ms: performance.now() - started,
  };
};

const prepareBridgeResponse = (response) => {
  const encoded = serializeJson(response, MAX_BRIDGE);
  if (encoded.ok) return { response, text: encoded.text };
  const delivered = serializationFailure(
      response,
      encoded.error,
      "quickjs_bridge",
      "bridge_budget",
    ),
    bounded = serializeJson(delivered, MAX_BRIDGE);
  if (!bounded.ok)
    throw new Error("Bridge capacity diagnostic could not be encoded");
  return { response: delivered, text: bounded.text };
};

const installBridge = (
  vm,
  session,
  { combined, lease, calls, pending, pump, state },
) => {
  const bridge = vm.newFunction("analysis", (methodHandle, inputHandle) => {
    const name = vm.getString(methodHandle);
    const inputText = vm.getString(inputHandle);
    if (
      calls.length >= EXECUTION_LIMITS.max_host_calls ||
      Buffer.byteLength(inputText) > MAX_BRIDGE
    )
      throw new Error("Host call or argument budget exceeded");
    const promise = vm.newPromise();
    const index = calls.length;
    const started = performance.now();
    calls.push({
      method: name,
      input: JSON.parse(inputText),
      status: "pending",
    });
    const work = Promise.resolve()
      .then(async () => {
        const response = await session.call(
          name,
          JSON.parse(inputText),
          combined,
          lease,
        );
        for (const id of evidenceIds(response)) state.evidence.add(id);
        const { response: delivered, text } = prepareBridgeResponse(response);
        calls[index].status = delivered.ok ? "ok" : "error";
        if (!delivered.ok) calls[index].error = delivered.error;
        calls[index].elapsed_ms = performance.now() - started;
        if (!state.disposed) {
          const value = vm.newString(text);
          promise.resolve(value);
          value.dispose();
          pump();
        }
      })
      .catch((error) => {
        const { response, text } = prepareBridgeResponse({
          ok: false,
          context: session.context,
          error: projectFactFailure(error, "bridge_failed"),
        });
        for (const id of evidenceIds(response)) state.evidence.add(id);
        calls[index].status = "error";
        calls[index].error = response.error;
        calls[index].elapsed_ms = performance.now() - started;
        if (!state.disposed) {
          const value = vm.newString(text);
          promise.resolve(value);
          value.dispose();
          pump();
        }
      })
      .finally(() => pending.delete(work));
    pending.add(work);
    return promise.handle;
  });
  vm.setProp(vm.global, "__analysis", bridge);
  bridge.dispose();
};

const evaluateGuest = async (vm, code, { runGuest, pump, combined }) => {
  const bootstrap = `globalThis.rea=Object.freeze(Object.fromEntries(${JSON.stringify(Object.keys(methods))}.map(name=>[name,async(input={})=>JSON.parse(await __analysis(name,JSON.stringify(input)))])));`;
  vm.unwrapResult(runGuest(() => vm.evalCode(bootstrap))).dispose();
  const promiseHandle = vm.unwrapResult(
    runGuest(() =>
      vm.evalCode(
        `(async()=>JSON.stringify(await(async()=>{\n${code}\n})()))()`,
      ),
    ),
  );
  try {
    const resolved = vm.resolvePromise(promiseHandle);
    pump();
    // A never-settling guest Promise must not hang the MCP request forever.
    const aborted = new Promise((_, reject) => {
      if (combined.aborted) {
        reject(new Error("Execution cancelled"));
        return;
      }
      combined.addEventListener(
        "abort",
        () => reject(new Error("Execution cancelled or timed out")),
        { once: true },
      );
    });
    const result = await Promise.race([resolved, aborted]);
    const value = vm.unwrapResult(result);
    const text = vm.getString(value);
    value.dispose();
    return text;
  } finally {
    promiseHandle.dispose();
  }
};
