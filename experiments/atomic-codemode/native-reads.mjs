import { pageFacts } from "./fact-reads.mjs";
import { requireFact } from "./native-contract.mjs";

export const nativePage = (
  rows,
  input = {},
  identity = ["id", "origin_address", "block"],
) => pageFacts(rows, { offset: 0, limit: 20, ...input }, identity);
export const uniqueNative = (rows) => {
  const index = new Map();
  for (const row of rows) {
    requireFact(!index.has(row.id), `Duplicate native identity ${row.id}`);
    index.set(row.id, row);
  }
  return index;
};
export const readNativeIdentities = (index, input, filter = () => true) => ({
  ...nativePage(
    (input.ids
      ? input.ids.flatMap((id) => index.get(id) ?? [])
      : [...index.values()]
    ).filter(filter),
    input,
  ),
  missing: input.ids?.filter((id) => !index.has(id)) ?? [],
});
