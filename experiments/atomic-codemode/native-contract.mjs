// Shared native identity/value contracts and bounded row/facet decoding.
import { z } from "zod";
import { FactFailure } from "./fact-error.mjs";
import { ok, err } from "../../dist/domain/result.js";
export const requireFact = (condition, reason) => {
  if (!condition) throw new FactFailure("invalid_provider_output", reason);
};
export const hex = z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u);
export const edgeId = z.string().regex(/^\d+:\d+$/u);
export const ordinal = z.number().int().nonnegative().max(0x7fffffff);
export const valueId = z.string().regex(/^v[0-9a-f]{1,16}$/u);
export const operationId = z
  .string()
  .regex(/^0x[0-9a-f]{1,16}:[0-9a-f]{1,8}$/u);
export const value = z.strictObject({
  id: valueId,
  space: z.string().nullable(),
  offset: hex,
  size_bytes: z.number().int().positive().max(0x7fffffff),
  is_constant: z.boolean(),
  is_input: z.boolean(),
  is_annotation: z.boolean(),
  definition: operationId.nullable(),
  type_name: z.string(),
});
export const requireSameNativeValue = (value, reference, message) =>
  requireFact(
    reference &&
      Object.entries(value).every(([key, v]) => reference[key] === v),
    message,
  );
export const rowParser = (schema, arrays, fields = {}) => {
  const metadata = schema.omit(
    Object.fromEntries(
      [...Object.keys(arrays), ...Object.keys(fields)].map((key) => [
        key,
        true,
      ]),
    ),
  );
  return (raw) => {
    const metadataFields = { ...raw };
    for (const key of [...Object.keys(arrays), ...Object.keys(fields)])
      delete metadataFields[key];
    const result = metadata.parse(metadataFields);
    for (const [key, parse] of Object.entries(arrays)) {
      requireFact(Array.isArray(raw[key]), `Native ${key} must be an array`);
      result[key] = raw[key].map(parse);
    }
    for (const [key, parse] of Object.entries(fields))
      result[key] = parse(raw[key]);
    return result;
  };
};
export const formatFailure = (error) => {
  if (error instanceof FactFailure) return error;
  const details =
    error instanceof z.ZodError
      ? {
          issues: error.issues.slice(0, 8).map(({ path, code, message }) => ({
            path,
            code,
            message: message.slice(0, 160),
          })),
        }
      : { reason: String(error.message).slice(0, 256) };
  return new FactFailure(
    "invalid_provider_output",
    "Native IR source does not match the declared format",
    details,
  );
};

export const readNativeFacet = (fn, name, label, parse) => {
  try {
    const reason = fn[`${name}_error`];
    if (reason !== undefined) {
      requireFact(
        fn[name] === undefined,
        `Native ${label} is both present and unavailable`,
      );
      requireFact(
        typeof reason === "string",
        `Native ${label} failure reason must be text`,
      );
      return err(
        new FactFailure(
          "capability_unavailable",
          `Native ${label} facet is unavailable`,
          {
            native_error: reason.slice(0, 1024),
            native_error_truncated: reason.length > 1024,
          },
        ),
      );
    }
    if (fn[name] === undefined)
      return err(
        new FactFailure(
          "capability_unavailable",
          `Native ${label} facet was not captured`,
          { availability: "not-captured" },
        ),
      );
    return ok(parse(fn[name]));
  } catch (error) {
    return err(formatFailure(error));
  }
};
