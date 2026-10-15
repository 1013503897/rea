import { requireWindowsWindowCaptureAuthority } from "./WindowsNativeLoader.js";
import {
  nativeWindowsCaptureSchema,
  windowsCaptureFailureSchema,
  windowsCaptureRequestSchema,
} from "./WindowsWindowCaptureProtocol.js";

// PrintWindow is synchronous and has no timeout API. Only this owned helper
// calls it; the parent can terminate its Job Object without blocking the server
// or leaving a detached native thread/surface in the long-lived REA process.
try {
  const encoded = process.argv[2];
  if (encoded === undefined) throw new Error("Missing capture request");
  const value: unknown = JSON.parse(encoded);
  const input = windowsCaptureRequestSchema.parse(value);
  const authority = requireWindowsWindowCaptureAuthority();
  const { png, ...capture } = nativeWindowsCaptureSchema.parse(
    authority.call("capture_window_png", [
      input.pid,
      input.window_handle,
      input.max_dimension,
      input.target_path,
      input.target_sha256,
      input.target_file_identity,
    ]),
  );
  process.stdout.write(
    JSON.stringify({
      ok: true,
      capture: { ...capture, png_base64: png.toString("base64") },
    }),
  );
} catch (cause: unknown) {
  const failure = windowsCaptureFailureSchema.safeParse(cause);
  process.stdout.write(
    JSON.stringify({
      ok: false,
      message: cause instanceof Error ? cause.message : String(cause),
      failure: failure.success ? failure.data : null,
    }),
  );
}
