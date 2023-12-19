import { createLogger } from "./utils/logging";

/**
 * Logger used across the plugin.
 */
export const logger = createLogger({ prefix: `\x1b[1mCopilot plugin:\x1b[0m ` });
