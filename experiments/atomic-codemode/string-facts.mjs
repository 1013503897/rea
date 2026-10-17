import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { KunaStringInventoryReader } from "../../dist/kuna/KunaStringInventory.js";
import { requireResult } from "./fact-error.mjs";
import { freezeFacts, pageFacts } from "./fact-reads.mjs";

export const parseStringFacts = async (text, input) => {
  const reader = new KunaStringInventoryReader();
  await pipeline(Readable.from([text]), reader);
  return freezeFacts(
    requireResult(reader.finish(input), "invalid_provider_output"),
  );
};

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
