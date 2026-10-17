// Shared application admission and lease/file ownership; contracts stay provider-free.
import { methods } from "./api.mjs";
import { FactFailure, projectFactFailure } from "./fact-error.mjs";
import { ArtifactResourceScope } from "../../dist/artifacts/ArtifactResourceScope.js";
import { ArtifactReaderFailure } from "../../dist/artifacts/ArtifactReader.js";

const openNativeOwner = async (path, options) => {
  const { KunaFactOwner } = await import("./provider.mjs");
  return KunaFactOwner.open(path, options);
};

export class AtomicSession {
  #owner;
  #tail = Promise.resolve();
  #files = new ArtifactResourceScope();
  constructor(factory = openNativeOwner) {
    this.factory = factory;
  }
  #admit(work) {
    const pending = this.#tail.then(work, work);
    this.#tail = pending.catch(() => {});
    return pending;
  }
  get context() {
    return this.#owner?.context ?? null;
  }
  abort() {
    this.#owner?.cancel();
  }
  async #releaseFiles() {
    try {
      await this.#files.retryCleanup();
    } catch (cause) {
      const cleanup = ArtifactReaderFailure.cleanupObservation(
        cause,
        "Target session files",
      );
      throw new FactFailure("cleanup_incomplete", cleanup.reason, {
        resources: cleanup.resources,
      });
    }
  }
  open(path) {
    return this.#admit(async () => {
      await this.#releaseFiles();
      if (this.#owner) await this.#owner.close();
      this.#owner = undefined;
      this.#owner = await this.factory(path, {
        fileResources: this.#files,
      });
      return {
        ok: true,
        context: this.context,
        methods: Object.keys(methods),
        evidence_lifetime: "current target lease",
      };
    });
  }
  close() {
    return this.#admit(async () => {
      if (this.#owner) await this.#owner.close();
      await this.#releaseFiles();
      this.#owner = undefined;
      return { ok: true, closed: true };
    });
  }
  call(
    name,
    input,
    signal = new AbortController().signal,
    lease = this.context?.lease,
  ) {
    return this.#admit(async () => {
      try {
        if (signal.aborted)
          throw new FactFailure(
            "cancelled",
            "Request was cancelled before admission",
          );
        if (!this.#owner)
          throw new FactFailure(
            "no_target",
            "Call open_binary before analysis",
          );
        if (lease !== this.context.lease)
          throw new FactFailure(
            "stale_context",
            "Target lease changed; do not join facts across leases",
          );
        if (!Object.hasOwn(methods, name))
          throw new FactFailure(
            "unknown_method",
            `Unknown API method: ${name}`,
          );
        const contract = methods[name];
        const parsed = contract.input.parse(input);
        const data = await this.#owner[contract.method](parsed, signal);
        if (signal.aborted)
          throw new FactFailure(
            "cancelled",
            "Request was cancelled after observations were collected",
            { partial_observation: data },
          );
        return { ok: true, context: this.context, data };
      } catch (error) {
        return {
          ok: false,
          context: this.context,
          error: projectFactFailure(error),
        };
      }
    });
  }
}
