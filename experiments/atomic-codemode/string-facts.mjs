import { parseKunaStringInventory } from "../../dist/kuna/KunaStringInventory.js";
import { requireResult } from "./fact-error.mjs";
import { freezeFacts, pageFacts } from "./fact-reads.mjs";

export const parseStringFacts = (text, input) =>
  freezeFacts(
    requireResult(
      parseKunaStringInventory(text, input),
      "invalid_provider_output",
    ),
  );

export const selectStringFacts = (inventory, input) => ({
  ...pageFacts(
    inventory.items.filter((row) => row.value.includes(input.query)),
    input,
  ),
  coverage: {
    scope: "native string inventory, minimum 5",
    scanned: inventory.scanned,
    artifact_discovery: "unknown",
    reference_attribution: "not-computed",
  },
});
