import { getQuickJS } from "quickjs-emscripten";
import { methods } from "./api.mjs";
import { MAX_BRIDGE_BYTES as MAX_BRIDGE } from "./limits.mjs";

const MAX_OUTPUT = 32768;
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
      message:
        "JavaScript error exceeds the 32 KiB output budget; its message is omitted. Native Evidence remains retained.",
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
    timeoutMs = 120000,
    cpuBudgetMs = 2000,
  } = {},
) => {
  if (Buffer.byteLength(code) > 32768)
    return failure("code_budget", "JavaScript source exceeds 32 KiB");
  const started = performance.now();
  const context = session.context;
  const lease = context?.lease;
  const stop = new AbortController();
  const combined = AbortSignal.any([signal, stop.signal]);
  const deadline = Date.now() + timeoutMs;
  const timer = setTimeout(() => stop.abort(), timeoutMs);
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(64 * 1024 * 1024);
  runtime.setMaxStackSize(512 * 1024);
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
          message:
            "Return a smaller projection (32 KiB UTF-8 output budget); native Evidence remains retained",
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

const retainEvidence = (response, evidence) => {
  const observation =
    response.data ?? response.error?.details?.partial_observation;
  for (const row of [observation, ...(observation?.results ?? [])]) {
    const id =
      row?.source?.evidence_id ??
      row?.evidence_id ??
      row?.error?.details?.evidence_id;
    if (id) evidence.add(id);
  }
  if (response.error?.details?.evidence_id)
    evidence.add(response.error.details.evidence_id);
};

const installBridge = (
  vm,
  session,
  { combined, lease, calls, pending, pump, state },
) => {
  const bridge = vm.newFunction("analysis", (methodHandle, inputHandle) => {
    const name = vm.getString(methodHandle);
    const inputText = vm.getString(inputHandle);
    if (calls.length >= 64 || Buffer.byteLength(inputText) > MAX_BRIDGE)
      throw new Error("Host call or argument budget exceeded");
    const promise = vm.newPromise();
    const index = calls.length;
    calls.push({
      method: name,
      input: JSON.parse(inputText),
      status: "pending",
    });
    const work = Promise.resolve()
      .then(async () => {
        const before = performance.now();
        const response = await session.call(
          name,
          JSON.parse(inputText),
          combined,
          lease,
        );
        retainEvidence(response, state.evidence);
        calls[index].status = response.ok ? "ok" : "error";
        if (!response.ok) calls[index].error = response.error;
        calls[index].elapsed_ms = performance.now() - before;
        let serialized = JSON.stringify(response);
        if (Buffer.byteLength(serialized) > MAX_BRIDGE)
          serialized = JSON.stringify({
            ok: false,
            error: {
              code: "bridge_budget",
              message:
                "Select fewer fields or a smaller page; full source remains available via evidence",
            },
          });
        if (!state.disposed) {
          const value = vm.newString(serialized);
          promise.resolve(value);
          value.dispose();
          pump();
        }
      })
      .catch((error) => {
        if (!state.disposed) {
          const value = vm.newString(
            JSON.stringify({
              ok: false,
              error: { code: "bridge_failed", message: error.message },
            }),
          );
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
