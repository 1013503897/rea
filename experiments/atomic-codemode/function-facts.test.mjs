import test from "node:test";
import assert from "node:assert/strict";
import { parseFunctionFacts, selectFunctionFacts } from "./function-facts.mjs";
import { readFactBatch } from "./fact-reads.mjs";
import { FactFailure } from "./fact-error.mjs";

test("function names retain multiple entries and aliases instead of choosing a PLT or implementation", () => {
  const facts = parseFunctionFacts(
    JSON.stringify({
      functions: [
        {
          name: "format_error",
          address_hex: "0x1000",
          aliases: ["format_error@plt"],
          size: 16,
        },
        {
          name: "format_error",
          address_hex: "0x2000",
          aliases: ["FormatError"],
          size: 0,
        },
      ],
    }),
  );
  const query = {
    query: "format_error",
    exact: true,
    case_sensitive: true,
    offset: 0,
    limit: 20,
  };
  assert.deepEqual(
    selectFunctionFacts(facts, query).items.map((item) => item.address),
    ["0x1000", "0x2000"],
  );
  assert.equal(
    selectFunctionFacts(facts, { ...query, query: "format_error@plt" }).items[0]
      .address,
    "0x1000",
  );
  assert.equal(
    selectFunctionFacts(facts, {
      ...query,
      query: "FORMAT_ERROR",
      case_sensitive: false,
    }).total,
    2,
  );
  assert.deepEqual(
    selectFunctionFacts(facts, {
      ...query,
      addresses: ["0x2000"],
      fields: ["size"],
    }).items,
    [{ address: "0x2000", size: 0 }],
  );
  assert.throws(() => {
    facts[0].aliases.push("foreign");
  });
});

test("batch transport and decoder failures preserve successful items and captured source identity", async () => {
  const attempts = [];
  const result = await readFactBatch(
    [{ address: "0x1" }, { address: "0x2" }, { address: "0x3" }],
    async (request) => {
      attempts.push(request.address);
      if (request.address === "0x2")
        throw new FactFailure("capacity", "transport bound");
      return {
        source: {
          evidence_id: `ev_${request.address}`,
          sha256: "digest",
          bytes: 3,
          elapsed_ms: 1,
        },
      };
    },
    async (_, request) => {
      if (request.address === "0x3")
        throw new FactFailure(
          "invalid_provider_output",
          "decoder rejected source",
        );
      return { items: [{ value: 1 }] };
    },
  );
  assert.deepEqual(attempts, ["0x1", "0x2", "0x3"]);
  assert.equal(result.results[0].items[0].value, 1);
  assert.equal(result.results[1].error.code, "capacity");
  assert.equal(result.results[2].error.details.evidence_id, "ev_0x3");
});
