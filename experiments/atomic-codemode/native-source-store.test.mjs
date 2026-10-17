import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile, writeFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { PrivateRuntimeRoot } from "../../dist/process/PrivateRuntimeRoot.js";
import { KunaStringInventoryReader } from "../../dist/kuna/KunaStringInventory.js";
import { NativeSourceStore } from "./native-source-store.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function withFiles(work) {
  const root = await PrivateRuntimeRoot.create({ prefix: "rea-source-test-" });
  const files = new NativeSourceStore({
    root: root.path,
    context: { lease: "test", path: "/input" },
  });
  try {
    await work(files);
  } finally {
    await files.close();
    await root.close();
  }
}
const retain = (files, spool) =>
  files.retain(spool, {
    arguments: ["strings", "/input"],
    input: "/input",
    started: performance.now(),
    complete: true,
  });

// UTF-8 byte boundaries, UTF-16 unit boundaries and the selected window differ.
test("raw windows preserve slice semantics, exact hashes and complete source lengths", () =>
  withFiles(async (files) => {
    const text = "x".repeat(65535) + "中文😀" + "y".repeat(65537),
      bytes = Buffer.from(text);
    const spool = await files.spool(bytes.length);
    await pipeline(
      Readable.from([bytes.subarray(0, 65536), bytes.subarray(65536)]),
      spool,
    );
    await spool.close();
    assert.equal((await stat(spool.path)).mode & 0o777, 0o600);
    const source = await retain(files, spool);
    assert.equal(source.sha256, hash(bytes));
    for (const [offset, limit] of [
      [0, 0],
      [65534, 2],
      [65538, 1],
      [65539, 1],
      [65540, 3],
      [text.length, 5],
      [text.length + 9, 2],
    ]) {
      const page = await files.read(source.evidence_id, { offset, limit });
      assert.equal(page.text, text.slice(offset, offset + limit));
      assert.equal(page.total_code_units, text.length);
      assert.equal(
        page.next_offset,
        offset + limit < text.length ? offset + limit : null,
      );
    }
    assert.equal((await files.read(source.evidence_id)).text, text);
  }));

test("a mutation outside the selected window cannot pass source validation", () =>
  withFiles(async (files) => {
    const spool = await files.spool(32);
    await pipeline(Readable.from(["retained evidence"]), spool);
    await spool.close();
    const source = await retain(files, spool);
    for (const value of [
      "retained evidencE",
      "retained evidenc",
      "retained evidence!",
    ]) {
      await writeFile(spool.path, value);
      await assert.rejects(
        files.read(source.evidence_id, { offset: 0, limit: 1 }),
        { code: "evidence_changed" },
      );
    }
  }));

test("source limits admit the exact boundary and reject before writing an over-budget chunk", () =>
  withFiles(async (files) => {
    const exact = await files.spool(4);
    await pipeline(Readable.from(["abcd"]), exact);
    await exact.close();
    assert.equal(exact.bytes, 4);
    assert.equal(exact.rejected.aborted, false);
    const partial = await files.spool(4);
    await assert.rejects(pipeline(Readable.from(["abc", "de"]), partial), {
      code: "resource_constraint",
    });
    await partial.close();
    assert.equal(partial.bytes, 3);
    assert.equal(partial.failure.details.observed_bytes_at_least, 5);
    assert.equal(partial.rejected.aborted, true);
    assert.equal((await readFile(partial.path)).toString(), "abc");
    await partial.discard();
    await assert.rejects(stat(partial.path), { code: "ENOENT" });
    await assert.rejects(files.spool(0), { code: "capacity" });
  }));

const inventory = (overrides = {}) =>
  JSON.stringify({
    binary: "/input",
    encoding: "all",
    min_length: 5,
    filter: null,
    section: null,
    termination: "any",
    scanned: "sections",
    xrefs: false,
    count: 1,
    strings: [
      {
        address: 4096,
        address_hex: "0x1000",
        text: "hello中文",
        length: 7,
        byte_length: 12,
        nul_terminated: true,
        encoding: "utf8",
        section: ".rodata",
        xrefs_count: 0,
        functions: [],
      },
    ],
    ...overrides,
  });

test("the production string reader validates streamed rows while original Evidence stays byte-exact", () =>
  withFiles(async (files) => {
    for (const valid of [true, false]) {
      const bytes = Buffer.from(inventory(valid ? {} : { count: 2 })),
        reader = new KunaStringInventoryReader();
      const spool = await files.spool(bytes.length, reader);
      await pipeline(
        Readable.from([...bytes].map((byte) => Buffer.from([byte]))),
        spool,
      );
      await spool.close();
      const result = reader.finish("/input");
      assert.equal(result.ok, valid);
      if (result.ok) {
        assert.equal(result.value.items[0].string.nul_terminated, true);
        assert.equal(result.value.items[0].value, "hello中文");
        assert.equal(result.value.sha256, spool.sha256);
      } else assert.match(result.error.message, /count/);
      assert.deepEqual(await readFile(spool.path), bytes);
    }
  }));

