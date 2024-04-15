import * as path from "./path";

import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { PLUGIN_DIR } from "@/constants";
import { logger } from "@/logging";
import { File, findFreePort, runShellCommand, waitUntilEditorInitialized } from "@/typora-utils";
import { wrapNodeChildProcess } from "@/utils/server";

export interface NodeServer {
  readonly pid: number;

  readonly send: (message: string) => void;
  readonly onMessage: (listener: (message: string) => void) => void;
}

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
 * Start a Node process with the given module path.
 * @returns A Node server that can send and receive messages.
 */
export const forkNode: (modulePath: string) => Promise<NodeServer> = (() => {
  if (File.isNode) {
    const { fork, spawn, spawnSync } = window.reqnode!("child_process");

    // Check Node version
    const nodeVersion = parseNodeVersion(process.version);
    if (nodeVersion[0]! >= 18)
      return (modulePath) =>
        Promise.resolve(
          wrapNodeChildProcess(
            fork(modulePath, [], { silent: true }) as ChildProcessWithoutNullStreams,
          ),
        );

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
          // eslint-disable-next-line sonarjs/no-duplicate-string
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

    return (modulePath) => Promise.resolve(wrapNodeChildProcess(spawn("node", [modulePath])));
  }

  if (File.isMac) {
    let initialized = false;
    let initializeFailed = false;

    let nodePath = "node";

    void (async () => {
      let shellNodeVersion = "";
      try {
        shellNodeVersion = await runShellCommand("node -v");
      } catch (err) {
        // Detect if NVM is installed
        const nvmExists =
          (
            await runShellCommand(`
          if [ -f ~/.nvm/nvm.sh ]; then
            echo "true";
          else
            echo "false";
          fi
        `)
          ).trim() === "true";
        const availableVersions =
          nvmExists ?
            (await runShellCommand("ls ~/.nvm/versions/node"))
              .split(/\s+/)
              .filter((s) => s)
              .map((s) => (s.endsWith("/") ? s.slice(0, -1) : s))
          : [];
        if (nvmExists && availableVersions.length > 0) {
          availableVersions.sort((a, b) => {
            const aVersion = parseNodeVersion(a);
            const bVersion = parseNodeVersion(b);
            if (aVersion[0] !== bVersion[0]) return bVersion[0]! - aVersion[0]!;
            if (aVersion[1] !== bVersion[1]) return bVersion[1]! - aVersion[1]!;
            return bVersion[2]! - aVersion[2]!;
          });
          shellNodeVersion = availableVersions[0]!;
          nodePath = `~/.nvm/versions/node/${shellNodeVersion}/bin/node`;
        } else {
          const errorMessage = "Node not found in shell, please install Node >= 18";
          logger.error(`${errorMessage}.`, ...(err ? ["Error:", err] : []));

          void waitUntilEditorInitialized().then(() => {
            File.editor!.EditHelper.showDialog({
              title: "Typora Copilot: Node.js is required on macOS",
              type: "error",
              html: /* html */ `
              <div style="text-align: center; margin-top: 8px;">
                <p>Node.js >= 18 is required to run this plugin.</p>
                <p>
                  Please install <a href="https://nodejs.org/en/download/" target="_blank">Node.js</a>
                  >= 18 and restart Typora to use this plugin.
                </p>
              </div>
            `,
              buttons: ["I understand"],
            });
          });

          throw new Error(errorMessage);
        }
      }

      if (parseNodeVersion(shellNodeVersion)[0]! < 18) {
        const errorMessage =
          `Node version from shell is < 18 (${shellNodeVersion}), ` +
          "please install Node >= 18 to use this plugin";
        logger.error(errorMessage + ".");

        void waitUntilEditorInitialized().then(() => {
          File.editor!.EditHelper.showDialog({
            title: "Typora Copilot: Node.js >= 18 is required",
            type: "error",
            html: /* html */ `
              <div style="text-align: center; margin-top: 8px;">
                <p>Node.js >= 18 is required to run this plugin.</p>
                <p>
                  Please install <a href="https://nodejs.org/en/download/" target="_blank">Node.js</a>
                  >= 18 and restart Typora to use this plugin.
                </p>
              </div>
            `,
            buttons: ["I understand"],
          });
        });

        throw new Error(errorMessage);
      }

      logger.info(
        `Detected Node ${shellNodeVersion} from shell, using it to start language server.`,
      );

      initialized = true;
    })().catch((err) => {
      initializeFailed = true;
      throw err;
    });

    return (modulePath) =>
      new Promise((resolve, reject) => {
        const interval = setInterval(() => {
          if (initializeFailed) {
            clearInterval(interval);
            return;
          }

          if (initialized) {
            clearInterval(interval);

            void (async () => {
              const port = await findFreePort();

              const serverExecPath = path.join(PLUGIN_DIR, "mac-server.cjs");
              const logFileName = ".typora-copilot-lsp-sever-output.log";
              const command = `nohup ${nodePath} '${serverExecPath}' ${port} '${modulePath}' > ~/${logFileName} 2>&1 &`;
              void runShellCommand(command);

              const getPID = () =>
                new Promise<number>((resolve, reject) => {
                  let times = 0;
                  const go = async () => {
                    const pid = Number.parseInt(
                      await runShellCommand(`lsof -t -i:${port} | tail -n 1`),
                    );
                    if (Number.isNaN(pid)) {
                      if (times > 50) {
                        reject(new Error("Failed to start Node LSP server"));
                      } else {
                        setTimeout(() => void go(), 100);
                        times++;
                      }
                    } else resolve(pid);
                  };
                  void go();
                });

              const pid = await getPID();

              const client = new WebSocket(`ws://localhost:${port}`);
              client.onopen = () => {
                const listeners: ((message: string) => void)[] = [];

                client.onmessage = (event) => {
                  listeners.forEach((listener) => listener(event.data as string));
                };

                resolve({
                  pid,

                  send: (message) => {
                    client.send(message);
                  },
                  onMessage: (listener) => {
                    listeners.push(listener);
                  },
                });
              };
            })().catch(reject);
          }
        }, 100);
      });
  }

  throw new Error("`child_process` is not supported in your platform");
})();

export type * from "node:child_process";
