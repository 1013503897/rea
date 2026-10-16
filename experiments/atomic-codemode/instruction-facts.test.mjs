import test from "node:test";
import assert from "node:assert/strict";
import { parseInstructions } from "./instruction-facts.mjs";

const document = (address = "0xd97e") => ({
  binary: "/private/input",
  kind: "code",
  start_hex: address,
  end_hex: `0x${(BigInt(address) + 6n).toString(16)}`,
  count: 1,
  bytes: 6,
  truncated: true,
  notes: ["selected window"],
  instructions: [
    {
      address_hex: address,
      size: 6,
      bytes: "0f87e9080000",
      mnemonic: "JA",
      operands: "0xe26d",
      text: "JA 0xe26d",
    },
  ],
});
const parse = (doc, address = doc.start_hex) =>
  parseInstructions(JSON.stringify(doc), "/private/input", {
    address,
    count: 1,
  });

test("instruction facts preserve exact bytes/addresses and do not substitute an optimized CFG target", () => {
  const result = parse(document());
  assert.equal(result.items[0].address, "0xd97e");
  assert.equal(result.items[0].text, "JA 0xe26d");
  assert.equal(result.items[0].bytes, "0f87e9080000");
  assert.equal(result.items[0].status, "decoded");
  assert.deepEqual(result.coverage.notes, ["selected window"]);
  const high = document("0x20000000000001");
  high.instructions[0].address = Number(BigInt(high.start_hex));
  assert.equal(parse(high).items[0].address, "0x20000000000001");
});

test("unknown bytes remain undecoded and projection retains byte-range identity", () => {
  const doc = document();
  doc.instructions[0].mnemonic = ".byte";
  const result = parseInstructions(
    JSON.stringify(doc),
    "/private/input",
    { address: "0xd97e", count: 1 },
    ["mnemonic"],
  );
  assert.deepEqual(result.items[0], {
    address: "0xd97e",
    size: 6,
    status: "undecoded",
    mnemonic: ".byte",
  });
});

test("wrong target/window, gaps, extent and byte-size contradictions fail at decoding boundary", () => {
  for (const mutate of [
    (doc) => {
      doc.binary = "/other/input";
    },
    (doc) => {
      doc.instructions[0].address_hex = "0xd97f";
    },
    (doc) => {
      doc.instructions[0].size = 5;
    },
    (doc) => {
      doc.end_hex = "0xd985";
    },
    (doc) => {
      doc.count = 2;
    },
  ]) {
    const doc = document();
    mutate(doc);
    assert.throws(
      () => parse(doc),
      (error) => error.code === "invalid_provider_output",
    );
  }
  assert.throws(() => parse(document(), "0xd970"), /window/u);
});

test("decoded-row capacity rejects oversized malformed arrays before expanding errors", () => {
  const doc = document();
  doc.instructions = Array.from({ length: 4097 }, () => ({}));
  assert.throws(() => parse(doc), /capacity/u);
});
