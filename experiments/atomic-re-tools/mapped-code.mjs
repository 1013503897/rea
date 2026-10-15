// A view over native printer-to-instruction mappings, never a C-text parser.
import assert from "node:assert/strict";
import { z } from "zod";

const mapping = z.object({
  line_number: z.number().int().positive(),
  addresses: z.array(z.number().nonnegative()),
});
const documentSchema = z.object({
  binary: z.string(),
  count: z.number().int().nonnegative(),
  functions: z.array(
    z.object({
      address_hex: z.string(),
      address: z.number().nonnegative(),
      code: z.string().nullable(),
      error: z.string().nullable(),
      line_mappings: z.array(mapping).optional(),
    }),
  ),
});

export const mappedCode = async (native, reference, contextLines = 16) => {
  if (reference.functions.length !== 1 || !Array.isArray(reference.sites))
    return {
      status: "unknown",
      reason:
        "A unique native owning function and exact reference sites are required.",
    };
  const entry = reference.functions[0].address;
  const snapshot = await native((input) => [
    "decompile",
    input,
    entry,
    "--addr",
    "--json",
    "--max-fn-memory",
    "1024",
  ]);
  const document = documentSchema.parse(JSON.parse(snapshot.stdout.text));
  assert.equal(document.binary, snapshot.input);
  assert.equal(document.count, document.functions.length);
  const candidates = document.functions.filter(
    (row) => row.address_hex === entry,
  );
  const fn = candidates.length === 1 ? candidates[0] : undefined;
  if (fn === undefined || fn.code === null || fn.line_mappings === undefined)
    return {
      status: "unknown",
      reason:
        "Native decompilation did not supply a body with instruction-to-line mappings.",
      native_error: fn?.error ?? null,
    };
  // This low-VMA experiment rejects unsafe numeric arrays, rather than rounding
  // u64 addresses. General u64 array support would need the owning JSON parser.
  if (
    !Number.isSafeInteger(fn.address) ||
    `0x${fn.address.toString(16)}` !== entry ||
    fn.line_mappings.some((row) =>
      row.addresses.some((value) => !Number.isSafeInteger(value)),
    )
  )
    return {
      status: "unknown",
      reason:
        "Instruction mapping contains an address outside this prototype's exact safe-integer coverage.",
    };
  const sites = new Set(reference.sites.map((row) => row.from));
  const hits = fn.line_mappings.filter((row) =>
    row.addresses.some((value) => sites.has(`0x${value.toString(16)}`)),
  );
  const mappedSites = new Set(
    hits.flatMap((row) =>
      row.addresses.map((value) => `0x${value.toString(16)}`),
    ),
  );
  const unmappedSites = [...sites].filter((site) => !mappedSites.has(site));
  const lines = fn.code.split("\n");
  for (const hit of hits) assert.ok(hit.line_number <= lines.length);
  if (!hits.length)
    return {
      status: "unknown",
      reason:
        "No exact reference site maps to an emitted line; nearest-line guessing is disabled.",
    };
  const ranges = hits.map((hit) => ({
    start_line: Math.max(1, hit.line_number - contextLines),
    end_line: Math.min(lines.length, hit.line_number + contextLines),
  }));
  const slices = [];
  for (const range of ranges.sort((a, b) => a.start_line - b.start_line)) {
    const previous = slices.at(-1);
    if (previous !== undefined && range.start_line <= previous.end_line + 1)
      previous.end_line = Math.max(previous.end_line, range.end_line);
    else slices.push({ ...range });
  }
  return {
    status: unmappedSites.length || fn.error !== null ? "partial" : "ok",
    native_error: fn.error,
    entry,
    reference_sites: [...sites],
    unmapped_reference_sites: unmappedSites,
    exact_mapped_lines: hits.map((row) => row.line_number),
    total_lines: lines.length,
    total_characters: fn.code.length,
    slices: slices.map((range) => ({
      ...range,
      text: lines.slice(range.start_line - 1, range.end_line).join("\n"),
    })),
    coverage: {
      status: "partial",
      reason:
        "Selected text around exact mapped sites; not a proof that every relevant guard or data dependency is included.",
    },
    limitations: [
      "Single-function engine reconstruction, not original source.",
      "Printer line mappings are derived and do not prove runtime reachability.",
      "Complete native body and mappings remain in the retained source document.",
    ],
  };
};
