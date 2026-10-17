import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { methods } from "./api.mjs";
import {
  NativeStringQueryReader,
  NativeStringQueryReads,
  nativeStringQueryInput,
} from "./native-string-query.mjs";

const input = (extra = {}) =>
  methods.strings.input.parse({ query: "abc", limit: 1, ...extra });
const request = (extra = {}) => nativeStringQueryInput(input(extra));
const item = (text = true) => ({
  source_row: 3,
  address_hex: "0x1000",
  length: 5,
  byte_length: 6,
  nul_terminated: true,
  encoding: "ascii",
  section: ".rodata",
  ...(text ? { text: "abcde" } : {}),
});
function document(req, extra = {}, budget = 4096) {
  return {
    schema_version: 1,
    binary: "/input",
    query_utf16le_hex: req.hex,
    encoding: "all",
    min_length: 5,
    section: null,
    termination: "any",
    scanned: "sections",
    xrefs: false,
    examined_rows: 10,
    total: 1,
    offset: req.offset,
    limit: req.limit,
    next_offset: null,
    text_requested: req.text,
    text_included: req.text,
    output_bytes: budget,
    status: "complete",
    required_encoded_bytes_at_least: null,
    items: [item(req.text)],
    ...extra,
  };
}
async function decode(req, doc, budget = 4096) {
  const text = JSON.stringify(doc),
    reader = new NativeStringQueryReader(req, budget);
  await pipeline(Readable.from([Buffer.from(text)]), reader);
  return { parsed: reader.finish("/input"), text };
}

test("metadata and full query reports share the canonical native string semantics", async () => {
  for (const fields of [[], ["value"]]) {
    const req = request({ fields }),
      { parsed } = await decode(req, document(req));
    assert(parsed.ok);
    const row = parsed.value.items[0];
    assert.equal(row.address, "0x1000");
    assert.equal(row.source_row, 3);
    assert.equal(row.string.byte_length, 6);
    assert.equal(row.string.nul_terminated, true);
    assert.equal(Object.hasOwn(row, "value"), req.text);
  }
  const req = request({ query: "\ude00" });
  const doc = document(req, {
    items: [
      {
        ...item(),
        text: "hello😀",
        encoding: "utf8",
        length: 6,
        byte_length: 10,
      },
    ],
  });
  assert((await decode(req, doc)).parsed.ok);
  const max = request({ fields: [] });
  assert(
    (
      await decode(
        max,
        document(max, {
          items: [{ ...item(false), address_hex: "0xfffffffffffffffa" }],
        }),
      )
    ).parsed.ok,
  );
});

test("wrong query identity, impossible counts, extents and hidden text cannot produce empty success", async () => {
  const req = request({ fields: [] });
  const malformed = [
    { binary: "/other" },
    { query_utf16le_hex: "other" },
    { offset: 1 },
    { limit: 2 },
    { output_bytes: 1 },
    { total: 11 },
    { total: 2 },
    { next_offset: 1 },
    { text_requested: true },
    { text_included: true },
    { items: [{ ...item(false), source_row: 10 }] },
    { items: [{ ...item(false), address_hex: "0xffffffffffffffff" }] },
    { items: [{ ...item(false), byte_length: 5 }] },
    { items: [{ ...item(false), text: "abcde" }] },
    { items: [{ ...item(false), text: null }] },
    { items: [item(false), item(false)] },
    { status: "text-omitted", required_encoded_bytes_at_least: 4097 },
  ];
  for (const patch of malformed) {
    const parsed = (await decode(req, document(req, patch))).parsed;
    assert.equal(parsed.ok, false, JSON.stringify(patch));
  }
  const withText = request();
  assert.equal(
    (
      await decode(
        withText,
        document(withText, { items: [{ ...item(), text: "xxxxx" }] }),
      )
    ).parsed.ok,
    false,
  );
  const page = request({ fields: [], limit: 2 });
  for (const items of [
    [
      { ...item(false), source_row: 2, address_hex: "0x2000" },
      { ...item(false), source_row: 3, address_hex: "0x1000" },
    ],
    [
      { ...item(false), source_row: 2, encoding: "utf8" },
      { ...item(false), source_row: 3, encoding: "ascii" },
    ],
  ])
    assert.equal(
      (await decode(page, document(page, { total: 2, items }))).parsed.ok,
      false,
    );
});

