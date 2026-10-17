import assert from "node:assert/strict";
import { test } from "node:test";
import { executeJavaScript } from "./executor.mjs";
import { methods } from "./api.mjs";
import { freezeFacts } from "./fact-reads.mjs";
import { selectStringFacts } from "./string-facts.mjs";
import { encodeMcpResult } from "./mcp-result-encoding.mjs";
import { evidenceIds, serializationFailure } from "./fact-provenance.mjs";
import { MAX_BRIDGE_BYTES, MAX_MCP_RESULT_BYTES } from "./limits.mjs";
import { AtomicSession } from "./session.mjs";

test("string selection preserves encoded identity without the display payload", () => {
  const inventory = freezeFacts({
    scanned: "sections",
    items: [
      {
        address: "0x1000",
        value: "REA " + "x".repeat(65536),
        string: {
          encoding: "ascii",
          byte_length: 65541,
          nul_terminated: true,
          termination: "present_or_not_required",
        },
      },
    ],
  });
  const input = methods.strings.input.parse({ query: "REA", fields: [] });
  const selected = selectStringFacts(inventory, input);
  assert.equal(selected.total, 1);
  assert.deepEqual(Object.keys(selected.items[0]), ["address", "string"]);
  assert.equal(selected.items[0].string.nul_terminated, true);
  selected.items.length = 0;
  assert.equal(selectStringFacts(inventory, input).items.length, 1);
  assert.equal(
    selectStringFacts(inventory, { ...input, fields: ["value"] }).items[0]
      .value,
    inventory.items[0].value,
  );
});

test("MCP capacity includes outer escaping and keeps an actionable Evidence link", () => {
  const response = {
    ok: true,
    context: { lease: "fixture" },
    data: {
      source: { evidence_id: "ev_fixture" },
      value: '"'.repeat(300000),
    },
  };
  assert(Buffer.byteLength(JSON.stringify(response)) < MAX_MCP_RESULT_BYTES);
  const encoded = encodeMcpResult(response);
  assert.equal(encoded.result.ok, false);
  assert.equal(encoded.result.error.code, "result_budget");
  assert.equal(encoded.result.error.details.scope, "mcp_reply");
  assert.deepEqual(encoded.result.error.details.evidence_ids, ["ev_fixture"]);
  assert.deepEqual(encoded.result.context, response.context);
  assert(
    Buffer.byteLength(JSON.stringify(encoded.reply)) <= MAX_MCP_RESULT_BYTES,
  );
});

test("bridge capacity can be recovered inside the same composition with truthful call status", async () => {
  const context = { lease: "fixture" },
    source = { evidence_id: "ev_fixture" };
  const session = {
    context,
    call: async (name) =>
      name === "strings"
        ? {
            ok: true,
            context,
            data: { source, value: "x".repeat(MAX_BRIDGE_BYTES + 1) },
          }
        : { ok: true, context, data: { source, text: "retained prefix" } },
  };
  const reply = await executeJavaScript(
    session,
    `
    const result=await rea.strings({query:"fixture"});
    if(result.ok)return {unexpected:true};
    const id=result.error.details.evidence_ids[0];
    const source=await rea.evidence({evidence_id:id,limit:32});
    return {code:result.error.code,context:result.context,id,prefix:source.data.text};
  `,
  );
  assert.equal(reply.ok, true);
  assert.deepEqual(reply.value, {
    code: "bridge_budget",
    context,
    id: "ev_fixture",
    prefix: "retained prefix",
  });
  assert.deepEqual(reply.evidence_ids, ["ev_fixture"]);
  assert.deepEqual(
    reply.calls.map((c) => c.status),
    ["error", "ok"],
  );
});

test("transport diagnostics preserve the primary failure and only declared provenance", () => {
  const response = {
    ok: false,
    context: { lease: "fixture" },
    error: {
      code: "cleanup_incomplete",
      message: "long diagnostic",
      details: {
        evidence_id: "ev_one",
        partial_observation: {
          results: [{ source: { evidence_id: "ev_two" } }],
        },
      },
    },
  };
  const failure = serializationFailure(
    response,
    { kind: "capacity", limit_bytes: 1, minimum_encoded_bytes: 2 },
    "fixture",
    "result_budget",
  );
  assert.equal(failure.error.code, "cleanup_incomplete");
  assert.equal(failure.error.details.original_details_omitted, true);
  assert.deepEqual(evidenceIds(failure), ["ev_two", "ev_one"]);
  assert.deepEqual(evidenceIds({ data: { value: "ev_unrelated" } }), []);
});

test("unsupported native result values stay distinct from capacity failures", () => {
  const encoded = encodeMcpResult({
    ok: true,
    context: { lease: "fixture" },
    data: { source: { evidence_id: "ev_fixture" }, unsupported: new Map() },
  });
  assert.equal(encoded.result.error.code, "invalid_result");
  assert.equal(encoded.result.error.details.kind, "invalid_json");
  assert.deepEqual(encoded.result.error.details.evidence_ids, ["ev_fixture"]);
});

test("unexpected host failures settle their call record and preserve primary provenance", async () => {
  const session = {
    context: { lease: "fixture" },
    call: async () => {
      throw Object.assign(new Error("backend failure"), {
        code: "fixture_failure",
        details: { evidence_id: "ev_fixture" },
      });
    },
  };
  const result = await executeJavaScript(
    session,
    'return await rea.strings({query:"fixture"});',
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.error.code, "fixture_failure");
  assert.equal(result.calls[0].status, "error");
  assert.equal(result.calls[0].error.code, "fixture_failure");
  assert.deepEqual(result.evidence_ids, ["ev_fixture"]);
});

test("primitive failures produce terminal SDK and bridge outcomes", async () => {
  const context = { lease: "fixture" };
  const owner = {
    context,
    strings: async () => {
      throw null;
    },
    close: async () => {},
  };
  const session = new AtomicSession(async () => owner);
  try {
    await session.open("fixture");
    const result = await session.call("strings", { query: "fixture" });
    assert.equal(result.error.code, "analysis_failed");
    assert.equal(result.error.message, "null");
  } finally {
    await session.close();
  }
  const bridge = await executeJavaScript(
    {
      context,
      call: async () => {
        throw null;
      },
    },
    'return await rea.strings({query:"fixture"});',
  );
  assert.equal(bridge.value.error.code, "bridge_failed");
  assert.equal(bridge.value.error.message, "null");
  assert.equal(bridge.calls[0].status, "error");
});
