// Architecture metadata contracts use the same registry through every adapter.
import { z } from "zod";
import { definition, page, valueLocation } from "./api-contracts.mjs";
export const storageMethods = {
  spaces: definition(
    {
      summary:
        "Select native address-space descriptors by name/index, including byte order, address units and offset bounds; no function analysis.",
      description:
        "Inspect the leased artifact's bootstrapped native architecture spaces. Native indices are scoped to this model; use them only for an explicitly identified native space-selector operand, not arbitrary constants. Name/index filters intersect; indices set caller order, otherwise names set caller order, otherwise native order. Missing names/indices are reported before filters/paging. Returns native kind, address size, addressable-unit bytes, endianness and highest byte offset, with architecture identity/counts and complete retained catalog Evidence. Descriptors are not runtime memory, valid pointers, stack rebasing or dynamic join records. Uses embedded specs, disables listing discovery and decompiles no function. One bounded immutable catalog is shared per lease with registers; no cross-lease/live-state cache. Requires the experimental storage-map engine capability.",
    },
    {
      names: z.array(z.string()).max(128).optional(),
      indices: z.array(z.number().int().nonnegative()).max(128).optional(),
      fields: z
        .array(
          z.enum([
            "kind",
            "address_size_bytes",
            "addressable_unit_bytes",
            "endianness",
            "highest_offset",
          ]),
        )
        .optional(),
      ...page,
    },
    "spaces",
    "await rea.spaces({indices:[spaceSelector]})",
  ),
  registers: definition(
    {
      summary:
        "Select exact native register names/coordinates in batches; widths and spaces matter, unmatched slices are not storage absence.",
      description:
        "Select the bootstrapped native varnode_xref register-name map by exact locations, exact names or optional name substring search. Filters intersect. Locations deduplicate in caller order; otherwise names deduplicate in caller order, preserving native row order for each name; otherwise native order. Exact names are case-sensitive; query uses case_sensitive. Missing locations/names are determined before other filters, not proof of absent hardware storage, aliases or values. No containing-register substitution, subregister/alias inference, SSA equality or runtime availability claim. Null spaces stay unknown; undecodable native names retain raw bytes. Native row plus Evidence identifies an occurrence. Architecture/counts/coverage and complete source are retained; the same bounded per-lease catalog powers spaces, with no function decompilation or cross-lease reuse.",
    },
    {
      locations: z.array(valueLocation).max(128).optional(),
      names: z.array(z.string()).max(128).optional(),
      query: z.string().default(""),
      case_sensitive: z.boolean().default(false),
      fields: z.array(z.enum(["name", "name_bytes_hex"])).optional(),
      ...page,
    },
    "registers",
    'await rea.registers({locations:[{space:"register",offset:"0x38",size_bytes:8}]})',
  ),
};
