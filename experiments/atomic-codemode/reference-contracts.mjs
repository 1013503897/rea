// One named reference operation; exact-address and image-span selectors stay distinct.
import { z } from "zod";
import { hex, page } from "./api-contracts.mjs";

const selection = {
  kinds: z
    .array(z.enum(["call", "jump", "data", "read", "write"]))
    .min(1)
    .optional(),
  fields: z
    .array(z.enum(["fromFunction", "toFunction", "instruction"]))
    .optional(),
  ...page,
};
const span = z.strictObject({ start: hex, end_inclusive: hex });
const input = z
  .union([
    z.strictObject({
      addresses: z.array(hex).min(1).max(16),
      direction: z.enum(["incoming", "outgoing"]).default("incoming"),
      scope: z.literal("address").default("address"),
      ...selection,
    }),
    z.strictObject({
      addresses: z.array(hex).min(1).max(16),
      direction: z.literal("outgoing"),
      scope: z.literal("function"),
      ...selection,
    }),
    z.strictObject({
      ranges: z.array(span).min(1).max(16),
      direction: z.literal("incoming").default("incoming"),
      scope: z.literal("range").default("range"),
      ...selection,
    }),
  ])
  .superRefine((value, context) => {
    for (const [i, range] of (value.ranges ?? []).entries()) {
      if (
        !hex.safeParse(range.start).success ||
        !hex.safeParse(range.end_inclusive).success
      )
        continue;
      if (BigInt(range.start) > BigInt(range.end_inclusive)) {
        context.addIssue({
          code: "custom",
          path: ["ranges", i, "end_inclusive"],
          message: "Inclusive end precedes start",
        });
      }
    }
  });

export const referencesMethod = {
  summary:
    "Read exact-address/outgoing xrefs, or page batched incoming target-address spans with one native index.",
  description:
    "Select addresses for incoming exact-target or outgoing address/function references; function scope requires direction:outgoing and an entry. Alternatively select incoming native image ranges [{start,end_inclusive}] in caller order, including overlaps/duplicates; offset/limit apply independently to each range. Range membership tests the reference target coordinate, without callable-alias expansion. It does not prove memory-access overlap, whole-string use, or runtime binding. Both forms preserve occurrence/source-row identity, endpoints, native owning functions, paging and Evidence. A range batch builds one index; fields are projected from the same retained page. Completeness is limited to examined native references; discovery stays unknown. Recovered IR calls are a separate representation and may omit machine calls.",
  input,
  method: "references",
  example:
    'await rea.references({ranges:[{start:"0x2000",end_inclusive:"0x200d"}],kinds:["data"],limit:20})',
};
