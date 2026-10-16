// Real provider regression for shared SDK cache ownership, without MCP's copies.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { AtomicSession } from "./session.mjs";

const [binary, output] = process.argv.slice(2);
assert.ok(binary && output, "Usage: verify-sdk.mjs ZLIB OUTPUT");
const session = new AtomicSession();
const call = async (name, input) => {
  const result = await session.call(name, input);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.data;
};
let report;
try {
  await session.open(binary);
  const first = await call("strings", { query: "incorrect header check" });
  assert.equal(first.total, 1);
  const original = structuredClone(first);
  assert.throws(() => {
    first.items[0].value = "changed by SDK caller";
  }, TypeError);
  assert.throws(() => {
    first.items[0].string.byte_length = 1;
  }, TypeError);
  // This array belongs to the reply, so changing it must also be harmless.
  first.items.length = 0;
  const next = await call("strings", { query: "incorrect header check" });
  assert.deepEqual(next, original);
  const functions = await call("functions", { query: "inflate", exact: true });
  assert.ok(functions.total >= 1);
  assert.throws(() => {
    functions.items[0].aliases.push("foreign alias");
  }, TypeError);
  const nextFunctions = await call("functions", {
    addresses: functions.items.map((item) => item.address),
  });
  assert.deepEqual(nextFunctions.items, functions.items);
  let offset = 0,
    text = "";
  do {
    const page = await call("evidence", {
      evidence_id: next.source.evidence_id,
      offset,
      limit: 16384,
    });
    assert.throws(() => {
      page.source.arguments[0] = "foreign operation";
    }, TypeError);
    text += page.text;
    offset = page.next_offset;
  } while (offset !== null);
  assert.equal(
    createHash("sha256").update(text).digest("hex"),
    next.source.sha256,
  );
  report = {
    context: session.context,
    source: next.source,
    cache_unchanged_after_caller_mutation: true,
    complete_source_digest_verified: true,
    scope:
      "Real SDK/provider reads. No model/token or runtime feasibility claim.",
  };
} finally {
  await session.close();
}
await writeFile(output, JSON.stringify(report));
console.log(JSON.stringify({ output, ...report }));
