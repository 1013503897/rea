import assert from "node:assert/strict";
import test from "node:test";
import { mappedCode } from "./mapped-code.mjs";

const reference = {
  functions: [{ address: "0x1000" }],
  sites: [{ from: "0x2000" }, { from: "0x2001" }],
};
const document = () => ({
  binary: "/private/input",
  count: 1,
  functions: [
    {
      address: 4096,
      address_hex: "0x1000",
      code: "one\ntwo\nthree\nfour\nfive",
      error: null,
      line_mappings: [{ line_number: 3, addresses: [8192] }],
    },
  ],
});
const native = (value) => async () => ({
  input: "/private/input",
  stdout: { text: JSON.stringify(value) },
});

test("a mapped subset names unmapped sites instead of implying complete mapping", async () => {
  const result = await mappedCode(native(document()), reference, 1);
  assert.equal(result.status, "partial");
  assert.deepEqual(result.unmapped_reference_sites, ["0x2001"]);
  assert.deepEqual(result.slices, [
    { start_line: 2, end_line: 4, text: "two\nthree\nfour" },
  ]);
  assert.equal(result.coverage.status, "partial");
});

test("unmapped locations never select a nearby printed line", async () => {
  const result = await mappedCode(native(document()), {
    ...reference,
    sites: [{ from: "0x1fff" }],
  });
  assert.equal(result.status, "unknown");
});

test("unsafe numeric address arrays stay unknown without lossy conversion", async () => {
  const value = document();
  value.functions[0].line_mappings[0].addresses = [Number.MAX_SAFE_INTEGER + 1];
  const result = await mappedCode(native(value), reference);
  assert.equal(result.status, "unknown");
});

test("malformed line locations reject the view before publishing fragments", async () => {
  const value = document();
  value.functions[0].line_mappings[0].line_number = 99;
  await assert.rejects(mappedCode(native(value), reference));
});
