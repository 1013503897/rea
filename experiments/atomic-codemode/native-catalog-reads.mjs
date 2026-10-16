// Fixed per-lease catalogs share source admission; queries do not create cache keys.
import { parseFunctionFacts, selectFunctionFacts } from "./function-facts.mjs";
import { parseStringFacts, selectStringFacts } from "./string-facts.mjs";
import { parseNativeStorageMap } from "./native-storage-map.mjs";
import { sourceSummary } from "./fact-reads.mjs";
import { FactFailure } from "./fact-error.mjs";

const catalogs = {
  functions: {
    arguments: (path) => ["functions", path, "--json"],
    parse: parseFunctionFacts,
  },
  strings: {
    arguments: (path) => [
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
    parse: parseStringFacts,
  },
  storage: {
    arguments: (path) => ["storage-map", path, "--json"],
    parse: parseNativeStorageMap,
  },
};
export class NativeCatalogReads {
  #loaded = new Map();
  constructor(capture, readSource, requireStorage) {
    this.capture = capture;
    this.readSource = readSource;
    this.requireStorage = requireStorage;
  }
  async #load(name, signal) {
    if (name === "storage") this.requireStorage();
    if (!this.#loaded.has(name)) {
      const definition = catalogs[name],
        capture = await this.capture(name, definition.arguments, signal);
      try {
        const facts = await definition.parse(
          await this.readSource(capture.source.evidence_id),
          capture.input,
        );
        this.#loaded.set(name, {
          facts,
          source: Object.freeze(sourceSummary(capture.source)),
        });
      } catch (error) {
        throw new FactFailure(
          error.code ?? "invalid_provider_output",
          error.message,
          {
            ...error.details,
            evidence_id: capture.source.evidence_id,
            source_retained: true,
          },
        );
      }
    }
    return this.#loaded.get(name);
  }
  async functions(input, signal) {
    const { facts, source } = await this.#load("functions", signal);
    return { source, ...selectFunctionFacts(facts, input) };
  }
  async strings(input, signal) {
    const { facts, source } = await this.#load("strings", signal);
    return { source, ...selectStringFacts(facts, input) };
  }
  async spaces(input, signal) {
    const { facts, source } = await this.#load("storage", signal);
    return { source, ...facts.spaces(input) };
  }
  async registers(input, signal) {
    const { facts, source } = await this.#load("storage", signal);
    return { source, ...facts.registers(input) };
  }
  clear() {
    this.#loaded.clear();
  }
}
