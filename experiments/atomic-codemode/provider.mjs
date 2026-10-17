// Native protocols stay here. API and execution adapters consume parsed facts.
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { NativeSourceStore } from "./native-source-store.mjs";
import { NativeCaptureCache } from "./native-capture-cache.mjs";
import { NativeStringQueryReads } from "./native-string-query.mjs";
import { NativeByteBatchReads } from "./native-byte-batch.mjs";
import { parseBinaryTarget } from "../../dist/application/BinaryTargetResolver.js";
import { inspectNativeInstallation } from "./native-installation.mjs";
import { KunaTargetCommands } from "../../dist/kuna/KunaTargetCommands.js";
import { NativeReferenceReads } from "./reference-reads.mjs";
import { PrivateRuntimeRoot } from "../../dist/process/PrivateRuntimeRoot.js";
import { parseNativeIR } from "./native-ir.mjs";
import { NativeEvidenceReads } from "./native-evidence-reads.mjs";
import { NativeCatalogReads } from "./native-catalog-reads.mjs";
import { DEFAULT_NATIVE_OPERATION_FIELDS } from "./native-operation-views.mjs";
import {
  FactFailure,
  requireResult,
  projectFactFailure,
} from "./fact-error.mjs";
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
  #snapshots = new Map();
  #work = new NativeCaptureCache();
  #loaded = new Map();
  #root;
  #sourceFiles;
  #stringQueries;
  #byteBatches;
  #commands;
  #target;
  #installation;
  #catalogs = new NativeCatalogReads(
    (...args) => this.#native(...args),
    (id) => this.#sourceText(id),
    () => this.#requireNativeIR(),
  );
  #references = new NativeReferenceReads(
    (...args) => this.#native(...args),
    (id) => this.#sourceText(id),
    () => this.#requireNativeIR(),
  );
  #evidence = new NativeEvidenceReads({
    readText: async (id) => this.#sourceFiles.read(id),
    readWindow: async (id, window) => this.#sourceFiles.read(id, window),
  });
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
    const stringMode = environment.REA_ATOMIC_NATIVE_STRING_QUERY;
    if (stringMode !== undefined && stringMode !== "0" && stringMode !== "1")
      throw new FactFailure(
        "invalid_configuration",
        "REA_ATOMIC_NATIVE_STRING_QUERY must be 0 or 1",
      );
    if (stringMode === "1") {
      if (
        !owner.#nativeIR ||
        process.platform !== "linux" ||
        process.arch !== "x64"
      )
        throw new FactFailure(
          "capability_unavailable",
          "Native string query experiment requires the pinned engine on Linux x86-64",
        );
      owner.#stringQueries = new NativeStringQueryReads((...args) =>
        owner.#native(...args),
      );
    }

    const byteMode = environment.REA_ATOMIC_NATIVE_BYTE_BATCH;
    if (byteMode !== undefined && byteMode !== "0" && byteMode !== "1")
      throw new FactFailure(
        "invalid_configuration",
        "REA_ATOMIC_NATIVE_BYTE_BATCH must be 0 or 1",
      );
    if (byteMode === "1") {
      if (!owner.#nativeIR)
        throw new FactFailure(
          "capability_unavailable",
          "Native byte batch experiment requires the pinned engine",
        );
      owner.#byteBatches = new NativeByteBatchReads(
        (...args) => owner.#native(...args),
        (id) => owner.#sourceText(id),
      );
    }
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
    owner.context = Object.freeze({
      lease: randomUUID(),
      artifact_sha256: owner.#target.sha256,
      path: owner.#target.path,
      selected_path: path,
      provider: "kuna",
      engine_sha256: owner.#installation.sha256,
      engine_version: owner.#installation.version,
      address_space: "native-default",
      string_acquisition: owner.#stringQueries
        ? "native-query-v1"
        : "retained-inventory",
      byte_acquisition: owner.#byteBatches
        ? "native-batch-v1"
        : "native-single-window",
      analysis_model: owner.#nativeIR
        ? "experimental-native-ir-v3"
        : "diagnostic-ssa-1.833",
      profile: owner.#nativeIR
        ? "pinned engine with embedded specs; fresh private engine cache per lease; byte/storage metadata reads suppress global discovery; other native CLI defaults; no annotations"
        : "byte reads suppress global discovery; other native CLI defaults, no annotations; external spec cache freshness is not fingerprinted",
    });
    owner.#sourceFiles = new NativeSourceStore({
      root: owner.#root.path,
      context: owner.context,
      captureDirectory: environment.REA_ATOMIC_EVIDENCE_DIR,
    });
    return owner;
  }
  #native(key, arguments_, signal, readerFactory) {
    return this.#work.read(key, () =>
      this.#capture(arguments_, signal, readerFactory),
    );
  }
  async #capture(arguments_, signal, readerFactory) {
    const start = performance.now();
    const remaining = this.#sourceFiles.remainingBytes;
    const outputBytes = readerFactory
      ? remaining
      : Math.min(remaining, NATIVE_OUTPUT_BYTES);
    const reader = readerFactory?.(outputBytes);
    const spool = await this.#sourceFiles.spool(outputBytes, reader);
    let snapshot, actualArguments, captureInput, primary;
    try {
      snapshot = requireResult(
        await this.#commands.run({
          installation: this.#installation,
          operation: "experiment:atomic-facts",
          arguments: (input) => {
            captureInput = input;
            return (actualArguments = arguments_(input, spool.limit));
          },
          outputBytes: NATIVE_OUTPUT_BYTES,
          stdout: spool,
          timeoutMs: 120000,
          signal: AbortSignal.any([
            signal,
            this.#lifetime.signal,
            spool.rejected,
          ]),
        }),
      );
    } catch (error) {
      const failure = projectFactFailure(error);
      primary = new FactFailure(failure.code, failure.message, failure.details);
      if (spool.failure) {
        primary = new FactFailure(failure.code, failure.message, {
          ...failure.details,
          source_capture_failure: projectFactFailure(spool.failure),
        });
      }
      if (
        spool.failure &&
        failure.code === "cancelled" &&
        !signal.aborted &&
        !this.#lifetime.signal.aborted
      )
        primary = spool.failure;
    } finally {
      await spool.close(primary);
    }
    if (primary && !spool.bytes) {
      await spool.discard();
      throw primary;
    }
    const source = await this.#sourceFiles.retain(spool, {
      arguments: actualArguments,
      input: captureInput,
      started: start,
      complete: !primary,
    });
    if (primary) {
      const failure = projectFactFailure(primary);
      throw new FactFailure(failure.code, failure.message, {
        ...failure.details,
        evidence_id: source.evidence_id,
        source_retained: true,
        source_complete: false,
      });
    }
    return {
      source,
      input: snapshot.input,
      output_bytes: spool.limit,
      ...(reader ? { parsed: reader.finish(snapshot.input) } : {}),
    };
  }
  async #sourceText(id) {
    return (await this.#sourceFiles.read(id)).text;
  }
  async strings(input, signal) {
    return this.#stringQueries
      ? this.#stringQueries.read(input, signal)
      : this.#catalogs.strings(input, signal);
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
    return this.#references.read(input, signal);
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
    return this.#byteBatches
      ? this.#byteBatches.read(input, signal)
      : this.#readWindows("bytes", input, signal);
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
      const source = this.#sourceFiles.source(descriptor.evidence_id);
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
    await this.#sourceFiles.close();
    await this.#root.close();
    this.#loaded.clear();
    this.#work.clear();
    this.#snapshots.clear();
    this.#catalogs.clear();
    this.#stringQueries?.clear();
    this.#byteBatches?.clear();
    this.#references.clear();
    this.#evidence.clear();
  }
  cancel() {
    this.#lifetime.abort();
  }
}
