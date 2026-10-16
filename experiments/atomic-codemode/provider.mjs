// Native protocols stay here. API and execution adapters consume parsed facts.
import { createHash, randomUUID } from "node:crypto";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseBinaryTarget } from "../../dist/application/BinaryTargetResolver.js";
import { inspectKunaInstallation } from "../../dist/kuna/KunaInstallation.js";
import { KunaTargetCommands } from "../../dist/kuna/KunaTargetCommands.js";
import { parseKunaStringInventory } from "../../dist/kuna/KunaStringInventory.js";
import { parseKunaIncomingReferenceFacts } from "../../dist/kuna/KunaReferenceFiles.js";
import { PrivateRuntimeRoot } from "../../dist/process/PrivateRuntimeRoot.js";
import {
  parseKunaSsaDump,
  backwardSlice,
} from "../atomic-re-tools/kuna-ssa.mjs";

export class FactFailure extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
const requireResult = (result, code = "provider_failure") => {
  if (!result.ok)
    throw new FactFailure(code, String(result.error?.message ?? result.error));
  return result.value;
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export class KunaFactOwner {
  #lifetime = new AbortController();
  #sources = new Map();
  #snapshots = new Map();
  #work = new Map();
  #loaded = new Map();
  #root;
  #commands;
  #target;
  #installation;
  #retainedBytes = 0;
  #strings;
  #captureDirectory;
  context;
  static async open(path, environment = process.env) {
    const owner = new KunaFactOwner();
    owner.#target = requireResult(
      await parseBinaryTarget(path),
      "invalid_target",
    );
    owner.#installation = requireResult(
      await inspectKunaInstallation(environment),
      "provider_unavailable",
    );
    if (owner.#installation.version !== "1.833")
      throw new FactFailure(
        "unsupported_version",
        "SSA diagnostic decoder is verified only for Kuna 1.833",
      );
    owner.#root = await PrivateRuntimeRoot.create({
      prefix: "rea-atomic-facts-",
    });
    owner.#commands = new KunaTargetCommands(owner.#target, {
      signal: owner.#lifetime.signal,
    });
    owner.#captureDirectory = environment.REA_ATOMIC_EVIDENCE_DIR;
    owner.context = Object.freeze({
      lease: randomUUID(),
      artifact_sha256: owner.#target.sha256,
      path: owner.#target.path,
      selected_path: path,
      provider: "kuna",
      engine_sha256: owner.#installation.sha256,
      engine_version: owner.#installation.version,
      address_space: "native-default",
      profile:
        "native CLI defaults, no annotations; per-command arguments retained",
    });
    return owner;
  }
  async #native(key, arguments_, signal) {
    if (this.#work.has(key)) return this.#work.get(key);
    if (this.#sources.size >= 128)
      throw new FactFailure(
        "capacity",
        "Session source capacity reached; close and reopen the target",
      );
    const work = this.#capture(arguments_, signal);
    this.#work.set(key, work);
    try {
      return await work;
    } catch (error) {
      this.#work.delete(key);
      throw error;
    }
  }
  async #capture(arguments_, signal) {
    const start = performance.now();
    const snapshot = requireResult(
      await this.#commands.run({
        installation: this.#installation,
        operation: "experiment:atomic-facts",
        arguments: arguments_,
        outputBytes: 8 * 1024 * 1024,
        timeoutMs: 120000,
        signal: AbortSignal.any([signal, this.#lifetime.signal]),
      }),
    );
    const id = `ev_${sha256(this.context.lease + snapshot.stdout.text)}`;
    const bytes = Buffer.byteLength(snapshot.stdout.text);
    if (this.#retainedBytes + bytes > 64 * 1024 * 1024)
      throw new FactFailure(
        "capacity",
        "64 MiB retained-source budget reached; close and reopen",
      );
    const file = join(this.#root.path, id);
    await writeFile(file, snapshot.stdout.text, { flag: "wx" });
    const source = {
      evidence_id: id,
      sha256: sha256(snapshot.stdout.text),
      bytes: Buffer.byteLength(snapshot.stdout.text),
      arguments: arguments_(snapshot.input).map((s) =>
        s === snapshot.input ? this.#target.path : s,
      ),
      elapsed_ms: performance.now() - start,
    };
    this.#sources.set(id, { source, file });
    this.#retainedBytes += bytes;
    if (this.#captureDirectory) {
      await mkdir(this.#captureDirectory, { recursive: true, mode: 0o700 });
      await writeFile(
        join(this.#captureDirectory, `${id}.txt`),
        snapshot.stdout.text,
        { flag: "wx", mode: 0o600 },
      );
      await writeFile(
        join(this.#captureDirectory, `${id}.json`),
        JSON.stringify({ context: this.context, source }),
        { flag: "wx", mode: 0o600 },
      );
    }
    return { source, input: snapshot.input };
  }
  async #sourceText(id) {
    const record = this.#sources.get(id);
    if (!record)
      throw new FactFailure(
        "unknown_evidence",
        "Evidence is not owned by this target lease",
      );
    const text = await readFile(record.file, "utf8");
    if (sha256(text) !== record.source.sha256)
      throw new FactFailure("evidence_changed", "Retained source changed");
    return text;
  }
  async strings(input, signal) {
    const capture = await this.#native(
      "strings",
      (path) => [
        "strings",
        path,
        "--json",
        "--encoding",
        "all",
        "--min-length",
        "5",
        "--termination",
        "any",
        "--no-xrefs",
      ],
      signal,
    );
    this.#strings ??= requireResult(
      parseKunaStringInventory(
        await this.#sourceText(capture.source.evidence_id),
        capture.input,
      ),
      "invalid_provider_output",
    );
    const inventory = this.#strings;
    const rows = inventory.items.filter((row) =>
      row.value.includes(input.query),
    );
    return {
      source: capture.source,
      items: rows.slice(input.offset, input.offset + input.limit),
      total: rows.length,
      next_offset:
        input.offset + input.limit < rows.length
          ? input.offset + input.limit
          : null,
      coverage: {
        scope: "native string inventory, minimum 5",
        artifact_discovery: "unknown",
        reference_attribution: "not-computed",
      },
    };
  }
  async references(input, signal) {
    const results = [];
    for (const address of input.addresses) {
      try {
        const capture = await this.#native(
          `xref:${address}`,
          (path) => ["xrefs", path, "--to", address, "--json"],
          signal,
        );
        const parsed = requireResult(
          parseKunaIncomingReferenceFacts(
            await this.#sourceText(capture.source.evidence_id),
            capture.input,
            address,
          ),
          "invalid_provider_output",
        );
        results.push({
          ok: true,
          address,
          source: capture.source,
          items: parsed.facts.slice(input.offset, input.offset + input.limit),
          total: parsed.facts.length,
          next_offset:
            input.offset + input.limit < parsed.facts.length
              ? input.offset + input.limit
              : null,
          coverage: {
            scope: "exact target address; not an object extent",
            discovery: "unknown",
          },
        });
      } catch (error) {
        results.push({
          ok: false,
          address,
          error: {
            code: error.code ?? "provider_failure",
            message: error.message,
          },
        });
      }
    }
    return { results };
  }
  async snapshot(input, signal) {
    const capture = await this.#native(
      `ssa:${input.entry}`,
      (path) => [
        "decompile",
        path,
        input.entry,
        "--addr",
        "--raw",
        "--max-fn-memory",
        "1024",
      ],
      signal,
    );
    const id = `snap_${sha256(this.context.lease + input.entry + capture.source.sha256)}`;
    if (!this.#snapshots.has(id))
      this.#snapshots.set(id, {
        entry: input.entry,
        evidence_id: capture.source.evidence_id,
      });
    const parsed = await this.#load(id);
    if (parsed.block(0).start !== input.entry)
      throw new FactFailure(
        "subject_mismatch",
        "Native SSA entry does not match the requested function entry",
      );
    return {
      snapshot: id,
      source: capture.source,
      entry: input.entry,
      coverage: parsed.coverage,
    };
  }
  async #load(id) {
    const descriptor = this.#snapshots.get(id);
    if (!descriptor)
      throw new FactFailure(
        "unknown_snapshot",
        "Snapshot is not owned by the current target lease",
      );
    if (!this.#loaded.has(id)) {
      const { file, source } = this.#sources.get(descriptor.evidence_id);
      if (source.bytes > 2 * 1024 * 1024)
        throw new FactFailure(
          "capacity",
          "SSA indexing budget is 2 MiB per source with two resident models; full source remains readable",
          { evidence_id: descriptor.evidence_id },
        );
      const text = await readFile(file, "utf8");
      if (sha256(text) !== source.sha256)
        throw new FactFailure(
          "evidence_changed",
          "Retained native source changed",
        );
      const parsed = parseKunaSsaDump(text);
      if (this.#loaded.size >= 2)
        this.#loaded.delete(this.#loaded.keys().next().value);
      this.#loaded.set(id, parsed);
    }
    return this.#loaded.get(id);
  }
  async operations(input) {
    const model = await this.#load(input.snapshot);
    return {
      ...model.select(input),
      evidence_id: this.#snapshots.get(input.snapshot).evidence_id,
      coverage: model.coverage,
    };
  }
  async relations(input) {
    const model = await this.#load(input.snapshot);
    return {
      ...model.edges(input),
      evidence_id: this.#snapshots.get(input.snapshot).evidence_id,
      coverage: model.coverage,
    };
  }
  async slice(input) {
    const model = await this.#load(input.snapshot);
    return {
      ...backwardSlice(model, input.seeds, {
        maxOperations: input.max_operations,
        stopAt: input.stop_at,
        stopKinds: input.stop_kinds,
      }),
      evidence_id: this.#snapshots.get(input.snapshot).evidence_id,
    };
  }
  async code(input) {
    const descriptor = this.#snapshots.get(input.snapshot);
    if (!descriptor)
      throw new FactFailure(
        "unknown_snapshot",
        "Snapshot is not owned by the current lease",
      );
    const { file } = this.#sources.get(descriptor.evidence_id);
    const text = await readFile(file, "utf8");
    const code = text.split("\n0\nBasic Block", 1)[0];
    const lines = code.split("\n");
    return {
      evidence_id: descriptor.evidence_id,
      start_line: input.offset + 1,
      text: lines.slice(input.offset, input.offset + input.limit).join("\n"),
      total_lines: lines.length,
      next_offset:
        input.offset + input.limit < lines.length
          ? input.offset + input.limit
          : null,
      coverage: {
        authority: "reconstructed C, not original source",
        scope: "selected display lines",
      },
    };
  }
  async evidence(input) {
    const record = this.#sources.get(input.evidence_id);
    if (!record)
      throw new FactFailure(
        "unknown_evidence",
        "Evidence is not retained by the current lease",
      );
    const text = await readFile(record.file, "utf8");
    if (sha256(text) !== record.source.sha256)
      throw new FactFailure("evidence_changed", "Retained evidence changed");
    return {
      source: record.source,
      text: text.slice(input.offset, input.offset + input.limit),
      total_code_units: text.length,
      next_offset:
        input.offset + input.limit < text.length
          ? input.offset + input.limit
          : null,
    };
  }
  async close() {
    this.#lifetime.abort();
    await this.#commands.close();
    await this.#root.close();
    this.#loaded.clear();
    this.#sources.clear();
    this.#work.clear();
    this.#snapshots.clear();
  }
  cancel() {
    this.#lifetime.abort();
  }
}
