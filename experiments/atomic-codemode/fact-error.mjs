import { projectAnalysisError } from "../../dist/domain/analysisErrorProjection.js";

// Shared expected-failure algebra; execution adapters do not depend on native protocols.
export class FactFailure extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export const requireResult = (result, code = "provider_failure") => {
  if (!result.ok) {
    const failure = result.error?._tag
      ? projectAnalysisError(result.error)
      : result.error;
    throw new FactFailure(
      failure?.code ?? code,
      String(failure?.message ?? failure?.reason ?? failure),
      { failure },
    );
  }
  return result.value;
};
