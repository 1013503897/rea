// Both the session and diagnostic profiler keep descriptor ownership on failed open.
import {
  createKunaFileCloseScope,
  inspectKunaInstallation,
} from "../../dist/kuna/KunaInstallation.js";
import { kunaFileCleanupError } from "../../dist/kuna/KunaCommand.js";
import { RegularFileCleanupFailure } from "../../dist/filesystem/OwnedRegularFile.js";
import { requireResult } from "./fact-error.mjs";

export const inspectNativeInstallation = async (
  environment,
  resources,
  signal,
) => {
  const files = createKunaFileCloseScope({
    retain: (owner, resource) =>
      resources.retain({
        kind: "lease",
        resource,
        lease: { release: () => owner.close() },
      }),
    run: (operation) => resources.run(operation),
  });
  try {
    return requireResult(
      await inspectKunaInstallation(environment, {
        signal,
        fileCloseResources: files.owner,
      }),
      "provider_unavailable",
    );
  } catch (cause) {
    if (!(cause instanceof RegularFileCleanupFailure)) throw cause;
    const error = kunaFileCleanupError(cause, "experiment:atomic-open", signal);
    files.bindFailure(cause, error);
    return requireResult({ ok: false, error });
  }
};
