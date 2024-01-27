/**
 * Error thrown when a platform is not supported.
 */
export class PlatformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformError";
  }
}
