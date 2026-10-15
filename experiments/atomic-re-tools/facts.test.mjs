import assert from "node:assert/strict";
import test from "node:test";
import { FactQueries, contextFor } from "./facts.mjs";

const profile = {
  digest: "p1",
  provider: { id: "test", name: "Test", version: "1" },
};
const context = contextFor("artifact-a", profile, "lease-1");
const evidence = (normalized_result) => ({
  evidence_id: "ev:test",
  confidence: "derived",
  limitations: ["fixture coverage only"],
  normalized_result,
});
const port = (observe, extra = {}) => ({
  context: () => context,
  supports: () => true,
  observe,
  ...extra,
});
const string = {
  kind: "string",
  address: "0x20000000000001",
  encoding: "utf8",
};

test("artifact, profile and lease boundaries reject joins before invoking analysis", async () => {
  let calls = 0;
  const facts = new FactQueries(
    port(async () => {
      calls++;
      throw new Error("must not run");
    }),
  );
  for (const foreign of [
    contextFor("artifact-b", profile, "lease-1"),
    contextFor("artifact-a", { ...profile, digest: "p2" }, "lease-1"),
    contextFor("artifact-a", profile, "lease-2"),
  ]) {
    assert.equal(
      (await facts.incomingReferences({ context: foreign, targets: [string] }))
        .status,
      "error",
    );
    assert.equal(
      (await facts.resolveFunctions({ context: foreign, locations: [] }))
        .status,
      "error",
    );
  }
  assert.equal(calls, 0);
  assert.equal(contextFor("artifact-a", profile, "lease-2").ref, context.ref);
});

test("partial batches retain good observations and exact failure reasons", async () => {
  const cancelled = {
    code: "cancelled",
    message: "caller cancelled",
    details: { stage: "native" },
  };
  const facts = new FactQueries(
    port(async (_, parameters) =>
      parameters.address === "0xbad"
        ? { ok: false, error: cancelled }
        : { ok: true, value: evidence(["0x20000000000002"]) },
    ),
  );
  const result = await facts.incomingReferences({
    context,
    targets: [string, { ...string, address: "0xbad" }],
  });
  assert.equal(result.status, "partial");
  assert.equal(result.results[0].items[0].from.address, "0x20000000000002");
  assert.equal(result.results[0].items[0].kind, "unknown");
  assert.deepEqual(result.results[1].error, cancelled);
  assert.equal(result.results[0].coverage.status, "unknown");
});

test("duplicate selectors share work but preserve separate string identities", async () => {
  let calls = 0;
  const facts = new FactQueries(
    port(async () => {
      calls++;
      return { ok: true, value: evidence(["0x20"]) };
    }),
  );
  const otherEncoding = { ...string, encoding: "utf16le" };
  const result = await facts.incomingReferences({
    context,
    targets: [string, otherEncoding, string],
  });
  assert.equal(calls, 1);
  assert.deepEqual(
    result.results.map((row) => row.items[0].to),
    [string, otherEncoding, string],
  );
});

test("paging and field selection retain identities, source and unknown coverage", async () => {
  const rows = [
    {
      address: string.address,
      value: "😀 marker",
      string: {
        encoding: "utf8",
        encoding_status: "observed",
        byte_length: 12,
      },
    },
    { address: "0x20000000000002", value: "other" },
  ];
  const facts = new FactQueries(
    port(async () => ({ ok: true, value: evidence(rows) })),
  );
  const page = await facts.findStrings({
    query: { pattern: "" },
    limit: 1,
    fields: ["string"],
  });
  assert.deepEqual(page.items, [{ id: string, string: rows[0].string }]);
  assert.equal(page.selection.next_offset, 1);
  assert.equal(page.evidence_id, "ev:test");
  assert.equal(page.coverage.status, "unknown");
  const beyond = await facts.findStrings({
    query: { pattern: "" },
    offset: 99,
    limit: 1,
  });
  assert.equal(beyond.selection.matched, 2);
  assert.equal(beyond.selection.returned, 0);
  assert.equal(beyond.coverage.status, "unknown");
});

test("unsupported function resolution remains unknown without futile native calls", async () => {
  const facts = new FactQueries(
    port(
      async () => {
        throw new Error("unsupported capability must not run");
      },
      { supports: () => false },
    ),
  );
  const result = await facts.resolveFunctions({
    context,
    locations: [{ kind: "location", address: "0x12" }],
  });
  assert.equal(result.status, "partial");
  assert.equal(result.results[0].status, "unknown");
  assert.equal(result.results[0].error.code, "unsupported");
  assert.equal(
    (await facts.resolveFunctions({ context, locations: [] })).status,
    "ok",
  );
});
