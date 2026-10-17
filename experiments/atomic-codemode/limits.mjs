// Shared application resource policy, independent of native wire formats.
export const MAX_RETAINED_SOURCE_BYTES = 64 * 1024 * 1024;
export const NATIVE_OUTPUT_BYTES = 8 * 1024 * 1024;
export const MAX_BRIDGE_BYTES = 2 * 1024 * 1024;
// The observed client clips oversized MCP results. Bound this profile's tool
// result body, including escaped text; JSON-RPC/client framing is separate.
export const MAX_MCP_RESULT_BYTES = 1024 * 1024;
// Aggregate selected bytes keep hex at 128 KiB, with headroom for provenance.
export const MAX_BYTE_BATCH_BYTES = 64 * 1024;

// Shared execution defaults/resource bounds and MCP timeout admission policy.
const executionWallMs = 120_000;
export const EXECUTION_LIMITS = Object.freeze({
  execution_heap_mib: 64,
  execution_stack_bytes: 512 * 1024,
  execution_cpu_ms: 2000,
  timeout_ms: Object.freeze({
    minimum: 100,
    maximum: executionWallMs,
    default: executionWallMs,
  }),
  code_utf8_bytes: 32768,
  output_utf8_bytes: 32768,
  max_host_calls: 64,
});
