// Experimental application layer. Provider parsing and native caches remain in REA.
import { createHash } from "node:crypto";

export const contextFor = (artifactSha, profile, lease) => {
  const identity = {
    artifact_sha256: artifactSha,
    analysis_profile_digest: profile.digest,
    address_space: "provider-default",
  };
  return {
    ref: createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
    ...identity,
    provider: profile.provider,
    lease,
  };
};

const failure = (code, message) => ({
  status: "error",
  error: { code, message },
});
const source = (evidence) => ({
  evidence_id: evidence.evidence_id,
  confidence: evidence.confidence,
  limitations: evidence.limitations,
});
const pageOf = (items, offset, limit) => ({
  items: items.slice(offset, offset + limit),
  selection: {
    matched: items.length,
    offset,
    returned: Math.max(0, Math.min(limit, items.length - offset)),
    next_offset: offset + limit < items.length ? offset + limit : null,
  },
});

/** One fact can be read alone or in a batch; a batch is not a new fact kind. */
export class FactQueries {
  constructor(port) {
    this.port = port;
  }

  async findStrings({ query, offset = 0, limit = 20, fields = ["value"] }) {
    const observed = await this.port.observe("search_strings", query);
    if (!observed.ok) return { status: "error", error: observed.error };
    const evidence = observed.value;
    const all = evidence.normalized_result;
    const page = pageOf(all, offset, limit);
    return {
      status: "ok",
      context: this.port.context(),
      ...source(evidence),
      selection: page.selection,
      // Paging is complete over this provider's answer, not all artifact strings.
      coverage: {
        status: "unknown",
        reason:
          "Provider inventory is not proof of every string in the artifact.",
      },
      items: page.items.map((row) => ({
        id: {
          kind: "string",
          address: row.address,
          encoding: row.string?.encoding ?? null,
        },
        ...Object.fromEntries(
          fields
            .filter((key) => Object.hasOwn(row, key))
            .map((key) => [key, row[key]]),
        ),
      })),
    };
  }

  validContext(context) {
    const current = this.port.context();
    return context.ref === current.ref && context.lease === current.lease;
  }

  async incomingReferences({ context, targets, offset = 0, limit = 20 }) {
    if (!this.validContext(context))
      return failure(
        "invalid_request",
        "Fact context or session lease is stale; find facts again on the selected target.",
      );
    // Share duplicate targets within this batch. Native/session cache ownership
    // remains with the provider; this layer adds no long-lived result cache.
    const observations = new Map();
    const results = [];
    for (const target of targets) {
      let observed = observations.get(target.address);
      if (observed === undefined) {
        observed = await this.port.observe("xrefs", {
          address: target.address,
        });
        observations.set(target.address, observed);
      }
      if (!observed.ok) {
        results.push({ target, status: "error", error: observed.error });
        continue;
      }
      const evidence = observed.value;
      const page = pageOf(evidence.normalized_result, offset, limit);
      results.push({
        target,
        status: "ok",
        scope: { kind: "exact-address", address: target.address },
        ...source(evidence),
        selection: page.selection,
        coverage: {
          status: "unknown",
          reason:
            "The existing xrefs contract does not carry reference completeness.",
        },
        items: page.items.map((address) => ({
          from: { kind: "location", address },
          to: { kind: "location", address: target.address },
          kind: "unknown",
          kind_reason: "The existing xrefs contract projects addresses only.",
        })),
      });
    }
    return {
      status: results.every((row) => row.status === "ok") ? "ok" : "partial",
      context: this.port.context(),
      results,
    };
  }

  async resolveFunctions({ context, locations }) {
    if (!this.validContext(context))
      return failure(
        "invalid_request",
        "Fact context or session lease is stale; find facts again on the selected target.",
      );
    if (!this.port.supports("resolve_containing_procedure"))
      return {
        status: locations.length === 0 ? "ok" : "partial",
        context: this.port.context(),
        results: locations.map((location) => ({
          location,
          status: "unknown",
          error: {
            code: "unsupported",
            message:
              "The selected provider does not advertise containing-procedure resolution.",
          },
        })),
      };
    const observations = new Map();
    const results = [];
    for (const location of locations) {
      let observed = observations.get(location.address);
      if (observed === undefined) {
        observed = await this.port.observe("resolve_containing_procedure", {
          address: location.address,
        });
        observations.set(location.address, observed);
      }
      results.push(
        observed.ok
          ? {
              location,
              status: "ok",
              ...source(observed.value),
              // Preserve the owner's complete tagged found/negative outcome.
              resolution: observed.value.normalized_result,
            }
          : { location, status: "unknown", error: observed.error },
      );
    }
    return {
      status: results.every((row) => row.status === "ok") ? "ok" : "partial",
      context: this.port.context(),
      results,
    };
  }

  async traceStringUses(input) {
    const strings = await this.findStrings(input);
    if (strings.status !== "ok") return strings;
    const references = await this.incomingReferences({
      context: strings.context,
      targets: strings.items.map((row) => row.id),
      offset: 0,
      limit: input.reference_limit ?? 20,
    });
    if (references.status === "error") return references;
    const locations = [
      ...new Map(
        references.results
          .flatMap((row) => row.items ?? [])
          .map((row) => [row.from.address, row.from]),
      ).values(),
    ];
    const functions =
      input.include_functions === false
        ? null
        : await this.resolveFunctions({ context: strings.context, locations });
    return {
      status:
        references.status === "partial" || functions?.status === "partial"
          ? "partial"
          : "ok",
      strings,
      references,
      functions,
    };
  }
}
