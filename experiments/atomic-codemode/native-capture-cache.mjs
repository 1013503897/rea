// Per-lease native work. A proven byte refusal remains valid as storage only shrinks.
import { FactFailure } from "./fact-error.mjs";
import { MAX_NATIVE_SOURCES } from "./limits.mjs";

const reuse = Object.freeze({
  kind: "source_budget_refusal",
  scope: "target_lease",
});
const refusalFields = new Set([
  "scope",
  "limit_bytes",
  "observed_bytes_at_least",
  "evidence_id",
  "source_retained",
  "source_complete",
]);
const retainRefusal = (error) => {
  try {
    if (!(error instanceof FactFailure)) return;
    const own = Object.getOwnPropertyDescriptors(error);
    if (
      own.code?.value !== "resource_constraint" ||
      typeof own.message?.value !== "string"
    )
      return;
    const fields = Object.getOwnPropertyDescriptors(own.details?.value);
    if (
      Object.keys(fields).some((key) => !refusalFields.has(key)) ||
      Object.values(fields).some(
        (field) =>
          !Object.hasOwn(field, "value") ||
          (field.value !== null &&
            !["string", "number", "boolean"].includes(typeof field.value)),
      )
    )
      return;
    const details = Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, field.value]),
    );
    if (
      details.scope !== "native_source" ||
      details.source_retained !== true ||
      details.source_complete !== false ||
      typeof details.evidence_id !== "string" ||
      !details.evidence_id ||
      !Number.isSafeInteger(details.limit_bytes) ||
      details.limit_bytes < 1 ||
      !Number.isSafeInteger(details.observed_bytes_at_least) ||
      details.observed_bytes_at_least <= details.limit_bytes
    )
      return;
    return new FactFailure(
      own.code.value,
      own.message.value,
      Object.freeze(details),
    );
  } catch {
    // Unknown host failures retain their original identity and remain uncached.
    return;
  }
};

export class NativeCaptureCache {
  #entries = new Map();
  clear() {
    this.#entries.clear();
  }
  async read(key, load) {
    let pending = this.#entries.get(key);
    const reused = pending !== undefined;
    if (!pending) {
      pending = Promise.resolve()
        .then(load)
        .then(
          (value) => ({ ok: true, value }),
          (error) => {
            const refusal = retainRefusal(error);
            return {
              ok: false,
              error: refusal ?? error,
              reusable: refusal !== undefined,
            };
          },
        );
      if (this.#entries.size < MAX_NATIVE_SOURCES)
        this.#entries.set(key, pending);
    }
    const result = await pending;
    if (result.ok) return result.value;
    if (!result.reusable) {
      if (this.#entries.get(key) === pending) this.#entries.delete(key);
      throw result.error;
    }
    throw new FactFailure(result.error.code, result.error.message, {
      ...result.error.details,
      ...(reused ? { cached_observation: reuse } : {}),
    });
  }
}
