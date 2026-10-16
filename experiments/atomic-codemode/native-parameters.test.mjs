import assert from "node:assert/strict";
import test from "node:test";
import {
  readParameterFacet,
  createParameterViews,
} from "./native-parameters.mjs";
import { parseNativeIR } from "./native-ir.mjs";
import { methods, reference } from "./api.mjs";
import Ajv2020 from "ajv/dist/2020.js";

const parameter = (
  index,
  storage = { space: "register", offset: "0x38", size_bytes: 8 },
) => ({
  id: index === null ? "return" : `parameter:${index}`,
  native_index: index,
  name: "display",
  type_name: "unknown8",
  size_bytes: 8,
  is_void: false,
  storage,
  type_locked: false,
  name_locked: false,
  size_locked: false,
  this_pointer: false,
  indirect_storage: false,
  hidden_return: false,
});
const fixture = () => ({
  schema_version: 1,
  model: "__stdcall",
  model_unknown: false,
  inputs_locked: false,
  output_locked: false,
  variadic: false,
  input_errors: false,
  output_errors: true,
  items: [
    parameter(0),
    parameter(1, { space: "stack", offset: "0x8", size_bytes: 8 }),
  ],
  output: parameter(null, { space: "register", offset: "0x0", size_bytes: 8 }),
});
const read = (raw) => readParameterFacet({ atomic_parameters: raw });
const model = (fn) =>
  parseNativeIR(
    JSON.stringify({
      binary: "/input",
      count: 1,
      language: "c",
      error: null,
      functions: [
        { address_hex: "0x1000", error: null, code: "readable", ...fn },
      ],
    }),
    "0x1000",
  );

test("formal selection preserves native indices, caller order, unknowns and independently selected output", () => {
  const parsed = read(fixture());
  assert.equal(parsed.ok, true);
  const view = createParameterViews(parsed.value);
  const first = view.parameters({
    indices: [1, 0, 1, 8],
    fields: ["storage", "size_bytes"],
    limit: 1,
  });
  assert.deepEqual(
    first.items.map((r) => r.id),
    ["parameter:1"],
  );
  assert.equal(first.total, 2);
  assert.equal(first.next_offset, 1);
  assert.deepEqual(first.missing_indices, [8]);
  assert.equal(first.output.id, "return");
  assert.equal(first.prototype.output_errors, true);
  assert.equal(first.coverage.source_signature, "unknown");
  const next = view.parameters({ indices: [1, 0], fields: [], offset: 1 });
  assert.deepEqual(next.items, [{ id: "parameter:0", native_index: 0 }]);
  assert.deepEqual(next.output, { id: "return", native_index: null });
  assert.deepEqual(view.parameters({ indices: [] }).items, []);
  assert.equal(Object.hasOwn(view.parameters({}).items[0], "type_name"), false);
});
test("cached metadata/storage cannot be changed by SDK callers", () => {
  const view = createParameterViews(read(fixture()).value);
  const result = view.parameters({});
  assert.throws(() => {
    result.prototype.model = "changed";
  }, TypeError);
  assert.throws(() => {
    result.items[0].storage.offset = "0x0";
  }, TypeError);
  result.items.length = 0;
  assert.equal(view.parameters({}).total, 2);
  assert.equal(view.parameters({}).prototype.model, "__stdcall");
});
test("unknown type/storage is distinct from native void, malformed identities cannot publish partial formals", () => {
  const unknown = fixture();
  Object.assign(unknown.output, {
    type_name: null,
    is_void: null,
    storage: null,
  });
  assert.equal(read(unknown).ok, true);
  const empty = fixture();
  empty.items = [];
  Object.assign(empty.output, {
    type_name: "void",
    is_void: true,
    size_bytes: 0,
    storage: null,
  });
  assert.equal(read(empty).ok, true);
  for (const change of [
    (x) => (x.items[0].id = "parameter:9"),
    (x) => (x.items[1].native_index = 0),
    (x) => (x.output.native_index = 0),
    (x) => (x.items[0].size_bytes = 4),
    (x) => (x.output.is_void = true),
    (x) => (x.output.type_name = null),
    (x) => (x.model_unknown = null),
  ]) {
    const x = fixture();
    change(x);
    assert.equal(read(x).ok, false);
  }
});
test("prototype facet works without graph/calls; unavailable/invalid prototype retains code and reason", () => {
  const available = model({
    atomic_parameters: fixture(),
    atomic_facts_error: { malformed: "not a failure string" },
    atomic_calls_error: "capacity",
  });
  assert.equal(available.facets.parameters.availability, "available");
  assert.equal(available.parameters({}).total, 2);
  assert.equal(available.facets.recovered_ir.availability, "unavailable");
  assert.equal(available.code, "readable");
  for (const fn of [
    {},
    {
      atomic_parameters_error: "native function prototype store is unavailable",
    },
    { atomic_parameters: { schema_version: 99 } },
  ]) {
    const unavailable = model(fn);
    assert.equal(unavailable.code, "readable");
    assert.equal(unavailable.facets.parameters.availability, "unavailable");
    assert.throws(
      () => unavailable.parameters({}),
      (e) => e.details.facet === "parameters",
    );
  }
});
test("parameter input schema matches advertised JSON Schema and rejects guessed keys/indices", () => {
  const validate = new Ajv2020({ strict: false }).compile(
    reference("parameters").methods[0].input_schema,
  );
  for (const [request, valid] of [
    [{}, true],
    [{ indices: [], fields: [] }, true],
    [{ indices: [1, 0, 1], fields: ["storage", "type_name"] }, true],
    [{ indices: [-1] }, false],
    [{ indices: ["0"] }, false],
    [{ fields: ["value_id"] }, false],
    [{ signature: true }, false],
  ]) {
    const input = { snapshot: "snap_test", ...request };
    assert.equal(methods.parameters.input.safeParse(input).success, valid);
    assert.equal(validate(input), valid);
  }
});
