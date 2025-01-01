//////////////////////////////////////////////////
/// Global patches for Typora to make TS happy ///
//////////////////////////////////////////////////

// The same function as `@/utils/tools`
// Defined here instead of importing to ensure the following code executes
// before any other code.
const setGlobalVar = <K extends keyof typeof globalThis | (string & NonNullable<unknown>)>(
  name: K,
  value: K extends keyof typeof globalThis ? (typeof globalThis)[K] : unknown,
) => {
  try {
    Object.defineProperty(global, name, { value });
  } catch {
    Object.defineProperty(globalThis, name, { value });
  }
};

// Typora extends `window.File` with additional properties (e.g., `File.editor`).
// In a pure JS application, we could directly use `window.File`.
// However, in TS, these additional properties are not recognized by the type system.
// TS doesn’t allow direct modifications to the type of a global variable.
// As a workaround, we create an alias for the global variable and declare types for the alias.
// This is what we’re doing here.
setGlobalVar("Files", File as typeof Files);

// Similarly, create an alias for `window.Node`.
setGlobalVar("Nodes", Node as typeof Nodes);