test("failed descriptor cleanup retains the same owner and preserves the primary failure", () =>
  withFiles(async (files) => {
    const spool = await files.spool(4),
      handle = spool.file.handle,
      close = handle.close.bind(handle);
    await pipeline(Readable.from(["a"]), spool);
    let attempts = 0;
    handle.close = async () => {
      attempts++;
      if (attempts === 1) throw new Error("injected close failure");
      return close();
    };
    await assert.rejects(
      spool.close(
        Object.assign(new Error("cancelled request"), { code: "cancelled" }),
      ),
      (error) =>
        error.code === "cancelled" &&
        error.details.cleanup_incomplete === "injected close failure",
    );
    assert(handle.fd >= 0);
    await assert.rejects(stat(spool.path), { code: "ENOENT" });
    await files.close();
    assert.equal(handle.fd, -1);
    assert.equal(attempts, 2);
  }));

// This is the existing per-lease retained-source ceiling, independent of paging.
test("the aggregate source budget remains readable at exhaustion without admitting more captures", () =>
  withFiles(async (files) => {
    const chunk = Buffer.alloc(1024 * 1024, 0x61),
      budget = files.remainingBytes;
    const spool = await files.spool(budget + 1);
    await pipeline(
      Readable.from(
        (function* () {
          for (let i = 0; i < budget / chunk.length; i++) yield chunk;
        })(),
      ),
      spool,
    );
    await spool.close();
    const source = await retain(files, spool);
    assert.equal(files.remainingBytes, 0);
    await assert.rejects(files.spool(1), { code: "capacity" });
    const page = await files.read(source.evidence_id, {
      offset: source.bytes - 3,
      limit: 3,
    });
    assert.equal(page.text, "aaa");
    assert.equal(page.next_offset, null);
    assert.equal(page.total_code_units, budget);
  }));

test("content deduplication and partial-capture identity preserve the one source owner", () =>
  withFiles(async (files) => {
    const sources = [];
    for (const complete of [true, true, false]) {
      const spool = await files.spool(8);
      await pipeline(Readable.from(["source"]), spool);
      await spool.close();
      sources.push(
        await files.retain(spool, {
          arguments: ["strings", "/input"],
          input: "/input",
          started: performance.now(),
          complete,
        }),
      );
      if (sources.length === 2)
        await assert.rejects(stat(spool.path), { code: "ENOENT" });
    }
    assert.strictEqual(sources[0], sources[1]);
    assert.notEqual(sources[0].evidence_id, sources[2].evidence_id);
    assert.equal(sources[2].capture_complete, false);
    assert.equal(files.size, 2);
    assert.equal(files.remainingBytes, 64 * 1024 * 1024 - 12);
    await assert.rejects(files.read("foreign", { offset: 0, limit: 1 }), {
      code: "unknown_evidence",
    });
  }));

test("partial writes make progress and a zero-progress write fails explicitly", () =>
  withFiles(async (files) => {
    const spool = await files.spool(8),
      handle = spool.file.handle,
      write = handle.write.bind(handle);
    handle.write = (buffer, offset, length) =>
      write(buffer, offset, Math.min(length, 1));
    await pipeline(Readable.from(["source"]), spool);
    await spool.close();
    assert.equal((await readFile(spool.path)).toString(), "source");
    const stuck = await files.spool(8);
    stuck.file.handle.write = async () => ({ bytesWritten: 0 });
    await assert.rejects(pipeline(Readable.from(["x"]), stuck), {
      code: "source_write_failed",
    });
    await stuck.close();
    await stuck.discard();
  }));

test("external copy failures preserve the retained observation and caller-selected destination", () =>
  withFiles(async (files) => {
    const destination = files.root + "/not-a-directory";
    await writeFile(destination, "owned test file");
    files.captureDirectory = destination;
    const spool = await files.spool(8);
    await pipeline(Readable.from(["source"]), spool);
    await spool.close();
    let id;
    await assert.rejects(retain(files, spool), (error) => {
      id = error.details.evidence_id;
      return (
        error.code === "evidence_copy_failed" &&
        error.details.copy_directory === destination &&
        error.details.source_retained
      );
    });
    assert.equal((await files.read(id, { offset: 0, limit: 3 })).text, "sou");
    assert.equal(files.size, 1);
    await assert.rejects(files.spool(8), { code: "evidence_copy_failed" });
  }));

test("a write failure after an acknowledged prefix retains exact partial Evidence", () =>
  withFiles(async (files) => {
    const spool = await files.spool(8),
      handle = spool.file.handle,
      write = handle.write.bind(handle);
    let calls = 0;
    handle.write = (buffer, offset, length) => {
      if (calls++)
        throw Object.assign(new Error("injected disk failure"), {
          code: "ENOSPC",
        });
      return write(buffer, offset, Math.min(3, length));
    };
    await assert.rejects(pipeline(Readable.from(["abcdef"]), spool), {
      code: "source_write_failed",
    });
    await spool.close();
    assert.equal(spool.bytes, 3);
    const source = await files.retain(spool, {
      arguments: ["strings", "/input"],
      input: "/input",
      started: performance.now(),
      complete: false,
    });
    assert.equal(source.sha256, hash("abc"));
    assert.equal(source.capture_complete, false);
    assert.equal(
      (await files.read(source.evidence_id, { offset: 0, limit: 8 })).text,
      "abc",
    );
  }));
