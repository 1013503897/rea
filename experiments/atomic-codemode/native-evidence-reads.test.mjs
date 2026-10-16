import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { NativeEvidenceReads } from "./native-evidence-reads.mjs";

const hash = (s) => createHash("sha256").update(s).digest("hex");
function captured(text) {
  const bytes = Buffer.from(text);
  const wire = JSON.stringify({
    binary: "/input",
    count: 1,
    language: "c",
    error: null,
    functions: [
      {
        address_hex: "0x1000",
        code: "retained C",
        error: null,
        atomic_facts: {
          schema_version: 4,
          encoding: "gzip-base64",
          raw_bytes: bytes.length,
          data: gzipSync(bytes).toString("base64"),
        },
      },
    ],
  });
  return {
    text: wire,
    source: {
      evidence_id: "ev_owned",
      sha256: hash(wire),
      bytes: Buffer.byteLength(wire),
    },
  };
}
test("decoded Evidence pages preserve their own byte identity and raw source provenance", async () => {
  const logical = "{malformed JSON with 中文 and 😀",
    source = captured(logical);
  const reader = new NativeEvidenceReads(async () => source);
  const raw = await reader.read({ evidence_id: "ev_owned", limit: 1e5 });
  assert.equal(raw.text, source.text);
  assert.equal(raw.view, undefined);
  const chunks = [];
  for (let offset = 0; offset < logical.length; offset += 3) {
    const page = await reader.read({
      evidence_id: "ev_owned",
      component: "recovered_ir",
      offset,
      limit: 3,
    });
    chunks.push(page.text);
    assert.equal(page.source.sha256, source.source.sha256);
    assert.equal(page.view.sha256, hash(logical));
    assert.equal(page.view.bytes, Buffer.byteLength(logical));
    assert.equal(page.total_code_units, logical.length);
  }
  assert.equal(chunks.join(""), logical);
});
test("decoded view reuse still requires source-owner validation and follows content identity", async () => {
  let source = captured('{"schema_version":3}'),
    failure = false,
    reads = 0;
  const reader = new NativeEvidenceReads(async () => {
    reads++;
    if (failure) throw new Error("source_changed");
    return source;
  });
  const query = { evidence_id: "ev_owned", component: "recovered_ir" };
  await reader.read(query);
  failure = true;
  await assert.rejects(reader.read(query), /source_changed/);
  failure = false;
  source = captured('{"schema_version":3,"new":true}');
  assert.equal(
    (await reader.read(query)).text,
    '{"schema_version":3,"new":true}',
  );
  reader.clear();
  assert.equal(
    (await reader.read(query)).view.sha256,
    hash('{"schema_version":3,"new":true}'),
  );
  assert.equal(reads, 4);
});
