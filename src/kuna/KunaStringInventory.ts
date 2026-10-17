import { z } from "zod";

import type { AnalysisError } from "../domain/analysisErrorBase.js";
import { err, ok, type Result } from "../domain/result.js";
import { compareKunaAddresses } from "./KunaAddress.js";
import { KunaJsonDocumentReader, parseKunaRow } from "./KunaJsonStream.js";
import { KUNA_STRING_MIN_LENGTH } from "./KunaLimits.js";
import {
  kunaStringFactFieldsSchema,
  normalizeKunaStringFact,
  type KunaStringItem,
} from "./KunaStringFacts.js";

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const header = z.object({
  binary: z.string(),
  encoding: z.literal("all"),
  min_length: z.literal(KUNA_STRING_MIN_LENGTH),
  filter: z.null(),
  section: z.null(),
  termination: z.literal("any"),
  scanned: z.enum(["sections", "segments"]),
  xrefs: z.literal(false),
  count,
});
const row = kunaStringFactFieldsSchema.extend({
  address_hex: kunaStringFactFieldsSchema.shape.address,
  text: z.string(),
  section: z.string().nullable(),
  xrefs_count: z.literal(0),
  functions: z.tuple([]),
});

const ROWS = "strings";
const DOCUMENT = {
  header: new Set(Object.keys(header.shape)),
  sections: new Map(),
  rows: new Map([
    [
      ROWS,
      {
        fields: new Set(
          Object.keys(row.shape).filter(
            (key) => key !== "address" && key !== "functions",
          ),
        ),
        addresses: new Set(["address"]),
        // Rows are scanned with --no-xrefs, so `functions` must be empty.
        empty: new Set(["functions"]),
        nulls: new Set<string>(),
      },
    ],
  ]),
} as const;

export interface KunaStringInventory {
  readonly items: readonly KunaStringItem[];
  readonly sha256: string;
  readonly bytes: number;
  readonly scanned: "sections" | "segments";
}

/** Validates `kuna strings --json` row by row as Kuna writes it. */
export class KunaStringInventoryReader extends KunaJsonDocumentReader<KunaStringInventory> {
  readonly #items: KunaStringItem[] = [];
  readonly #identities = new Set<string>();

  constructor() {
    super("kuna:strings", "Kuna's string inventory", DOCUMENT);
  }

  override finish(input: string): Result<KunaStringInventory, AnalysisError> {
    const completed = this.complete();
    if (!completed.ok) return completed;
    const fields = header.safeParse(completed.value.header);
    if (!fields.success)
      return err(
        this.unusable("the string inventory header is not Kuna's scan"),
      );
    if (fields.data.binary !== input)
      return err(this.unusable("string inventory names a different input"));
    if (fields.data.count !== this.#items.length)
      return err(
        this.unusable("string inventory count disagrees with examined rows"),
      );
    this.#items.sort(
      (left, right) =>
        compareKunaAddresses(left.address, right.address) ||
        (left.string?.encoding ?? "").localeCompare(
          right.string?.encoding ?? "",
          "en",
        ),
    );
    return ok({
      items: this.#items,
      sha256: completed.value.sha256,
      bytes: completed.value.bytes,
      scanned: fields.data.scanned,
    });
  }

  protected override acceptRow(
    _member: string,
    fields: Readonly<Record<string, unknown>>,
  ): void {
    const entry = parseKunaRow(row, "string", fields);
    const normalized = normalizeKunaStringFact(entry);
    if (entry.address !== entry.address_hex)
      throw new Error("string address disagrees with its hex field");
    const identity = `${entry.address}:${entry.encoding}`;
    if (this.#identities.has(identity))
      throw new Error("string inventory repeats an identity");
    this.#identities.add(identity);
    this.#items.push(normalized);
  }

  protected override discardRows(): void {
    this.#items.length = 0;
    this.#identities.clear();
  }
}
