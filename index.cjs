// @ts-check

window.addEventListener("DOMContentLoaded", () => {
  const require = /** @type {{ reqnode: NodeRequire }} */ (/** @type {unknown} */ (global)).reqnode;

  const path = require("node:path");

  const copilotDir = path.join(
    /** @type {{ dirname?: string }} */ (/** @type {unknown} */ (global)).dirname ??
      global.__dirname,
    "copilot"
  );
  /** @type {{ __copilotDir: string }} */ (/** @type {unknown} */ (global)).__copilotDir =
    copilotDir;

  require(path.join(copilotDir, "setup.cjs"));
});
