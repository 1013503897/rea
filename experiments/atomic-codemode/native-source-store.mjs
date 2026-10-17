// Raw native Evidence has one file/hash owner; reads verify before returning facts.
import { createHash, randomUUID } from "node:crypto";
import { open, rm, writeFile, copyFile, mkdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { Writable } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import { ArtifactResourceScope } from "../../dist/artifacts/ArtifactResourceScope.js";
import { OwnedFileHandle } from "../../dist/filesystem/OwnedFileHandle.js";
import { FactFailure, projectFactFailure } from "./fact-error.mjs";
import { MAX_RETAINED_SOURCE_BYTES, MAX_NATIVE_SOURCES } from "./limits.mjs";

const cleanupFailure = (cause, primary) => {
  const failure = projectFactFailure(
    primary === undefined ? cause : primary,
    primary === undefined ? "cleanup_incomplete" : "analysis_failed",
  );
  return new FactFailure(failure.code, failure.message, {
    ...failure.details,
    cleanup_incomplete: String(cause?.message ?? cause),
  });
};

export class NativeSourceStore {
  #records = new Map();
  #retainedBytes = 0;
  #copyFailure;
  #resources = new ArtifactResourceScope();
  constructor({ root, context, captureDirectory }) {
    Object.assign(this, { root, context, captureDirectory });
  }
  get size() {
    return this.#records.size;
  }
  get remainingBytes() {
    return MAX_RETAINED_SOURCE_BYTES - this.#retainedBytes;
  }
  source(id) {
    return this.#record(id).source;
  }
  #record(id) {
    const record = this.#records.get(id);
    if (!record)
      throw new FactFailure(
        "unknown_evidence",
        "Evidence is not owned by this target lease",
      );
    return record;
  }
  async retain(
    spool,
    { arguments: actualArguments, input, started, complete },
  ) {
    const size = (await stat(spool.path)).size;
    if (size !== spool.bytes) {
      await spool.discard();
      throw new FactFailure(
        "invalid_source",
        "Native source size disagrees with acknowledged writes",
        {
          expected_bytes: spool.bytes,
          actual_bytes: size,
          source_retained: false,
        },
      );
    }
    const id = `ev_${sha256(JSON.stringify([this.context.lease, actualArguments, spool.sha256, complete]))}`;
    if (this.#records.has(id)) {
      await spool.discard();
      return this.#records.get(id).source;
    }
    const source = Object.freeze({
      evidence_id: id,
      sha256: spool.sha256,
      bytes: spool.bytes,
      capture_complete: complete,
      arguments: Object.freeze(actualArguments),
      display_arguments: Object.freeze(
        actualArguments.map((s) => (s === input ? this.context.path : s)),
      ),
      elapsed_ms: performance.now() - started,
    });
    this.#records.set(id, { source, file: spool.path });
    this.#retainedBytes += spool.bytes;
    try {
      if (this.captureDirectory) {
        await mkdir(this.captureDirectory, { recursive: true, mode: 0o700 });
        await copyFile(
          spool.path,
          join(this.captureDirectory, `${id}.txt`),
          constants.COPYFILE_EXCL,
        );
        await writeFile(
          join(this.captureDirectory, `${id}.json`),
          JSON.stringify({ context: this.context, source }),
          { flag: "wx", mode: 0o600 },
        );
      }
    } catch (cause) {
      this.#copyFailure = new FactFailure(
        "evidence_copy_failed",
        "Native Evidence is retained but the requested external copy failed",
        {
          evidence_id: id,
          source_retained: true,
          copy_directory: this.captureDirectory,
          reason: String(cause?.message ?? cause),
          filesystem_code: cause?.code ?? null,
          copy_retry: "new_target_lease",
        },
      );
      throw this.#copyFailure;
    }
    return source;
  }

  async #open(path, flags) {
    await this.#resources.retryCleanup();
    const handle = new OwnedFileHandle(await open(path, flags, 0o600));
    const owner = { kind: "file-handle", resource: path, handle };
    return {
      handle: handle.handle,
      close: async (primary) => {
        const result = await this.#resources.release(owner);
        if (result.kind === "failed")
          throw cleanupFailure(result.cause, primary);
      },
    };
  }
  async spool(limit, reader) {
    if (this.#copyFailure) throw this.#copyFailure;
    if (this.size >= MAX_NATIVE_SOURCES)
      throw new FactFailure(
        "capacity",
        "Session source capacity reached; close and reopen the target",
      );
    limit = Math.min(limit, this.remainingBytes);
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new FactFailure("capacity", "Retained-source budget is exhausted");
    const path = join(this.root, `source-${randomUUID()}`);
    return new NativeSourceSpool({
      path,
      file: await this.#open(path, "wx"),
      limit,
      reader,
      discard: async () => {
        const result = await this.#resources.release({
          kind: "lease",
          resource: path,
          lease: { release: () => rm(path, { force: true }) },
        });
        if (result.kind === "failed") throw cleanupFailure(result.cause);
      },
    });
  }
  async read(id, window) {
    const record = this.#record(id);
    const file = await this.#open(record.file, "r");
    let primary;
    try {
      return await readVerified(file.handle, record.source, window);
    } catch (error) {
      primary = error;
      throw error;
    } finally {
      await file.close(primary);
    }
  }
  async close() {
    await this.#resources.close();
  }
}

