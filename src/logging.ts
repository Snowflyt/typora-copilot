import { createLogger } from "./utils/logging";

/**
 * Logger used across the plugin.
 */
export const logger = createLogger({
  prefix: `%cCopilot plugin:%c `,
  styles: ["font-weight: bold", "font-weight: normal"],
});
