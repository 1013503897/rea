import { parseKunaInventory } from "../../dist/kuna/KunaProjectFiles.js";
import { requireResult } from "./fact-error.mjs";
import { pageFacts } from "./fact-reads.mjs";

export const parseFunctionFacts = (text) =>
  Object.freeze(
    requireResult(parseKunaInventory(text), "invalid_provider_output").map(
      (entry) =>
        Object.freeze({ ...entry, aliases: Object.freeze([...entry.aliases]) }),
    ),
  );

export function selectFunctionFacts(functions, input) {
  const addresses = input.addresses && new Set(input.addresses);
  const normalize = (name) =>
    input.case_sensitive ? name : name.toLowerCase();
  const query = normalize(input.query);
  const matches = functions.filter(
    (entry) =>
      (!addresses || addresses.has(entry.address)) &&
      [entry.name, ...entry.aliases].some((name) =>
        input.exact
          ? normalize(name) === query
          : normalize(name).includes(query),
      ),
  );
  return {
    ...pageFacts(matches, input, ["address"]),
    coverage: {
      scope: "native callable-entry inventory, including import stubs",
      discovery: "unknown",
      extents: "upper bounds clipped at the next entry; zero means unmeasured",
      symbol_binding_at_runtime: "unknown",
    },
  };
}
