import assert from "node:assert/strict";
import test from "node:test";
import { NativeCaptureCache } from "./native-capture-cache.mjs";
import { FactFailure } from "./fact-error.mjs";
import { MAX_NATIVE_SOURCES } from "./limits.mjs";

const refusal = () =>
  new FactFailure("resource_constraint", "native source cannot fit", {
    scope: "native_source",
    limit_bytes: 8,
    observed_bytes_at_least: 9,
    evidence_id: "ev_owned",
    source_retained: true,
    source_complete: false,
  });

test("capacity reuse preserves observed facts, reports reuse and isolates mutable SDK error views", async () => {
  const cache = new NativeCaptureCache();
  let runs = 0,
    first;
  const load = async () => {
    runs++;
    throw refusal();
  };
  await assert.rejects(cache.read("strings", load), (error) => {
    first = error;
    assert.equal(error.details.cached_observation, undefined);
    return true;
  });
  first.details.evidence_id = "caller edit";
  first.details.limit_bytes = 999;
  await assert.rejects(cache.read("strings", load), (error) => {
    assert.equal(error.code, "resource_constraint");
    assert.equal(error.details.evidence_id, "ev_owned");
    assert.equal(error.details.limit_bytes, 8);
    assert.deepEqual(error.details.cached_observation, {
      kind: "source_budget_refusal",
      scope: "target_lease",
    });
    return true;
  });
  assert.equal(runs, 1);
  cache.clear();
  await assert.rejects(cache.read("strings", load));
  assert.equal(runs, 2);
});

test("concurrent reads share one capture and capture keys remain independent", async () => {
  const cache = new NativeCaptureCache();
  let finish,
    runs = 0;
  const load = () => {
    runs++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const a = cache.read("one", load),
    b = cache.read("one", load);
  await Promise.resolve();
  assert.equal(runs, 1);
  const value = Object.freeze({ source: { evidence_id: "ev_one" } });
  finish(value);
  assert.strictEqual(await a, value);
  assert.strictEqual(await b, value);
  assert.strictEqual(
    await cache.read("one", () => {
      throw new Error("must reuse");
    }),
    value,
  );
  assert.equal(await cache.read("two", async () => 2), 2);
});

test("cancelled, cleanup, IO, unknown and unproven capacity failures stay retryable observations", async () => {
  const base = refusal();
  for (const failure of [
    undefined,
    null,
    false,
    0,
    "failure",
    new FactFailure("cancelled", "cancelled"),
    new FactFailure("cleanup_incomplete", "unknown process ownership", {
      source_capture_failure: base,
    }),
    new FactFailure("source_write_failed", "disk full"),
    { code: base.code, details: base.details },
    new FactFailure("resource_constraint", "other resource", {
      scope: "memory",
    }),
    new FactFailure(base.code, base.message, {
      ...base.details,
      observed_bytes_at_least: 8,
    }),
    new FactFailure(base.code, base.message, {
      ...base.details,
      source_complete: true,
    }),
    new FactFailure(base.code, base.message, {
      ...base.details,
      unknown: { state: "live" },
    }),
    new FactFailure(base.code, base.message, {
      ...base.details,
      cleanup_incomplete: "unconfirmed descriptor close",
    }),
    new FactFailure(base.code, base.message, {
      ...base.details,
      unknown: "live state",
    }),
    new FactFailure(base.code, base.message, {
      ...base.details,
      source_retained: false,
    }),
    new FactFailure(base.code, base.message, {
      ...base.details,
      evidence_id: undefined,
    }),
  ]) {
    const cache = new NativeCaptureCache();
    let runs = 0;
    for (let i = 0; i < 2; i++) {
      let rejected = false;
      try {
        await cache.read("key", async () => {
          runs++;
          throw failure;
        });
      } catch (error) {
        rejected = true;
        assert.strictEqual(error, failure);
      }
      assert(rejected);
    }
    assert.equal(runs, 2);
  }
});

test("failure classification never invokes accessors or substitutes an inspection error", async () => {
  let reads = 0,
    runs = 0;
  const details = Object.defineProperty({}, "scope", {
    enumerable: true,
    get() {
      reads++;
      throw new Error("must not inspect");
    },
  });
  const original = new FactFailure(
      "resource_constraint",
      "unknown source failure",
      details,
    ),
    cache = new NativeCaptureCache();
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      cache.read("key", async () => {
        runs++;
        throw original;
      }),
      (error) => error === original,
    );
  assert.equal(reads, 0);
  assert.equal(runs, 2);
});

test("memo retention stays within the source-count policy without refusing uncached results", async () => {
  const cache = new NativeCaptureCache();
  for (let i = 0; i < MAX_NATIVE_SOURCES; i++)
    await assert.rejects(
      cache.read(String(i), async () => {
        throw refusal();
      }),
    );
  let runs = 0;
  for (let i = 0; i < 2; i++)
    assert.equal(
      await cache.read("beyond memo capacity", async () => {
        runs++;
        return "still delivered";
      }),
      "still delivered",
    );
  assert.equal(runs, 2);
  await assert.rejects(
    cache.read("0", async () => {
      throw new Error("existing memo lost");
    }),
    (error) =>
      error.details.cached_observation.kind === "source_budget_refusal",
  );
});
