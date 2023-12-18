import { getErrorCodeName } from "./lsp";
import { omit } from "./tools";

import type { integer } from "@/types/lsp";
import type { Merge, _Id } from "@/types/tools";

/**
 * Options for block logger.
 */
export interface SimpleLoggerOptions {
  /**
   * Prefix to display before the text.
   */
  prefix?: string;
}

/**
 * Create a simple logger that logs a message to the console.
 * @param options Options.
 * @returns
 */
export const createSimpleLogger = (options?: SimpleLoggerOptions) => {
  const { prefix = "" } = options ?? {};

  return {
    /**
     * Log a debug message to the console.
     * @param data Data to log.
     */
    debug: (...data: unknown[]) =>
      console.debug(
        ...(data.length > 0 && typeof data[0] === "string" ? [prefix + data[0]] : []),
        ...(data.length > 1 ? data.slice(1) : []),
      ),
    /**
     * Log a message to the console.
     * @param data Data to log.
     */
    info: (...data: unknown[]) =>
      console.log(
        ...(data.length > 0 && typeof data[0] === "string" ? [prefix + data[0]] : []),
        ...(data.length > 1 ? data.slice(1) : []),
      ),
    /**
     * Log a warning message to the console.
     * @param data Data to log.
     */
    warn: (...data: unknown[]) =>
      console.warn(
        ...(data.length > 0 && typeof data[0] === "string" ? [prefix + data[0]] : []),
        ...(data.length > 1 ? data.slice(1) : []),
      ),
    /**
     * Log an error message to the console.
     * @param data Data to log.
     */
    error: (...data: unknown[]) =>
      console.error(
        ...(data.length > 0 && typeof data[0] === "string" ? [prefix + data[0]] : []),
        ...(data.length > 1 ? data.slice(1) : []),
      ),

    /**
     * Overwrite `options` with new options.
     * @param overwriteOptions New options.
     */
    overwrite: (overwriteOptions: SimpleLoggerOptions) =>
      createSimpleLogger({ ...options, ...overwriteOptions }),
  };
};

/**
 * Prepare console block parameters.
 * @param options Options.
 * @returns
 */
const _prepareConsoleBlockParams = (options: {
  /**
   * Text to display.
   */
  text: string;
  /**
   * Prefix to display before the text.
   */
  prefix?: string;
  /**
   * Block background color.
   */
  color?: string;
  /**
   * Block text color.
   */
  textColor?: string;
}) => {
  const { color: backgroundColor = "gray", prefix = "", text, textColor = "white" } = options;

  return [
    "%c" + prefix + text,
    `background-color: ${backgroundColor}; color: ${textColor}; padding: 5px 10px; font-family: ''; font-weight: bold; width: 100%`,
  ];
};

/**
 * Options for block logger.
 */
type BlockLoggerOptions = Omit<
  Parameters<typeof _prepareConsoleBlockParams>[0],
  "text"
> extends infer U
  ? _Id<U>
  : never;

/**
 * Create a logger that logs a block-formatted message to the console.
 * @param options Options.
 * @returns
 */
export const createBlockLogger = (options?: BlockLoggerOptions) => ({
  /**
   * Log a block-formatted debug message to the console.
   * @param text Text to display.
   * @param data Data to log.
   */
  debug: (text: string, ...data: unknown[]) =>
    console.debug(..._prepareConsoleBlockParams({ text, ...options }), ...data),

  /**
   * Log a block-formatted message to the console.
   * @param text Text to display.
   * @param data Data to log.
   */
  info: (text: string, ...data: unknown[]) =>
    console.log(..._prepareConsoleBlockParams({ text, ...options }), ...data),

  /**
   * Log a block-formatted warning message to the console.
   * @param text Text to display.
   * @param data Data to log.
   */
  warn: (text: string, ...data: unknown[]) =>
    console.warn(..._prepareConsoleBlockParams({ text, ...options }), ...data),

  /**
   * Log a block-formatted error message to the console.
   * @param text Text to display.
   * @param data Data to log.
   */
  error: (text: string, ...data: unknown[]) =>
    console.error(..._prepareConsoleBlockParams({ text, ...options }), ...data),

  /**
   * Overwrite `options` with new options.
   * @param overwriteOptions New options.
   */
  overwrite: (overwriteOptions: BlockLoggerOptions) =>
    createBlockLogger({ ...options, ...overwriteOptions }),
});

/**
 * A logger that logs a message to the console.
 */
export type Logger = ReturnType<typeof createLogger>;

/**
 * Options for logger.
 */
export type LoggerOptions = Merge<SimpleLoggerOptions, { block?: BlockLoggerOptions }>;

/**
 * Create a logger that logs a message to the console.
 * @param options
 * @returns
 */
export const createLogger = (options?: LoggerOptions) =>
  Object.assign(createSimpleLogger(options), {
    block: createBlockLogger({ ...(options ? omit(options, "block") : {}), ...options?.block }),
  });

/**
 * Format request ID for logging.
 * @param id
 * @returns
 *
 * @example
 * ```javascript
 * formatId(1); // => "[1] "
 * formatId("abc"); // => "[abc] "
 * formatId(null); // => ""
 * ```
 */
export const formatId = (id: (integer | string) | null) => (id !== null ? `[${id}] ` : "");
/**
 * Format method name for logging.
 * @param method
 * @returns
 *
 * @example
 * ```javascript
 * formatMethod("initialize"); // => "initialize"
 * formatMethod(null); // => "Anonymous"
 * ```
 */
export const formatMethod = (method: string | null) => method ?? "Anonymous";
/**
 * Format error code for logging.
 * @param code
 * @returns
 *
 * @example
 * ```javascript
 * formatErrorCode(-32601); // => "-32601 (MethodNotFound)"
 * formatErrorCode(123); // => "123"
 * ```
 */
export const formatErrorCode = (code: integer) => {
  const name = getErrorCodeName(code) ?? "";
  return code + (name ? ` (${name})` : "");
};
