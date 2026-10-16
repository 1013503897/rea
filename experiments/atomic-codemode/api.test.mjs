import assert from "node:assert/strict";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { methods, reference } from "./api.mjs";
import { AtomicSession } from "./session.mjs";

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
test("path selectors agree in runtime and JSON Schema, without inferred target or string identities", () => {
  const validate = new Ajv2020({ strict: false }).compile(
    reference("path").methods[0].input_schema,
  );
  for (const [request, valid] of [
    [{ from: 0, target: { kind: "exit" } }, true],
    [
      {
        from: 0,
        target: { kind: "block", id: 1 },
        avoid: [2, 2],
        offset: 1,
        limit: 1,
      },
      true,
    ],
    [{ from: "0", target: { kind: "exit" } }, false],
    [{ from: 0, target: { kind: "block" } }, false],
    [{ from: 0, target: { kind: "exit", id: 1 } }, false],
    [{ from: 0, target: { kind: "exit" }, avoid: [-1] }, false],
    [{ from: 0, target: { kind: "exit" }, limit: 129 }, false],
  ]) {
    const input = { snapshot: "snap_test", ...request };
    assert.equal(methods.path.input.safeParse(input).success, valid);
    assert.equal(validate(input), valid, JSON.stringify(validate.errors));
  }
});
test("relation identity and operand-only selectors agree in runtime and advertised schemas", () => {
  const validate = new Ajv2020({ strict: false }).compile(
    reference("relations").methods[0].input_schema,
  );
  for (const [request, valid] of [
    [{ kind: "operands", seeds: ["0x1:0"], input_indices: [0, 155] }, true],
    [{ kind: "operands", seeds: ["0x1:0"], input_indices: [] }, true],
    [{ kind: "uses", seeds: ["0x1:0"] }, true],
    [
      {
        kind: "cases",
        seeds: ["0x1:0"],
        case_values: ["0xffffffffffffffff"],
        case_indices: [0, 155],
      },
      true,
    ],
    [{ kind: "cases", seeds: [0] }, false],
    [{ kind: "cases", seeds: ["0x1:0"], case_values: ["0X1"] }, false],
    [{ kind: "incoming", seeds: [0] }, true],
    [{ kind: "incoming", seeds: ["0"] }, false],
    [{ kind: "operands", seeds: [0] }, false],
    [{ kind: "uses", seeds: ["0x1:0"], input_indices: [0] }, false],
    [{ kind: "operands", seeds: ["0x1:0"], input_indices: [-1] }, false],
  ]) {
    const input = { snapshot: "snap_test", ...request };
    assert.equal(methods.relations.input.safeParse(input).success, valid);
    assert.equal(validate(input), valid, JSON.stringify(validate.errors));
  }
});
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
for (const action of ["close", "replace"])
  test(`failed open retains session file owners through ${action} and cleanup retry`, async () => {
    let acquisitions = 0,
      cleanupAttempts = 0,
      releasable = false;
    const primary = new Error(
      "Engine inspection failed after acquiring a file",
    );
    const session = new AtomicSession(async (path, { fileResources }) => {
      acquisitions++;
      if (acquisitions === 1)
        return fileResources.run(async () => {
          fileResources.retain({
            kind: "lease",
            resource: "/selected/engine",
            lease: {
              release: async () => {
                cleanupAttempts++;
                if (!releasable) throw new Error("Descriptor remains open");
              },
            },
          });
          throw primary;
        });
      return {
        context: { lease: "recovered", selected_path: path },
        close: async () => {},
      };
    });
    await assert.rejects(session.open("first"), (error) => error === primary);
    assert.equal(session.context, null);
    assert.equal(
      (await session.call("strings", { query: "x" })).error.code,
      "no_target",
    );
    const retry = () =>
      action === "close" ? session.close() : session.open("second");
    await assert.rejects(
      retry(),
      (error) =>
        error.code === "cleanup_incomplete" &&
        error.details.resources.length === 1 &&
        error.details.resources[0] === "/selected/engine",
    );
    assert.equal(acquisitions, 1, "Unresolved owners block replacement");
    assert.equal(cleanupAttempts, 1);
    releasable = true;
    assert.equal((await retry()).ok, true);
    assert.equal(cleanupAttempts, 2);
    if (action === "close") {
      assert.equal(session.context, null);
      assert.equal((await session.open("second")).ok, true);
    }
    assert.equal(acquisitions, 2);
    assert.equal(session.context.lease, "recovered");
    await session.close();
    assert.equal(cleanupAttempts, 2, "Released owners are not retried");
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
