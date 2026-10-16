import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
  decodeGraphArchive,
  MAX_GRAPH_JSON_BYTES,
} from "./native-graph-encoding.mjs";

const encodeBytes = (bytes) => ({
  schema_version: 4,
  encoding: "gzip-base64",
  raw_bytes: bytes.length,
  data: gzipSync(bytes, { level: 1 }).toString("base64"),
});
const encode = (value) => encodeBytes(Buffer.from(JSON.stringify(value)));
test("bounded gzip preserves logical JSON fields and legacy graphs without a second interpretation", () => {
  const graph = {
    schema_version: 3,
    statement: "中文\u0000😀",
    offset: "0xffffffffffffffff",
  };
  assert.equal(decodeGraphArchive(encode(graph)), JSON.stringify(graph));
  assert.equal(decodeGraphArchive(graph), undefined);
});
test("admission rejects unsupported envelopes and malformed base64 before inflation", () => {
  const good = encode({ schema_version: 3 });
  for (const change of [
    { encoding: "deflate" },
    { raw_bytes: 0 },
    { raw_bytes: MAX_GRAPH_JSON_BYTES + 1 },
    { unexpected: true },
    { data: "AAAA\n" },
    { data: "A===" },
    { data: "?AAA" },
    { data: "A".repeat(8 * 1024 * 1024 + 1) },
  ])
    assert.throws(() => decodeGraphArchive({ ...good, ...change }));
  assert.throws(
    () => decodeGraphArchive({ ...good, data: "AB==" }),
    /noncanonical/,
  );
});
test("inflation respects declared size and verifies framing without interpreting logical source", () => {
  const graph = { schema_version: 3, statement: "x".repeat(1024 * 1024) };
  const good = encode(graph);
  assert.throws(() => decodeGraphArchive({ ...good, raw_bytes: 64 }), {
    code: "ERR_BUFFER_TOO_LARGE",
  });
  assert.throws(
    () => decodeGraphArchive({ ...good, raw_bytes: good.raw_bytes + 1 }),
    /differs/,
  );
  const corrupt = Buffer.from(good.data, "base64");
  corrupt[corrupt.length - 8] ^= 1;
  assert.throws(() =>
    decodeGraphArchive({ ...good, data: corrupt.toString("base64") }),
  );
  assert.throws(() =>
    decodeGraphArchive({
      ...good,
      data: Buffer.from(good.data, "base64").subarray(0, -5).toString("base64"),
    }),
  );
  assert.throws(() => decodeGraphArchive(encodeBytes(Buffer.from([0xff]))));
  assert.equal(decodeGraphArchive(encodeBytes(Buffer.from("{"))), "{");
});
