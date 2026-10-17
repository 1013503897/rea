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
    examined: inventory.items.length,
    matching: "literal_utf16",
    source_scope: "whole native inventory",
    artifact_discovery: "unknown",
    reference_attribution: "not-computed",
  },
});
