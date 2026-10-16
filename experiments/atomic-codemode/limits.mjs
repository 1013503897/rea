// Shared application resource policy, independent of native wire formats.
export const NATIVE_OUTPUT_BYTES = 8 * 1024 * 1024;
export const MAX_BRIDGE_BYTES = 2 * 1024 * 1024;
// Aggregate selected bytes keep hex at 128 KiB, with headroom for provenance.
export const MAX_BYTE_BATCH_BYTES = 64 * 1024;
