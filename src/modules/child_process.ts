import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { logger } from "@/logging";
import { File, waitUntilEditorInitialized } from "@/typora-utils";

/**
 * Parse Node version string to number array.
 * @param version Node version string, e.g. `"v14.17.6"`.
 * @returns A number array, e.g. `[14, 17, 6]`.
 */
const parseNodeVersion = (version: string): number[] =>
  (version.trim().startsWith("v") ? version.trim().slice(1) : version.trim())
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s)
    .map((s) => Number.parseInt(s));

/**
 * Start a Node process with the given module path. Stdio is enabled.
 * @returns A Node process with stdio enabled.
 */
export const forkNode: (modulePath: string) => ChildProcessWithoutNullStreams = (() => {
  if (File.isNode) {
    const { fork, spawn, spawnSync } = window.reqnode!("child_process");

    // Check Node version
    const nodeVersion = parseNodeVersion(process.version);
    if (nodeVersion[0]! >= 18)
      return (modulePath) =>
        fork(modulePath, [], { silent: true }) as ChildProcessWithoutNullStreams;

    // For Node < 18, use Node from shell
    logger.warn("Detected bundled Node version < 18, try using Node from shell instead.");

    // Check Node version
    const { stderr, stdout } = spawnSync("node", ["-v"]);
    if (stdout === null) {
      const errorMessage =
        "Node not found in shell, please install Node >= 18 or use Typora >= 1.6";
      logger.error(`${errorMessage}.`, ...(stderr ? ["Error:", stderr?.toString("utf-8")] : []));

      void waitUntilEditorInitialized().then(() => {
        File.editor!.EditHelper.showDialog({
          title: "Typora Copilot: Node.js is required under Typora < 1.6",
          type: "error",
          html: /* html */ `
            <div style="text-align: center; margin-top: 8px;">
              <p>Node.js >= 18 or Typora >= 1.6 is required to run this plugin.</p>
              <p>The current Typora version is <code>${window._options.appVersion}</code>.</p>
              <p>
                Either install <a href="https://nodejs.org/en/download/" target="_blank">Node.js</a>
                >= 18 or upgrade <a href="https://typora.io/#download" target="_blank">Typora</a> to
                >= 1.6.
              </p>
            </div>
          `,
          buttons: ["I understand"],
        });
      });

      throw new Error(errorMessage);
    }
    const shellNodeVersion = stdout.toString().trim();
    if (parseNodeVersion(shellNodeVersion)[0]! < 18) {
      const errorMessage =
        `Node version from shell is < 18 (${shellNodeVersion}), ` +
        "please install Node >= 18 or use Typora >= 1.6 to use this plugin";
      logger.error(errorMessage + ".");

      void waitUntilEditorInitialized().then(() => {
        File.editor!.EditHelper.showDialog({
          title: "Typora Copilot: Node.js >= 18 is required under Typora < 1.6",
          type: "error",
          html: /* html */ `
            <div style="text-align: center; margin-top: 8px;">
              <p>Node.js >= 18 or Typora >= 1.6 is required to run this plugin.</p>
              <P>The current Typora version is <code>${window._options.appVersion}</code>.</p>
              <p>The current Node version is <code>${shellNodeVersion}</code>.</p>
              <p>
                Either install <a href="https://nodejs.org/en/download/" target="_blank">Node.js</a>
                >= 18 or upgrade <a href="https://typora.io/#download" target="_blank">Typora</a> to
                >= 1.6.
              </p>
            </div>
          `,
          buttons: ["I understand"],
        });
      });

      throw new Error(errorMessage);
    }

    logger.info(`Detected Node ${shellNodeVersion} from shell, using it to start language server.`);

    return (modulePath) => spawn("node", [modulePath]);
  }

  throw new Error("child_process is not supported in browser");
})();

export type * from "node:child_process";
