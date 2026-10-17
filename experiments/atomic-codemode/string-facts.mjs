import { pageFacts } from "./fact-reads.mjs";

export const selectStringFacts = (inventory, input) => ({
  ...pageFacts(
    inventory.items.filter((row) => row.value.includes(input.query)),
    input,
    ["address", "string"],
  ),
  coverage: {
    scope: "native string inventory, minimum 5",
    scanned: inventory.scanned,
    artifact_discovery: "unknown",
    reference_attribution: "not-computed",
  },
});
