// Bind a streaming decoder's validated facts to the raw bytes owned by the capture.
import {
  FactFailure,
  projectFactFailure,
  requireResult,
} from "./fact-error.mjs";
import { freezeFacts } from "./fact-reads.mjs";

export function requireNativeCaptureFacts(capture) {
  try {
    const facts = requireResult(capture.parsed, "invalid_provider_output");
    if (
      facts.sha256 !== capture.source.sha256 ||
      facts.bytes !== capture.source.bytes
    )
      throw new FactFailure(
        "invalid_provider_output",
        "Parsed facts and retained source identities disagree",
      );
    return freezeFacts(facts);
  } catch (cause) {
    const failure = projectFactFailure(cause, "invalid_provider_output");
    throw new FactFailure(failure.code, failure.message, {
      ...failure.details,
      evidence_id: capture.source.evidence_id,
      source_retained: true,
    });
  }
}
