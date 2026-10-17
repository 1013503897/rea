import { z } from "zod";

import type { analysisStringSchema } from "../domain/hopperValues.js";
import { KUNA_STRING_MIN_LENGTH } from "./KunaLimits.js";

const u32 = z.number().int().min(0).max(0xffff_ffff);
export const kunaStringFactFieldsSchema = z.object({
  address: z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u),
  text: z.string().optional(),
  length: u32,
  byte_length: u32,
  nul_terminated: z.boolean(),
  encoding: z.enum(["ascii", "utf8", "utf16"]),
});

type StringFields = z.infer<typeof kunaStringFactFieldsSchema>;
export type KunaStringItem = z.infer<typeof analysisStringSchema>;
export type KunaStringMetadataItem = Omit<KunaStringItem, "value"> & {
  readonly value?: string;
};

/** Metadata and optional text share one interpretation at the Kuna boundary. */
export function normalizeKunaStringFact(
  entry: StringFields & { readonly text: string },
): KunaStringItem;
export function normalizeKunaStringFact(
  entry: StringFields,
): KunaStringMetadataItem;
export function normalizeKunaStringFact(
  entry: StringFields,
): KunaStringMetadataItem {
  const terminator = entry.nul_terminated
    ? entry.encoding === "utf16"
      ? 2
      : 1
    : 0;
  const textBytes = entry.byte_length - terminator;
  const width = entry.encoding === "utf16" ? 2 : 1;
  if (
    entry.length < KUNA_STRING_MIN_LENGTH ||
    textBytes < entry.length * width ||
    (entry.encoding !== "utf8" && textBytes !== entry.length * width) ||
    (entry.encoding === "utf8" &&
      (textBytes < entry.length || textBytes > 4 * entry.length)) ||
    BigInt(entry.address) + BigInt(entry.byte_length) - 1n >
      0xffff_ffff_ffff_ffffn
  )
    throw new Error(
      "string extent contradicts its encoding, length or termination",
    );
  if (entry.text !== undefined) validateText(entry, entry.text);
  return {
    address: entry.address,
    ...(entry.text === undefined ? {} : { value: entry.text }),
    string: {
      encoding: entry.encoding,
      encoding_status: "observed",
      termination: entry.nul_terminated ? "present_or_not_required" : "missing",
      nul_terminated: entry.nul_terminated,
      byte_length: entry.byte_length,
    },
  };
}

function validateText(entry: StringFields, text: string): void {
  let characters = 0;
  for (const character of text) {
    const point = character.codePointAt(0)!;
    if (
      point === 0 ||
      (point >= 0xd800 && point <= 0xdfff) ||
      (entry.encoding === "ascii" && point > 0x7f) ||
      (entry.encoding === "utf16" && point > 0xff)
    )
      throw new Error("string text contradicts its reported encoding");
    characters += 1;
  }
  const bytes =
    entry.encoding === "utf16" ? text.length * 2 : Buffer.byteLength(text);
  const terminator = entry.nul_terminated
    ? entry.encoding === "utf16"
      ? 2
      : 1
    : 0;
  if (entry.length !== characters || entry.byte_length !== bytes + terminator)
    throw new Error(
      "string length or termination contradicts its encoded text",
    );
}
