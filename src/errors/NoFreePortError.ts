/**
 * Error thrown when no free port is found.
 */
export class NoFreePortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoFreePortError";
  }
}
