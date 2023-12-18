/* eslint-disable @typescript-eslint/consistent-type-imports */

import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { logger } from "@/logging";
import { File, waitUntilEditorInitialized } from "@/typora-utils";

export const forkNode: (modulePath: string) => ChildProcessWithoutNullStreams = (() => {
  const nodeFork = window.reqnode?.("child_process")?.fork;
  if (nodeFork) {
    // Check Node version
    const nodeVersion = window.process.version
      .split("v", 2)[1]!
      .split(".")
      .map((s) => s.trim())
      .filter((s) => s);
    if (Number.parseInt(nodeVersion[0]!) >= 18)
      return (modulePath) =>
        nodeFork(modulePath, [], { silent: true }) as ChildProcessWithoutNullStreams;

    // For Node < 18, use Node from shell
    logger.warn("Detected bundled Node version < 18, try using Node from shell instead.");
    const { spawn, spawnSync } = window.reqnode!("child_process");

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
    if (Number.parseInt(shellNodeVersion.split("v", 2)[1]!.split(".")[0]!) < 18) {
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
