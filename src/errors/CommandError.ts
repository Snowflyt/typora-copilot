/**
 * Error thrown when a command execution fails.
 */
export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandError";
  }
}
