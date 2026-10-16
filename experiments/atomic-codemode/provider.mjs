// Native protocols stay here. API and execution adapters consume parsed facts.
import { createHash, randomUUID } from "node:crypto";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseBinaryTarget } from "../../dist/application/BinaryTargetResolver.js";
import { inspectNativeInstallation } from "./native-installation.mjs";
import { KunaTargetCommands } from "../../dist/kuna/KunaTargetCommands.js";
import { referenceReader } from "./reference-reads.mjs";
import { PrivateRuntimeRoot } from "../../dist/process/PrivateRuntimeRoot.js";
import { parseNativeIR } from "./native-ir.mjs";
import { NativeEvidenceReads } from "./native-evidence-reads.mjs";
import { NativeCatalogReads } from "./native-catalog-reads.mjs";
import { DEFAULT_NATIVE_OPERATION_FIELDS } from "./native-operation-views.mjs";
import { FactFailure, requireResult } from "./fact-error.mjs";
import { windowReaders } from "./window-readers.mjs";
import { NATIVE_OUTPUT_BYTES } from "./limits.mjs";
import { sourceSummary, projectFact, readFactBatch } from "./fact-reads.mjs";
import {
  parseKunaSsaDump,
  backwardSlice,
} from "../atomic-re-tools/kuna-ssa.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const missingNativeFacet = () => ({
  availability: "unavailable",
  error: {
    code: "capability_unavailable",
    message: "Requires the pinned native exporter",
  },
});
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
  #catalogs = new NativeCatalogReads(
    (...args) => this.#native(...args),
    (id) => this.#sourceText(id),
    () => this.#requireNativeIR(),
  );
  #captureDirectory;
  #evidence = new NativeEvidenceReads(async (id) => ({
    text: await this.#sourceText(id),
    source: this.#sources.get(id).source,
  }));
  #nativeIR = false;
  context;
  static async open(path, { environment = process.env, fileResources }) {
    const owner = new KunaFactOwner();
    owner.#target = requireResult(
      await parseBinaryTarget(path),
      "invalid_target",
    );
    owner.#installation = await inspectNativeInstallation(
      environment,
      fileResources,
      owner.#lifetime.signal,
    );
    const nativeIRHash = environment.REA_ATOMIC_NATIVE_IR_ENGINE_SHA256;
    if (
      nativeIRHash !== undefined &&
      (!/^[0-9a-f]{64}$/u.test(nativeIRHash) ||
        nativeIRHash !== owner.#installation.sha256)
    )
      throw new FactFailure(
        "engine_profile_mismatch",
        "Native IR requires the exact caller-pinned experimental engine SHA-256",
      );
    owner.#nativeIR = nativeIRHash !== undefined;
    if (!owner.#nativeIR && owner.#installation.version !== "1.833")
      throw new FactFailure(
        "unsupported_version",
        "SSA diagnostic decoder is verified only for Kuna 1.833",
      );
    owner.#root = await PrivateRuntimeRoot.create({
      prefix: "rea-atomic-facts-",
    });
    if (owner.#nativeIR)
      owner.#installation = {
        ...owner.#installation,
        configuration: {
          ...owner.#installation.configuration,
          cacheRoot: join(owner.#root.path, "engine-cache"),
        },
      };
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
      analysis_model: owner.#nativeIR
        ? "experimental-native-ir-v3"
        : "diagnostic-ssa-1.833",
      profile: owner.#nativeIR
        ? "pinned engine with embedded specs; fresh private engine cache per lease; byte/storage metadata reads suppress global discovery; other native CLI defaults; no annotations"
        : "byte reads suppress global discovery; other native CLI defaults, no annotations; external spec cache freshness is not fingerprinted",
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
        outputBytes: NATIVE_OUTPUT_BYTES,
        timeoutMs: 120000,
        signal: AbortSignal.any([signal, this.#lifetime.signal]),
      }),
    );
    const actualArguments = arguments_(snapshot.input);
    const id = `ev_${sha256(JSON.stringify([this.context.lease, actualArguments, sha256(snapshot.stdout.text)]))}`;
    const bytes = Buffer.byteLength(snapshot.stdout.text);
    if (this.#retainedBytes + bytes > 64 * 1024 * 1024)
      throw new FactFailure(
        "capacity",
        "64 MiB retained-source budget reached; close and reopen",
      );
    const file = join(this.#root.path, id);
    await writeFile(file, snapshot.stdout.text, { flag: "wx" });
    const source = Object.freeze({
      evidence_id: id,
      sha256: sha256(snapshot.stdout.text),
      bytes: Buffer.byteLength(snapshot.stdout.text),
      arguments: Object.freeze(actualArguments),
      display_arguments: Object.freeze(
        actualArguments.map((s) =>
          s === snapshot.input ? this.#target.path : s,
        ),
      ),
      elapsed_ms: performance.now() - start,
    });
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
    return this.#catalogs.strings(input, signal);
  }
  async functions(input, signal) {
    return this.#catalogs.functions(input, signal);
  }
  async spaces(input, signal) {
    return this.#catalogs.spaces(input, signal);
  }
  async registers(input, signal) {
    return this.#catalogs.registers(input, signal);
  }
  async references(input, signal) {
    return readFactBatch(
      input.addresses.map((address) => referenceReader.query(input, address)),
      (query) =>
        this.#native(
          referenceReader.key(query),
          (path) => referenceReader.arguments(path, query),
          signal,
        ),
      async (capture, query) =>
        referenceReader.read(
          await this.#sourceText(capture.source.evidence_id),
          capture.input,
          query,
          input,
        ),
    );
  }
  async snapshot(input, signal) {
    const capture = await this.#native(
      `ssa:${input.entry}`,
      (path) => [
        "decompile",
        path,
        input.entry,
        "--addr",
        ...(this.#nativeIR
          ? [
              "--json",
              "--atomic-facts",
              "--atomic-output-bytes",
              String(NATIVE_OUTPUT_BYTES),
            ]
          : ["--raw"]),
        "--max-fn-memory",
        "1024",
      ],
      signal,
    );
    const id = `snap_${sha256(this.context.lease + input.entry + capture.source.sha256)}`;
    if (!this.#snapshots.has(id))
      this.#snapshots.set(id, {
        entry: input.entry,
        input: capture.input,
        evidence_id: capture.source.evidence_id,
      });
    const parsed = await this.#load(id);
    if (!this.#nativeIR && parsed.block(0).origin_start !== input.entry)
      throw new FactFailure(
        "subject_mismatch",
        "Native SSA entry does not match the requested function entry",
      );
    return {
      snapshot: id,
      source: sourceSummary(capture.source),
      entry: input.entry,
      coverage: parsed.coverage,
      facets: parsed.facets ?? {
        code: { availability: "available" },
        recovered_ir: { availability: "available", coverage: "partial" },
        operations: {
          availability: "available",
          scope: "diagnostic-printed-SSA",
        },
        parameters: missingNativeFacet(),
        calls: missingNativeFacet(),
        values: missingNativeFacet(),
      },
    };
  }
  async instructions(input, signal) {
    return this.#readWindows("instructions", input, signal);
  }
  async bytes(input, signal) {
    return this.#readWindows("bytes", input, signal);
  }
  async #readWindows(name, input, signal) {
    const reader = windowReaders[name];
    return readFactBatch(
      input.windows,
      (request) =>
        this.#native(
          `${name}:${reader.key(request)}`,
          (path) => reader.arguments(path, request),
          signal,
        ),
      async (capture, request) =>
        reader.parse(
          await this.#sourceText(capture.source.evidence_id),
          capture.input,
          request,
          input.fields,
        ),
    );
  }
  async #load(id) {
    const descriptor = this.#snapshots.get(id);
    if (!descriptor)
      throw new FactFailure(
        "unknown_snapshot",
        "Snapshot is not owned by the current target lease",
      );
    if (!this.#loaded.has(id)) {
      const { source } = this.#sources.get(descriptor.evidence_id);
      if (
        source.bytes > (this.#nativeIR ? NATIVE_OUTPUT_BYTES : 2 * 1024 * 1024)
      )
        throw new FactFailure(
          "capacity",
          "Source exceeds this format's indexing budget; at most two resident models are retained; full source remains readable",
          { evidence_id: descriptor.evidence_id },
        );
      const text = await this.#sourceText(descriptor.evidence_id);
      let parsed;
      try {
        parsed = this.#nativeIR
          ? parseNativeIR(text, descriptor.entry, descriptor.input)
          : parseKunaSsaDump(text);
      } catch (error) {
        throw new FactFailure(
          error.code ?? "invalid_provider_output",
          error.message.slice(0, 1024),
          {
            ...error.details,
            evidence_id: descriptor.evidence_id,
            source_retained: true,
          },
        );
      }
      if (this.#loaded.size >= 2)
        this.#loaded.delete(this.#loaded.keys().next().value);
      this.#loaded.set(id, parsed);
    }
    return this.#loaded.get(id);
  }
  async #query(input, read) {
    const model = await this.#load(input.snapshot);
    const evidence_id = this.#snapshots.get(input.snapshot).evidence_id;
    try {
      return { ...read(model), evidence_id };
    } catch (error) {
      throw new FactFailure(error.code ?? "analysis_failed", error.message, {
        ...error.details,
        evidence_id,
        source_retained: true,
      });
    }
  }
  async operations(input) {
    return this.#query(input, (model) => ({
      ...model.select(input),
      coverage: model.coverage,
    }));
  }
  async relations(input) {
    if (["controllers", "operands", "value_uses", "cases"].includes(input.kind))
      this.#requireNativeIR(input.snapshot);
    return this.#query(input, (model) => ({
      coverage: model.coverage,
      ...model.edges(input),
    }));
  }
  async slice(input) {
    return this.#query(input, (model) => {
      const result = model.slice
        ? model.slice(input)
        : backwardSlice(model, input.seeds, {
            maxOperations: input.max_operations,
            stopAt: input.stop_at,
            stopKinds: input.stop_kinds,
          });
      return {
        ...result,
        operations: result.operations.map((row) =>
          projectFact(
            row,
            input.fields ??
              (this.#nativeIR ? DEFAULT_NATIVE_OPERATION_FIELDS : undefined),
            ["id", "origin_address", "block", "source_line", "is_dead"],
          ),
        ),
      };
    });
  }
  #requireNativeIR(snapshot) {
    if (!this.#nativeIR)
      throw new FactFailure(
        "capability_unavailable",
        "This relation requires the pinned experimental native IR engine; the diagnostic SSA format does not contain it",
        this.#snapshots.has(snapshot)
          ? { evidence_id: this.#snapshots.get(snapshot).evidence_id }
          : {},
      );
  }
  #queryNative(input, read) {
    this.#requireNativeIR(input.snapshot);
    return this.#query(input, read);
  }
  async values(input) {
    return this.#queryNative(input, (model) => model.values(input));
  }
  async calls(input) {
    return this.#queryNative(input, (model) => model.calls(input));
  }
  async switches(input) {
    return this.#queryNative(input, (model) => model.switches(input));
  }
  async blocks(input) {
    return this.#queryNative(input, (model) => ({
      ...model.blocks(input),
      coverage: model.coverage,
    }));
  }
  async path(input) {
    return this.#queryNative(input, (model) => ({
      ...model.path(input),
      coverage: model.coverage,
    }));
  }
  async parameters(input) {
    return this.#queryNative(input, (model) => model.parameters(input));
  }
  async code(input) {
    const descriptor = this.#snapshots.get(input.snapshot);
    if (!descriptor)
      throw new FactFailure(
        "unknown_snapshot",
        "Snapshot is not owned by the current lease",
      );
    const model = this.#nativeIR ? await this.#load(input.snapshot) : null;
    const code =
      model?.code ??
      (await this.#sourceText(descriptor.evidence_id)).split(
        "\n0\nBasic Block",
        1,
      )[0];
    const lines = code.split("\n");
    return {
      evidence_id: descriptor.evidence_id,
      start_line: input.offset + 1,
      language: model?.language ?? null,
      text: lines.slice(input.offset, input.offset + input.limit).join("\n"),
      total_lines: lines.length,
      next_offset:
        input.offset + input.limit < lines.length
          ? input.offset + input.limit
          : null,
      coverage: {
        authority: "native reconstructed code",
        scope: "selected display lines",
      },
    };
  }
  async evidence(input) {
    return this.#evidence.read(input);
  }
  async close() {
    this.#lifetime.abort();
    // A failed Result retains native cleanup owners; leave this lease retryable.
    requireResult(await this.#commands.close());
    await this.#root.close();
    this.#loaded.clear();
    this.#sources.clear();
    this.#work.clear();
    this.#snapshots.clear();
    this.#catalogs.clear();
    this.#evidence.clear();
  }
  cancel() {
    this.#lifetime.abort();
  }
}
