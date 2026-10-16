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
      ? [...new Set(input.ids)].flatMap((id) => index.get(id) ?? [])
      : [...index.values()]
    ).filter(filter),
    input,
  ),
  missing: input.ids
    ? [...new Set(input.ids)].filter((id) => !index.has(id))
    : [],
});

const locationKey = ({ space, offset, size_bytes }) =>
  JSON.stringify([space, offset, size_bytes]);

// One owner for graph, projection and call-boundary value selection. The lazy
// index contains only retained facts, never arbitrary caller query/cache keys.
export function createNativeValueReader(values, coverage) {
  let locations, unknownSpaces;
  const locate = (requested) => {
    if (requested.size && !locations) {
      locations = new Map();
      unknownSpaces = 0;
      for (const row of values.values()) {
        if (row.space === null) {
          unknownSpaces++;
          continue;
        }
        const key = locationKey(row);
        if (!locations.has(key)) locations.set(key, []);
        locations.get(key).push(row);
      }
    }
    return [...requested].map(([key, request]) => ({
      request,
      rows: locations?.get(key) ?? [],
    }));
  };
  return (input) => {
    const requested =
      input.locations === undefined
        ? null
        : new Map(input.locations.map((row) => [locationKey(row), row]));
    const groups = requested ? locate(requested) : null;
    const candidates = input.ids
      ? [...new Set(input.ids)].flatMap((id) => values.get(id) ?? [])
      : groups
        ? groups.flatMap(({ rows }) => rows)
        : [...values.values()];
    return {
      ...nativePage(
        candidates.filter(
          (row) =>
            (!requested || !input.ids || requested.has(locationKey(row))) &&
            (input.is_input === undefined || row.is_input === input.is_input),
        ),
        input,
      ),
      missing: input.ids
        ? [...new Set(input.ids)].filter((id) => !values.has(id))
        : [],
      ...(groups
        ? {
            unretained_locations: groups
              .filter(({ rows }) => !rows.length)
              .map(({ request }) => ({ ...request })),
            location_coverage: {
              scope:
                "exact space/offset/width of retained values; not aliases, pointee contents or machine memory",
              unknown_space_count: groups.length ? unknownSpaces : null,
            },
          }
        : {}),
      coverage,
    };
  };
}
