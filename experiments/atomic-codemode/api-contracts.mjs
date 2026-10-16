// Shared named contract and selection vocabulary; no engine or adapter code.
import { z } from "zod";
export const hex = z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u);
export const valueLocation = z.strictObject({
  space: z.string(),
  offset: hex,
  size_bytes: z.number().int().positive(),
});
export const page = {
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(128).default(20),
};
export const definition = (
  { summary, description },
  input,
  method,
  example,
) => ({
  summary,
  description,
  input: z.strictObject(input),
  method,
  example,
});
