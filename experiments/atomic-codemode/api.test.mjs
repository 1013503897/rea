import assert from "node:assert/strict";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { AtomicSession, reference } from "./api.mjs";

const factory = () => {
  let sequence = 0;
  const calls = [];
  const create = async (path) => ({
    context: { lease: `lease-${++sequence}`, selected_path: path },
    close: async () => {
      calls.push("close");
    },
    cancel: () => {
      calls.push("cancel");
    },
    strings: async (input) => {
      calls.push(input);
      return { items: [], source: { evidence_id: "ev_real-owner" } };
    },
  });
  return { create, calls };
};
test("named contracts reject extra keys and stale leases before provider admission", async () => {
  const provider = factory();
  const session = new AtomicSession(provider.create);
  await session.open("first");
  const lease = session.context.lease;
  const invalid = await session.call("strings", { query: "x", guessed: true });
  assert.equal(invalid.error.code, "invalid_input");
  const wrongIdentity = await session.call("relations", {
    snapshot: "snap_test",
    kind: "incoming",
    seeds: ["0"],
  });
  assert.equal(wrongIdentity.error.code, "invalid_input");
  assert.equal(provider.calls.length, 0);
  await session.open("second");
  const stale = await session.call("strings", { query: "x" }, undefined, lease);
  assert.equal(stale.error.code, "stale_context");
  assert.deepEqual(provider.calls, ["close"]);
  await session.close();
});

test("cancellation after a completed read retains observations under a cancelled outcome", async () => {
  const controller = new AbortController();
  const session = new AtomicSession(async () => ({
    context: { lease: "late-cancel" },
    close: async () => {},
    strings: async () => {
      controller.abort();
      return {
        source: { evidence_id: "ev_observed" },
        items: [{ value: "retained" }],
      };
    },
  }));
  await session.open("target");
  const result = await session.call(
    "strings",
    { query: "x" },
    controller.signal,
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "cancelled");
  assert.equal(
    result.error.details.partial_observation.items[0].value,
    "retained",
  );
  assert.equal(result.context.lease, "late-cancel");
  await session.close();
});
test("close drains admitted reads and a failed cleanup retains ownership for retry", async () => {
  let release;
  let reads = 0;
  let closes = 0;
  const session = new AtomicSession(async () => ({
    context: { lease: "owned" },
    strings: () => {
      reads++;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    close: () => {
      if (++closes === 1) throw new Error("cleanup failed");
    },
    cancel() {},
  }));
  await session.open("target");
  const read = session.call("strings", { query: "x" });
  await new Promise((resolve) => setImmediate(resolve));
  const close = session.close();
  assert.equal(closes, 0);
  assert.equal(reads, 1);
  release({ items: [] });
  assert.equal((await read).ok, true);
  await assert.rejects(close, /cleanup failed/u);
  assert.equal(session.context.lease, "owned");
  await session.close();
  assert.equal(session.context, null);
});
test("cancellation before admission makes no provider query; advertised reference schemas compile", async () => {
  const provider = factory();
  const session = new AtomicSession(provider.create);
  await session.open("target");
  const stop = new AbortController();
  stop.abort();
  const cancelled = await session.call("strings", { query: "x" }, stop.signal);
  assert.equal(cancelled.error.code, "cancelled");
  assert.deepEqual(provider.calls, []);
  const ajv = new Ajv2020({ strict: false });
  for (const method of reference().methods) ajv.compile(method.input_schema);
  await session.close();
});