class NativeSourceSpool extends Writable {
  #hash = createHash("sha256");
  #digest;
  #pending = Promise.resolve();
  #rejected = new AbortController();
  bytes = 0;
  failure;
  constructor({ path, file, limit, reader, discard }) {
    super();
    Object.assign(this, { path, file, limit, reader, discard });
    // The command owns stream failure reporting; never leave a rejected sink unobserved.
    reader?.on("error", () => {});
  }
  get rejected() {
    return this.#rejected.signal;
  }
  get sha256() {
    return (this.#digest ??= this.#hash.digest("hex"));
  }
  _write(chunk, _encoding, callback) {
    this.#pending = this.#write(chunk);
    this.#pending.then(
      () => callback(),
      (error) => {
        this.failure =
          error instanceof FactFailure
            ? error
            : new FactFailure(
                "source_write_failed",
                "Native Evidence could not be written",
                {
                  reason: String(error?.message ?? error),
                  filesystem_code: error?.code ?? null,
                },
              );
        this.#rejected.abort(this.failure);
        callback(this.failure);
      },
    );
  }
  async #write(chunk) {
    if (this.bytes + chunk.byteLength > this.limit)
      throw new FactFailure(
        "resource_constraint",
        "Native Evidence exceeds its retained-source budget",
        {
          scope: "native_source",
          limit_bytes: this.limit,
          observed_bytes_at_least: this.bytes + chunk.byteLength,
        },
      );
    for (let offset = 0; offset < chunk.byteLength;) {
      const written = await this.file.handle.write(
        chunk,
        offset,
        chunk.byteLength - offset,
      );
      if (written.bytesWritten === 0)
        throw new FactFailure(
          "source_write_failed",
          "Native source write made no progress",
        );
      this.#hash.update(chunk.subarray(offset, offset + written.bytesWritten));
      this.bytes += written.bytesWritten;
      offset += written.bytesWritten;
    }
    if (this.reader)
      await new Promise((resolve, reject) =>
        this.reader.write(chunk, (error) =>
          error ? reject(error) : resolve(),
        ),
      );
  }
  _final(callback) {
    if (this.reader) this.reader.end(callback);
    else callback();
  }
  _destroy(error, callback) {
    if (!this.reader?.writableFinished) this.reader?.destroy();
    this.#pending.then(
      () => callback(error),
      () => callback(error),
    );
  }
  async close(primary) {
    if (!this.destroyed) this.destroy();
    await this.#pending.catch(() => {});
    try {
      await this.file.close(primary);
    } catch (error) {
      // Unpublished failed captures must not accumulate outside the source ledger.
      try {
        await this.discard();
      } catch (cause) {
        throw cleanupFailure(cause, error);
      }
      throw error;
    }
  }
}

async function readVerified(handle, source, window) {
  const hash = createHash("sha256"),
    decoder = new StringDecoder("utf8"),
    chunks = [];
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let bytes = 0,
    units = 0;
  const collect = (text) => {
    if (window) {
      const start = Math.max(0, window.offset - units);
      const end = Math.min(text.length, window.offset + window.limit - units);
      if (end > start) chunks.push(text.slice(start, end));
    } else chunks.push(text);
    units += text.length;
  };
  while (true) {
    const { bytesRead } = await handle.read(buffer, 0, buffer.length);
    if (!bytesRead) break;
    bytes += bytesRead;
    if (bytes > source.bytes) throw changed();
    const chunk = buffer.subarray(0, bytesRead);
    hash.update(chunk);
    collect(decoder.write(chunk));
  }
  collect(decoder.end());
  if (bytes !== source.bytes || hash.digest("hex") !== source.sha256)
    throw changed();
  return {
    source,
    text: chunks.join(""),
    total_code_units: units,
    next_offset:
      window && window.offset + window.limit < units
        ? window.offset + window.limit
        : null,
  };
}
const changed = () =>
  new FactFailure("evidence_changed", "Retained source changed");

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
