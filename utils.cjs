// @ts-check

/**
 * Statically cast the type of a value to `any`.
 *
 * It is only used to make TS happy.
 * @param {unknown} value The value
 * @returns {*}
 */
const castAny = (value) => value;
/**
 * Statically cast the type of a value to `unknown`.
 *
 * It is only used to make TS happy.
 * @param {unknown} value The value
 * @returns {unknown}
 */
const castUnknown = (value) => value;
/**
 * Statically cast the type of a value to `never`.
 *
 * It is only used to make TS happy.
 * @param {unknown} value The value
 * @returns {never}
 */
const castNever = (value) => /** @type {never} */ (value);

/**
 * Statically cast that the type of a value is not `null` or `undefined`.
 *
 * It is only used to make TS happy.
 * @template T
 * @param {T} value
 * @returns {NonNullable<T>}
 */
const nonNullish = (value) => /** @type {NonNullable<T>} */ (value);

/**
 * Pin a value to its type (like `as const`).
 *
 * It is only used to make TS happy.
 * @type {<const T>(value: T) => T}
 */
const pin = (value) => value;

/**
 * Get a global variable.
 * @template {keyof typeof global | (string & {})} K
 * @param {K} name
 * @returns {K extends keyof typeof global ? typeof global[K] : unknown}
 */
const getGlobalVar = (name) => global[/** @type {keyof typeof global} */ (name)];
/**
 * Set a global variable.
 * @template {keyof typeof global | (string & {})} K
 * @param {K} name
 * @param {K extends keyof typeof global ? typeof global[K] : unknown} value
 */
const setGlobalVar = (name, value) => Object.defineProperty(global, name, { value });

/**
 * Create a CSS string template (Alias of `String.raw`).
 * @param {{ raw: readonly string[] | ArrayLike<string> }} template
 * @param  {...unknown} substitutions
 * @returns
 */
const css = (template, ...substitutions) => String.raw(template, ...substitutions);

/**
 * Register CSS to global context.
 * @param {string} css
 */
const registerCSS = (css) => {
  const style = document.createElement("style");
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
};

/**
 * Debounce a function.
 * @template {(...args: any[]) => unknown} T
 * @param {T} fn
 * @param {number} delay
 * @returns {(...args: Parameters<T>) => void}
 */
const debounce = (fn, delay) => {
  /** @type {ReturnType<typeof setTimeout>} */
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Slice text by range.
 * @template {boolean} [ReturnRows = false]
 * @param {string} text
 * @param {{ start: { line: number; character: number }; end: { line: number; character: number } }} range
 * @param {"\r\n" | "\n" | "\r"} [eol]
 * @param {ReturnRows} [returnRows]
 * @returns {ReturnRows extends true ? string[] : string}
 */
const sliceTextByRange = (text, range, eol = "\n", returnRows) => {
  const { start, end } = range;
  returnRows = /** @type {ReturnRows} */ (returnRows ?? false);
  const lines = text.split(eol);
  const startLine = nonNullish(lines[start.line]).slice(start.character);
  if (start.line === end.line)
    return /** @type {ReturnRows extends true ? string[] : string} */ (
      returnRows ? [startLine] : startLine
    );

  const endLine = nonNullish(lines[end.line]).slice(0, end.character);

  if (returnRows)
    return /** @type {ReturnRows extends true ? string[] : string} */ ([
      startLine,
      ...lines.slice(start.line + 1, end.line),
      endLine,
    ]);
  else
    return /** @type {ReturnRows extends true ? string[] : string} */ (
      [startLine, ...lines.slice(start.line + 1, end.line), endLine].join(eol)
    );
};
/**
 * Replace `text` in `range` with `newText`.
 * @param {string} text
 * @param {{ start: { line: number; character: number }; end: { line: number; character: number } }} range
 * @param {string} newText
 * @param {"\r\n" | "\n" | "\r"} [eol]
 */
const replaceTextByRange = (text, range, newText, eol = "\n") => {
  const { start, end } = range;
  const lines = text.split(eol);
  const startLine = nonNullish(lines[start.line]);

  if (start.line === end.line)
    return [
      ...lines.slice(0, start.line),
      startLine.slice(0, start.character) + newText + startLine.slice(end.character),
      ...lines.slice(end.line + 1),
    ].join(eol);

  const endLine = nonNullish(lines[end.line]);
  return [
    ...lines.slice(0, start.line),
    startLine.slice(0, start.character) + newText,
    ...lines.slice(start.line + 1, end.line),
    endLine.slice(end.character),
  ].join(eol);
};

module.exports = {
  castAny,
  castUnknown,
  castNever,
  nonNullish,
  pin,

  getGlobalVar,
  setGlobalVar,

  css,
  registerCSS,

  debounce,

  sliceTextByRange,
  replaceTextByRange,
};
