// Shared native address/storage syntax; caller/callee interpretation stays separate.
import { z } from "zod";
import { hex } from "./native-contract.mjs";
export const nativeLocation = z.strictObject({
  space: z.string().min(1),
  offset: hex,
});
export const nativeStorage = nativeLocation.extend({
  size_bytes: z.number().int().positive().max(0x7fffffff),
});
