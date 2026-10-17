import { expect, it } from "vitest";
import { parseKunaReferenceRanges } from "../../../../src/kuna/KunaReferenceRanges.js";

const input = "/snapshot/program";
const maximum = "0xffffffffffffffff";
const query = {
  ranges: [
    { start: "0x20000000000001", end_inclusive: maximum },
    { start: maximum, end_inclusive: maximum },
  ],
  offset: 0,
  limit: 2,
  kinds: ["data"] as const,
};
const encoded = (value: unknown) =>
  JSON.stringify(value).replace(/"@(\d+)"/gu, "$1");
const row = (range_index: number) => ({
  range_index,
  address: "@9007199254740995",
  address_hex: "0x20000000000003",
  kind: "data",
  from_address: "@9007199254740995",
  from_address_hex: "0x20000000000003",
  to_address: "@18446744073709551615",
  to_address_hex: maximum,
  from_function: {
    name: "caller 中文",
    address: "@9007199254740992",
    address_hex: "0x20000000000000",
  },
  to_function: null,
  instruction: "LEA RDX,[target]",
});
const document = () => ({
  schema_version: 1,
  binary: input,
  direction: "to",
  count: 2,
  ranges: query.ranges
    .map((range, index) => ({
      ...range,
      index,
      offset: 0,
      limit: 2,
      total: 1,
      count: 1,
      next_offset: null as number | null,
    }))
    .reverse(),
  xrefs: [row(1), row(0)],
});

it("binds reordered metadata by named range index, preserves u64 and original source rows", () => {
  const result = parseKunaReferenceRanges(encoded(document()), input, query);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(
    result.value.results.map((p) => [
      p.range_index,
      p.range,
      p.facts[0]?.source_row,
      p.total,
    ]),
  ).toEqual([
    [0, query.ranges[0], 1, 1],
    [1, query.ranges[1], 0, 1],
  ]);
  expect(result.value.results[0]?.facts[0]).toMatchObject({
    from: "0x20000000000003",
    to: maximum,
    kind: "data",
    fromFunction: { name: "caller 中文" },
    toFunction: null,
  });
  expect(result.value.results[0]?.range).not.toBe(query.ranges[0]);
});

it("rejects foreign scope, dangling or repeated queries, malformed endpoints and inconsistent paging", () => {
  for (const mutate of [
    (v: ReturnType<typeof document>) => {
      v.binary = "/other";
    },
    (v: ReturnType<typeof document>) => {
      v.count = 3;
    },
    (v: ReturnType<typeof document>) => {
      v.ranges[0]!.index = 0;
    },
    (v: ReturnType<typeof document>) => {
      v.ranges[0]!.end_inclusive = "0x1";
    },
    (v: ReturnType<typeof document>) => {
      v.ranges[0]!.offset = 1;
    },
    (v: ReturnType<typeof document>) => {
      v.ranges[0]!.next_offset = 1;
    },
    (v: ReturnType<typeof document>) => {
      v.ranges[0]!.total = 2;
    },
    (v: ReturnType<typeof document>) => {
      v.xrefs[0]!.range_index = 7;
    },
    (v: ReturnType<typeof document>) => {
      v.xrefs[0]!.kind = "call";
    },
    (v: ReturnType<typeof document>) => {
      v.xrefs[0]!.to_address = "@1";
      v.xrefs[0]!.to_address_hex = "0x1";
    },
    (v: ReturnType<typeof document>) => {
      v.xrefs[0]!.address = "@1";
    },
    (v: ReturnType<typeof document>) => {
      v.xrefs[0]!.from_function.address = "@1";
    },
  ]) {
    const value = document();
    mutate(value);
    expect(parseKunaReferenceRanges(encoded(value), input, query).ok).toBe(
      false,
    );
  }
});

it("preserves overlap between queries but rejects a duplicated occurrence within one page", () => {
  const value = document();
  value.count = 3;
  value.xrefs.push(row(0));
  const first = value.ranges.find((r) => r.index === 0)!;
  first.total = 2;
  first.count = 2;
  const result = parseKunaReferenceRanges(encoded(value), input, query);
  expect(result).toMatchObject({
    ok: false,
    error: expect.stringContaining("repeats an occurrence"),
  });
});

it("distinguishes a complete page from an empty out-of-range page with observed matches", () => {
  const one = {
    ranges: [query.ranges[1]!],
    offset: 1,
    limit: 1,
    kinds: query.kinds,
  };
  const value = {
    schema_version: 1,
    binary: input,
    direction: "to",
    count: 1,
    ranges: [
      {
        ...one.ranges[0],
        index: 0,
        offset: 1,
        limit: 1,
        total: 3,
        count: 1,
        next_offset: 2,
      },
    ],
    xrefs: [row(0)],
  };
  expect(parseKunaReferenceRanges(encoded(value), input, one)).toMatchObject({
    ok: true,
    value: { results: [{ total: 3, next_offset: 2 }] },
  });
  const empty = {
    ...value,
    count: 0,
    xrefs: [],
    ranges: [{ ...value.ranges[0], offset: 4, count: 0, next_offset: null }],
  };
  expect(
    parseKunaReferenceRanges(encoded(empty), input, { ...one, offset: 4 }),
  ).toMatchObject({
    ok: true,
    value: { results: [{ total: 3, next_offset: null, facts: [] }] },
  });
});
