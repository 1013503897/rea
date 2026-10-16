import test from "node:test";
import assert from "node:assert/strict";
import Ajv2020 from "ajv/dist/2020.js";
import { methods, reference } from "./api.mjs";

test("named reference lists preserve caller order and exact schemas across presentations", () => {
  const names = Object.fromEntries(
    Object.keys(methods).map((name) => [name, `facts_${name}`]),
  );
  const result = reference(
    "facts_values, facts_snapshot facts_values unknown",
    { names, includeExamples: false },
  );
  assert.deepEqual(
    result.methods.map((m) => m.method),
    ["values", "snapshot"],
  );
  assert.deepEqual(
    result.methods.map((m) => m.name),
    ["facts_values", "facts_snapshot"],
  );
  assert.deepEqual(result.unmatched_queries, ["unknown"]);
  assert.equal(result.coverage.declared_methods, 14);
  assert.equal(result.coverage.matched_methods, 2);
  assert.equal(result.coverage.selection, "named");
  const javascript = reference("rea.values snapshot");
  assert.deepEqual(
    javascript.methods.map((m) => m.method),
    ["values", "snapshot"],
  );
  assert.deepEqual(
    result.methods.map((m) => m.input_schema),
    javascript.methods.map((m) => m.input_schema),
  );
  const validate = new Ajv2020({ strict: false }).compile(
    result.methods[1].input_schema,
  );
  assert.equal(validate({ entry: "0xea6d0" }), true);
  assert.equal(validate({ snapshot: "wrong contract" }), false);
  const validateValues = new Ajv2020({ strict: false }).compile(
    result.methods[0].input_schema,
  );
  assert.equal(validateValues({ snapshot: "snap_example", ids: ["v1"] }), true);
  assert.equal(
    methods.values.input.parse({ snapshot: "snap_example" }).limit,
    20,
  );
  assert.equal(Object.hasOwn(result.methods[0], "example"), false);
});

test("topic/all reference selection and shared schema ownership remain explicit", () => {
  assert.equal(reference().methods.length, 14);
  assert.equal(reference("no-such-topic").coverage.matched_methods, 0);
  assert.ok(
    reference("memory aliases").methods.some((m) => m.method === "slice"),
  );
  const before = reference("snapshot").methods[0];
  assert.throws(() => {
    before.input_schema.properties.entry.type = "number";
  }, TypeError);
  const after = reference("snapshot").methods[0];
  assert.equal(after.input_schema.properties.entry.type, "string");
  assert.throws(
    () => reference("values", { names: { snapshot: "values" } }),
    /Ambiguous/,
  );
  assert.throws(
    () => reference("values", { names: { unknown: "facts_values" } }),
    /Unknown/,
  );
});
