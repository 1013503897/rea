import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { measureJson, serializeJson } from "./json-capacity.mjs";

test("JSON admission matches native UTF-8 encoding, including aliases and omitted slots", () => {
  const sparse = [];
  sparse.length = 3;
  sparse[0] = undefined;
  sparse[2] = () => 1;
  const shared = { text: '"\\\b\t\n\f\r\u0000Δ😀\ud800\udfff' };
  for (const value of [
    null,
    false,
    -0,
    NaN,
    Infinity,
    1e-20,
    {},
    [],
    sparse,
    { shared, alias: shared, omitted: undefined },
    { [shared.text]: [shared.text, null] },
  ]) {
    const text = JSON.stringify(value),
      bytes = Buffer.byteLength(text);
    assert.deepEqual(measureJson(value, bytes), { ok: true, bytes });
    assert.equal(serializeJson(value, bytes).text, text);
    const small = measureJson(value, bytes - 1);
    assert.equal(small.error.kind, "capacity");
    assert(small.error.minimum_encoded_bytes > bytes - 1);
    assert(small.error.minimum_encoded_bytes <= bytes);
  }
});

test("capacity failure precedes JSON allocation for raw size and escaping expansion", () => {
  const original = JSON.stringify;
  const spy = mock.method(JSON, "stringify", (...args) => original(...args));
  try {
    for (const value of [
      { text: "a".repeat(2048) },
      { text: "\\".repeat(800) },
    ]) {
      assert.equal(serializeJson(value, 1024).error.kind, "capacity");
    }
    assert.equal(spy.mock.callCount(), 0);
    const huge = [];
    huge.length = 1_000_000_000;
    assert.equal(measureJson(huge, 1024).error.kind, "capacity");
  } finally {
    spy.mock.restore();
  }
});

test("unknown values do not invoke getters, proxies or custom serializers", () => {
  let invoked = 0;
  const getter = Object.defineProperty({}, "text", {
    enumerable: true,
    get: () => ++invoked,
  });
  const custom = { toJSON: () => ++invoked };
  const proxy = new Proxy({}, { get: () => ++invoked });
  const cycle = {};
  cycle.self = cycle;
  for (const value of [getter, custom, proxy, cycle, 1n, undefined, new Date()])
    assert.equal(serializeJson(value, 65536).error.kind, "invalid_json");
  assert.equal(invoked, 0);
  const prior = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON");
  let inherited;
  try {
    Object.defineProperty(Object.prototype, "toJSON", {
      configurable: true,
      value: () => ++invoked,
    });
    inherited = measureJson([], 65536);
  } finally {
    if (prior) Object.defineProperty(Object.prototype, "toJSON", prior);
    else delete Object.prototype.toJSON;
  }
  assert.equal(inherited.error.kind, "invalid_json");
  assert.equal(invoked, 0);
});

test("deterministic mixed Unicode cases preserve exact expansion boundaries", () => {
  let state = 0x12345678;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  for (let n = 0; n < 1500; n++) {
    const text = Array.from({ length: next() % 100 }, () =>
      String.fromCharCode(next() % 65536),
    ).join("");
    const value = { [text]: [text, n, n % 2 === 0, { text }] };
    const bytes = Buffer.byteLength(JSON.stringify(value));
    assert.equal(measureJson(value, bytes).bytes, bytes);
    assert.equal(measureJson(value, bytes - 1).error.kind, "capacity");
  }
});
