import assert from "node:assert/strict";
import test from "node:test";
import { parseNativeIR } from "./native-ir.mjs";
import { readNativeGraphEvidence } from "./native-ir-contract.mjs";

// Minimal valid graph: this regression concerns facet admission, not SSA rules.
const document = () => ({
  binary: "/fixture",
  count: 1,
  language: "c",
  error: null,
  functions: [
    {
      address_hex: "0x1000",
      error: null,
      code: "reconstructed C",
      atomic_facts: {
        schema_version: 3,
        blocks: [
          {
            id: 0,
            start: "0x1000",
            operations: [],
            predecessors: [],
            successors: [],
          },
        ],
        operations: [],
        values: [],
        coverage: {
          scope: "retained native graph",
          machine_semantic_equivalence: "unknown",
          indirect_branch_operations: [],
          omitted_definition_ids: [],
          issues: [],
        },
      },
    },
  ],
});

test("malformed facet failure values stay local and preserve healthy graph/code/source views", () => {
  for (const name of [
    "atomic_facts",
    "atomic_calls",
    "atomic_parameters",
    "atomic_switches",
    "atomic_projection",
  ])
    for (const reason of [null, 7, false, {}, []]) {
      const doc = document();
      if (name === "atomic_facts") delete doc.functions[0].atomic_facts;
      doc.functions[0][`${name}_error`] = reason;
      const text = JSON.stringify(doc),
        model = parseNativeIR(text, "0x1000");
      assert.equal(model.code, "reconstructed C");
      if (name !== "atomic_facts") {
        assert.equal(model.facets.recovered_ir.availability, "available");
        assert.equal(model.blocks({}).total, 1);
        assert.ok(readNativeGraphEvidence(text).text.length);
      } else {
        assert.equal(
          model.facets.recovered_ir.error.code,
          "invalid_provider_output",
        );
        assert.throws(
          () => readNativeGraphEvidence(text),
          (e) => e.code === "invalid_provider_output",
        );
      }
      if (name === "atomic_parameters")
        assert.equal(
          model.facets.parameters.error.code,
          "invalid_provider_output",
        );
    }
});
