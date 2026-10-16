// Parse one bounded native architecture catalog; views never reinterpret names.
import { z } from "zod";
import { NATIVE_OUTPUT_BYTES } from "./limits.mjs";
import {
  nativeLocationKey,
  hex,
  ordinal,
  rowParser,
  requireFact,
  formatFailure,
} from "./native-contract.mjs";
import { freezeFacts } from "./fact-reads.mjs";
import { nativePage } from "./native-reads.mjs";

const u32 = z.number().int().nonnegative().max(0xffffffff);
const space = z.strictObject({
  native_index: ordinal,
  name: z.string().min(1),
  kind: z.string().min(1),
  address_size_bytes: u32,
  addressable_unit_bytes: u32.positive(),
  endianness: z.enum(["big", "little"]),
  highest_offset: hex,
});
const register = z.strictObject({
  native_row: ordinal,
  space: z.string().min(1).nullable(),
  offset: hex,
  size_bytes: u32.positive(),
  name: z.string().nullable(),
  name_bytes_hex: z
    .string()
    .regex(/^(?:[0-9a-f]{2})*$/u)
    .nullable(),
});
const schema = z.strictObject({
  schema_version: z.literal(1),
  binary: z.string(),
  architecture: z.strictObject({
    native_id: z.string().min(1),
    default_code_space: z.string().min(1).nullable(),
  }),
  space_index_capacity: ordinal,
  register_count: ordinal,
  spaces: z.array(space),
  registers: z.array(register),
  coverage: z.strictObject({
    scope: z.string(),
    native_exact_register_map: z.literal("complete"),
    alias_relationships: z.literal("unknown"),
    dynamic_join_records: z.literal("not-collected"),
    memory_values: z.literal("not-returned"),
    listing_discovery: z.literal(false),
    functions_decompiled: z.literal(0),
  }),
});
// A valid record necessarily occupies at least this many wire bytes. Admit row
// counts before mapping malformed arrays or allocating their parsed rows.
const minSpaceBytes = Buffer.byteLength(
  JSON.stringify({
    native_index: 0,
    name: "x",
    kind: "x",
    address_size_bytes: 0,
    addressable_unit_bytes: 1,
    endianness: "big",
    highest_offset: "0x0",
  }),
);
const minRegisterBytes = Buffer.byteLength(
  JSON.stringify({
    native_row: 0,
    space: "x",
    offset: "0x0",
    size_bytes: 1,
    name: "",
    name_bytes_hex: null,
  }),
);
const parse = rowParser(schema, {
  spaces: (r) => space.parse(r),
  registers: (r) => register.parse(r),
});
export function parseNativeStorageMap(text, expectedInput) {
  try {
    requireFact(
      Buffer.byteLength(text) <= NATIVE_OUTPUT_BYTES,
      "Native storage map exceeds wire budget",
    );
    const raw = JSON.parse(text);
    for (const [name, minimum] of [
      ["spaces", minSpaceBytes],
      ["registers", minRegisterBytes],
    ])
      requireFact(
        Array.isArray(raw?.[name]) &&
          raw[name].length <= Math.floor(NATIVE_OUTPUT_BYTES / minimum),
        `Native storage ${name} exceeds format-derived row capacity`,
      );
    const facts = parse(raw);
    requireFact(
      facts.binary === expectedInput,
      "Native storage map input differs from requested subject",
    );
    requireFact(
      facts.register_count === facts.registers.length,
      "Native register count mismatch",
    );
    const spacesByName = new Map(),
      spacesByIndex = new Map(),
      byLocation = new Map(),
      byName = new Map();
    for (const row of facts.spaces) {
      requireFact(
        row.native_index < facts.space_index_capacity &&
          !spacesByName.has(row.name) &&
          !spacesByIndex.has(row.native_index),
        "Duplicate or invalid native space identity",
      );
      spacesByName.set(row.name, row);
      spacesByIndex.set(row.native_index, row);
    }
    requireFact(
      facts.architecture.default_code_space === null ||
        spacesByName.has(facts.architecture.default_code_space),
      "Unretained native default code space",
    );
    for (const [index, row] of facts.registers.entries()) {
      requireFact(
        row.native_row === index,
        "Native register row identity mismatch",
      );
      requireFact(
        (row.name === null) === (row.name_bytes_hex !== null),
        "Native register name/byte knowledge mismatch",
      );
      requireFact(
        row.space === null || spacesByName.has(row.space),
        "Register references unretained native space",
      );
      if (row.space !== null) {
        const key = nativeLocationKey(row);
        requireFact(!byLocation.has(key), "Duplicate native register location");
        byLocation.set(key, row);
      }
      if (row.name !== null) {
        if (!byName.has(row.name)) byName.set(row.name, []);
        byName.get(row.name).push(row);
      }
    }
    freezeFacts(facts);
    return createViews(facts, {
      spacesByName,
      spacesByIndex,
      byLocation,
      byName,
    });
  } catch (error) {
    throw formatFailure(error);
  }
}
function createViews(
  facts,
  { spacesByName, spacesByIndex, byLocation, byName },
) {
  const metadata = freezeFacts({
    architecture: facts.architecture,
    totals: {
      spaces: facts.spaces.length,
      space_index_capacity: facts.space_index_capacity,
      registers: facts.register_count,
    },
    coverage: {
      ...facts.coverage,
      unmatched_selectors:
        "no retained exact map match; not absence of hardware storage, aliases or runtime values",
      names: "native varnode_xref names; not every translator symbol/alias",
      unknown_space_register_count: facts.registers.filter(
        (r) => r.space === null,
      ).length,
      undecodable_name_count: facts.registers.filter((r) => r.name === null)
        .length,
    },
  });
  return Object.freeze({
    spaces(input) {
      const names = input.names && [...new Set(input.names)],
        indices = input.indices && [...new Set(input.indices)];
      const rows = (
        indices
          ? indices.flatMap((i) => spacesByIndex.get(i) ?? [])
          : names
            ? names.flatMap((n) => spacesByName.get(n) ?? [])
            : facts.spaces
      ).filter(
        (r) =>
          (!names || names.includes(r.name)) &&
          (!indices || indices.includes(r.native_index)),
      );
      return {
        ...metadata,
        ...nativePage(rows, input, ["native_index", "name"]),
        missing_names: names?.filter((n) => !spacesByName.has(n)) ?? [],
        missing_indices: indices?.filter((i) => !spacesByIndex.has(i)) ?? [],
      };
    },
    registers(input) {
      const names = input.names && new Set(input.names),
        locations =
          input.locations &&
          new Map(input.locations.map((r) => [nativeLocationKey(r), r]));
      const normalize = (s) => (input.case_sensitive ? s : s.toLowerCase()),
        query = normalize(input.query ?? "");
      const rows = locations
        ? [...locations.keys()].flatMap((k) => byLocation.get(k) ?? [])
        : names
          ? [...names].flatMap((n) => byName.get(n) ?? [])
          : facts.registers;
      return {
        ...metadata,
        ...nativePage(
          rows.filter(
            (r) =>
              (!names || names.has(r.name)) &&
              (!query ||
                (r.name !== null && normalize(r.name).includes(query))),
          ),
          input,
          ["native_row", "space", "offset", "size_bytes"],
        ),
        unretained_names: names ? [...names].filter((n) => !byName.has(n)) : [],
        ...(locations
          ? {
              unretained_locations: [...locations]
                .filter(([k]) => !byLocation.has(k))
                .map(([, r]) => ({ ...r })),
              unretained_space_names: [
                ...new Set([...locations.values()].map((r) => r.space)),
              ].filter((n) => !spacesByName.has(n)),
            }
          : {}),
      };
    },
  });
}