test("literal transport preserves lone UTF16 units and checks the real argument bound before expansion", () => {
  assert.equal(request({ query: "\ud800" }).hex, "00d8");
  assert.equal(request({ query: "\ude00" }).hex, "00de");
  assert.equal(request({ query: "\0" }).hex, "0000");
  assert.equal(request({ query: "x".repeat(32767) }).hex.length, 131068);
  assert.throws(
    () => request({ query: "x".repeat(32768) }),
    (error) =>
      error.code === "resource_constraint" &&
      error.details.scope === "native_query_argument",
  );
});

function captures({ omitted = false, invalid = false } = {}) {
  let count = 0;
  const capture = async (key, args, _signal, readerFactory) => {
    count++;
    const budget = 4096,
      argv = args("/input", budget),
      hex = argv[argv.indexOf("--atomic-literal-utf16le-hex") + 1];
    const req = {
      hex,
      query: "abc",
      offset: 0,
      limit: 1,
      text: !argv.includes("--atomic-metadata-only"),
    };
    const doc = document(
      req,
      omitted
        ? {
            text_included: false,
            items: [item(false)],
            status: "text-omitted",
            required_encoded_bytes_at_least: 4097,
          }
        : {},
    );
    const text = JSON.stringify(doc),
      reader = readerFactory(budget);
    await pipeline(Readable.from([Buffer.from(text)]), reader);
    return {
      parsed: reader.finish("/input"),
      input: "/input",
      source: {
        evidence_id: "ev_" + count,
        sha256: invalid
          ? "wrong"
          : createHash("sha256").update(text).digest("hex"),
        bytes: Buffer.byteLength(text),
        capture_complete: true,
      },
    };
  };
  return { owner: new NativeStringQueryReads(capture), count: () => count };
}

test("compatible field projections reuse validated captures and preserve exact-query provenance", async () => {
  const a = captures(),
    full = await a.owner.read(input());
  const selected = await a.owner.read(input({ fields: [] }));
  assert.equal(a.count(), 1);
  assert.equal(selected.source.evidence_id, full.source.evidence_id);
  assert(!Object.hasOwn(selected.items[0], "value"));
  const b = captures(),
    metadata = await b.owner.read(input({ fields: [] }));
  await b.owner.read(input());
  const again = await b.owner.read(input({ fields: [] }));
  assert.equal(b.count(), 2);
  assert.equal(again.source.evidence_id, metadata.source.evidence_id);
});

test("a text-budget fallback remains a typed partial observation and can answer metadata without rescanning", async () => {
  const fixture = captures({ omitted: true });
  let id;
  await assert.rejects(fixture.owner.read(input()), (error) => {
    assert.equal(error.code, "resource_constraint");
    assert.equal(error.details.scope, "native_query_output");
    assert.equal(
      error.details.partial_observation.items[0].string.byte_length,
      6,
    );
    id = error.details.evidence_id;
    return true;
  });
  const metadata = await fixture.owner.read(input({ fields: [] }));
  assert.equal(metadata.source.evidence_id, id);
  assert.equal(metadata.coverage.source_text, "omitted-by-budget");
  assert.equal(fixture.count(), 1);
});

test("invalid parsed-source identity keeps a readable source handle", async () => {
  const fixture = captures({ invalid: true });
  await assert.rejects(
    fixture.owner.read(input()),
    (error) =>
      error.code === "invalid_provider_output" &&
      error.details.evidence_id === "ev_1" &&
      error.details.source_retained,
  );
});
