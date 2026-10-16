// Shared native reference selection; adapters never reinterpret wire endpoints.
import { parseKunaReferenceFacts } from "../../dist/kuna/KunaReferenceFiles.js";
import { pageFacts } from "./fact-reads.mjs";
import { requireResult } from "./fact-error.mjs";

export const referenceReader = {
  query: (input, address) => ({
    address,
    direction: input.direction === "incoming" ? "to" : "from",
    scope: input.scope,
    kinds: input.kinds,
  }),
  // Scope/fields/pages select the same native source; do not re-run its analysis.
  key: (query) =>
    `xref:${JSON.stringify([query.direction, query.address, query.kinds])}`,
  arguments: (path, query) => [
    "xrefs",
    path,
    `--${query.direction}`,
    query.address,
    ...(query.kinds ? ["--kind", query.kinds.join(",")] : []),
    "--json",
  ],
  read: (text, path, query, input) => {
    const parsed = requireResult(
      parseKunaReferenceFacts(text, path, query),
      "invalid_provider_output",
    );
    return {
      ...pageFacts(parsed.facts, input, ["source_row", "from", "to", "kind"]),
      coverage: {
        direction: query.direction === "to" ? "incoming" : "outgoing",
        scope:
          query.scope === "function"
            ? "native owning-function references"
            : "exact address; not an object extent",
        function_scope: parsed.functionScope,
        examined_rows: parsed.rows,
        excluded_alias_rows: parsed.excludedAliasRows,
        excluded_scope_rows: parsed.excludedScopeRows,
        unattributed_scope_rows: parsed.unattributedScopeRows,
        discovery: "unknown",
        indirect_targets: "unknown",
        machine_semantic_equivalence: "unknown",
        runtime_binding: "unknown",
      },
    };
  },
};
