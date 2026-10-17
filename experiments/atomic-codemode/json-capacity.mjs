// Admit standard JSON encoding before allocating its expanded string.
import { types } from "node:util";

// JSON must escape controls and unpaired surrogates.
// eslint-disable-next-line no-control-regex
const escaped = /["\\\u0000-\u001f\ud800-\udfff]/u;
const shortEscapes = new Set([8, 9, 10, 12, 13]);
const omitted = (value) =>
  value === undefined ||
  typeof value === "function" ||
  typeof value === "symbol";

// Above the remaining budget this returns a lower bound; otherwise it is exact.
const quotedBytes = (text, remaining) => {
  if (text.length + 2 > remaining) return text.length + 2;
  if (!escaped.test(text)) return Buffer.byteLength(text) + 2;
  let bytes = 2;
  for (let i = 0; i < text.length && bytes <= remaining; i++) {
    const c = text.charCodeAt(i);
    if (c === 34 || c === 92) bytes += 2;
    else if (c < 32) bytes += shortEscapes.has(c) ? 2 : 6;
    else if (c < 128) bytes++;
    else if (c < 2048) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 6;
    } else bytes += c >= 0xdc00 && c <= 0xdfff ? 6 : 3;
  }
  return bytes;
};
const invalid = (reason) => ({
  ok: false,
  error: { kind: "invalid_json", reason },
});

class JsonMeasure {
  bytes = 0;
  stack = [];
  ancestors = new Set();
  constructor(limit) {
    this.limit = limit;
  }
  capacity(minimum = this.bytes) {
    return {
      ok: false,
      error: {
        kind: "capacity",
        limit_bytes: this.limit,
        minimum_encoded_bytes: minimum,
      },
    };
  }
  add(count) {
    this.bytes += count;
    return this.bytes > this.limit ? this.capacity() : null;
  }
  enter(value) {
    const validity = validateContainer(value, this.ancestors);
    if (!validity.ok) return validity;
    const array = Array.isArray(value),
      minimum = array && value.length ? 2 * value.length + 1 : 2;
    if (array && this.bytes + minimum > this.limit)
      return this.capacity(this.bytes + minimum);
    const failure = this.add(2);
    if (failure) return failure;
    const keys = array ? null : Object.keys(value);
    this.ancestors.add(value);
    this.stack.push({ kind: "exit", value });
    this.stack.push({
      kind: array ? "array" : "object",
      value,
      keys,
      length: array ? value.length : keys.length,
      index: 0,
      first: true,
    });
    return null;
  }
  member(frame) {
    if (frame.index === frame.length) return null;
    const key =
        frame.kind === "array"
          ? String(frame.index++)
          : frame.keys[frame.index++],
      descriptor = Object.getOwnPropertyDescriptor(frame.value, key);
    if (descriptor?.get || descriptor?.set)
      return invalid("JSON capacity admission does not invoke accessors");
    if (frame.kind === "array" && !descriptor && key in frame.value)
      return invalid("Inherited array elements are not owned JSON facts");
    const child = descriptor?.value;
    this.stack.push(frame);
    if (frame.kind === "object") {
      if (omitted(child)) return null;
      const failure = this.add(
        (frame.first ? 0 : 1) + quotedBytes(key, this.limit - this.bytes) + 1,
      );
      if (failure) return failure;
      frame.first = false;
    } else if (frame.index > 1) {
      const failure = this.add(1);
      if (failure) return failure;
    }
    this.stack.push({
      kind: "value",
      value: frame.kind === "array" && omitted(child) ? null : child,
    });
    return null;
  }
  value(value) {
    if (value === null) return this.add(4);
    switch (typeof value) {
      case "string":
        return this.add(quotedBytes(value, this.limit - this.bytes));
      case "boolean":
        return this.add(value ? 4 : 5);
      case "number":
        return this.add(Number.isFinite(value) ? String(value).length : 4);
      case "object":
        return this.enter(value);
      default:
        return invalid(`Unsupported JSON value: ${typeof value}`);
    }
  }
  run(value) {
    this.stack.push({ kind: "value", value });
    while (this.stack.length) {
      const frame = this.stack.pop();
      if (frame.kind === "exit") {
        this.ancestors.delete(frame.value);
        continue;
      }
      const failure =
        frame.kind === "value" ? this.value(frame.value) : this.member(frame);
      if (failure) return failure;
    }
    return { ok: true, bytes: this.bytes };
  }
}

const validateContainer = (value, ancestors) => {
  if (types.isProxy(value))
    return invalid("Proxy values are not owned JSON facts");
  const array = Array.isArray(value),
    prototype = Object.getPrototypeOf(value),
    toJSON =
      Object.getOwnPropertyDescriptor(value, "toJSON") ??
      (prototype && Object.getOwnPropertyDescriptor(prototype, "toJSON")) ??
      (prototype === Array.prototype &&
        Object.getOwnPropertyDescriptor(Object.prototype, "toJSON"));
  if (toJSON?.get || toJSON?.set || typeof toJSON?.value === "function")
    return invalid("JSON capacity admission does not invoke custom toJSON");
  if (
    prototype !== (array ? Array.prototype : Object.prototype) &&
    prototype !== null
  )
    return invalid("Only plain JSON records and arrays are supported");
  if (ancestors.has(value)) return invalid("Cyclic JSON value");
  return { ok: true };
};

/** Exact UTF-8 size when admitted; bounded traversal and honest lower bounds otherwise. */
export const measureJson = (value, limit) => {
  if (!Number.isSafeInteger(limit) || limit < 0)
    return invalid("JSON byte limit must be a nonnegative safe integer");
  return new JsonMeasure(limit).run(value);
};

export const serializeJson = (value, limit) => {
  const measured = measureJson(value, limit);
  if (!measured.ok) return measured;
  try {
    const text = JSON.stringify(value);
    if (typeof text !== "string" || Buffer.byteLength(text) !== measured.bytes)
      return invalid("JSON value changed during encoding");
    return { ok: true, text, bytes: measured.bytes };
  } catch {
    return invalid("JSON encoding failed after capacity admission");
  }
};
