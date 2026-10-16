// Shared expected-failure algebra; execution adapters do not depend on native protocols.
export class FactFailure extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
