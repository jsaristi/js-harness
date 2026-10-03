/** An error of the resolver: `code` says what went wrong and `details` become properties of the error. */
export class ResolveError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ResolveError';
    this.code = code;
    Object.assign(this, details);
  }
}
