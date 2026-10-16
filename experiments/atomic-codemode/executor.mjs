import { getQuickJS } from "quickjs-emscripten";
import { methods } from "./api.mjs";

const MAX_OUTPUT = 32768;
const MAX_BRIDGE = 2 * 1024 * 1024;
export const executeJavaScript = async (
  session,
  code,
  { signal = new AbortController().signal, timeoutMs = 120000 } = {},
) => {
  if (Buffer.byteLength(code) > 32768)
    return {
      ok: false,
      error: {
        code: "code_budget",
        message: "JavaScript source exceeds 32 KiB",
      },
    };
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
  runtime.setInterruptHandler(() => combined.aborted || Date.now() >= deadline);
  const vm = runtime.newContext();
  const pending = new Set();
  const calls = [];
  const state = { disposed: false, evidence: new Set() };
  let promiseHandle;
  const pump = () => {
    if (!state.disposed) {
      const result = runtime.executePendingJobs();
      if (result.error) result.error.dispose();
    }
  };
  installBridge(vm, session, { combined, lease, calls, pending, pump, state });
  try {
    const bootstrap = `globalThis.rea=Object.freeze(Object.fromEntries(${JSON.stringify(Object.keys(methods))}.map(name=>[name,async(input={})=>JSON.parse(await __analysis(name,JSON.stringify(input)))])));`;
    vm.unwrapResult(vm.evalCode(bootstrap)).dispose();
    promiseHandle = vm.unwrapResult(
      vm.evalCode(
        `(async()=>JSON.stringify(await(async()=>{\n${code}\n})()))()`,
      ),
    );
    const resolved = vm.resolvePromise(promiseHandle);
    pump();
    // A never-settling guest Promise must not hang the MCP request forever.
    const aborted = new Promise((_, reject) =>
      combined.addEventListener(
        "abort",
        () => reject(new Error("Execution cancelled or timed out")),
        { once: true },
      ),
    );
    const result = await Promise.race([resolved, aborted]);
    const value = vm.unwrapResult(result);
    const text = vm.getString(value);
    value.dispose();
    if (Buffer.byteLength(text) > MAX_OUTPUT)
      return {
        ok: false,
        error: {
          code: "output_budget",
          message:
            "Return a smaller projection (32 KiB UTF-8 output budget); native Evidence remains retained",
        },
        calls,
      };
    return {
      ok: true,
      context,
      evidence_ids: [...state.evidence],
      value: text === "undefined" ? null : JSON.parse(text),
      calls,
      elapsed_ms: performance.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: combined.aborted ? "cancelled" : "javascript_error",
        message: error.message ?? String(error),
      },
      calls,
      elapsed_ms: performance.now() - started,
    };
  } finally {
    clearTimeout(timer);
    stop.abort();
    await Promise.allSettled(pending);
    state.disposed = true;
    promiseHandle?.dispose();
    vm.dispose();
    runtime.dispose();
  }
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
        for (const row of [response.data, ...(response.data?.results ?? [])]) {
          const id = row?.source?.evidence_id ?? row?.evidence_id;
          if (id) state.evidence.add(id);
        }
        calls[index].status = response.ok ? "ok" : "error";
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
