import test from "node:test";
import assert from "node:assert/strict";
import { executeJavaScript } from "./executor.mjs";

const fake = {
  context: { lease: "test" },
  call: async (name, input) => ({ ok: true, data: { name, input } }),
};
test("real QuickJS composes async API calls and does not expose host globals", async () => {
  const result = await executeJavaScript(
    fake,
    'const a=await rea.strings({query:"x"}); const b=await rea.operations({ids:[a.data.name]}); return {a,b,host:[typeof process,typeof require,typeof fetch]};',
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.value.host, ["undefined", "undefined", "undefined"]);
  assert.equal(result.calls.length, 2);
  assert.equal(result.value.b.data.input.ids[0], "strings");
});
test("infinite guest execution and never-resolving promises terminate", async () => {
  const loop = await executeJavaScript(fake, "while(true){}", {
    timeoutMs: 30,
  });
  assert.equal(loop.ok, false);
  const stalled = await executeJavaScript(
    fake,
    "await new Promise(()=>{});return 1",
    { timeoutMs: 30 },
  );
  assert.equal(stalled.ok, false);
});
test("output budgets and failures survive without silently clipping evidence", async () => {
  const result = await executeJavaScript(fake, 'return "x".repeat(40000)');
  assert.equal(result.error.code, "output_budget");
  const failure = await executeJavaScript(
    fake,
    'throw new Error("explicit failure")',
  );
  assert.equal(failure.ok, false);
});

test("guest CPU budget is independent from the native-analysis wall deadline", async () => {
  const before = performance.now();
  const result = await executeJavaScript(fake, "while(true){}", {
    timeoutMs: 5000,
    cpuBudgetMs: 25,
  });
  assert.equal(result.error.code, "cpu_budget");
  assert.ok(performance.now() - before < 2000);
});

test("cancelled reads keep partial-observation Evidence in the execution receipt", async () => {
  const result = await executeJavaScript(
    {
      context: { lease: "partial" },
      call: async () => ({
        ok: false,
        error: {
          code: "cancelled",
          details: {
            partial_observation: { source: { evidence_id: "ev_partial" } },
          },
        },
      }),
    },
    "return await rea.strings({query:'x'})",
  );
  assert.deepEqual(result.evidence_ids, ["ev_partial"]);
  assert.equal(result.value.error.code, "cancelled");
});

test("failed compositions keep completed facts and their provenance after draining", async () => {
  const owner = {
    context: { lease: "retained" },
    call: async () => ({ ok: true, data: { evidence_id: "ev_retained" } }),
  };
  for (const ending of [
    'throw new Error("after analysis")',
    'return "x".repeat(40000)',
  ]) {
    const result = await executeJavaScript(
      owner,
      `await rea.strings({}); ${ending}`,
    );
    assert.equal(result.ok, false);
    assert.deepEqual(result.evidence_ids, ["ev_retained"]);
    assert.deepEqual(result.context, owner.context);
    assert.equal(result.calls[0].status, "ok");
  }
});

test("guest exceptions obey output capacity, including JSON expansion, and preserve observations", async () => {
  for (const code of [
    'throw new Error("x".repeat(40000))',
    'throw new Error("\\0".repeat(6000))',
  ]) {
    const result = await executeJavaScript(
      {
        context: { lease: "error-output" },
        call: async () => ({
          ok: true,
          data: { evidence_id: "ev_before_error" },
        }),
      },
      `await rea.strings({}); ${code}`,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "output_budget");
    assert.equal(result.error.details.original_error_code, "javascript_error");
    assert.equal(result.error.details.original_message_omitted, true);
    assert.ok(Buffer.byteLength(JSON.stringify(result.error)) <= 32768);
    assert.deepEqual(result.evidence_ids, ["ev_before_error"]);
    assert.equal(result.context.lease, "error-output");
  }
  const ordinary = await executeJavaScript(
    fake,
    'throw new Error("x".repeat(10000))',
  );
  assert.equal(ordinary.error.code, "javascript_error");
  assert.ok(ordinary.error.message.includes("x".repeat(10000)));
});
