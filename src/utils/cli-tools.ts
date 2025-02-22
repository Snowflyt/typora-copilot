import { CommandError, NoFreePortError, PlatformError } from "@/errors";
import type { ReadonlyRecord } from "@/types/tools";

/**
 * Run a command from shell and return its output.
 * @param command Command to run.
 * @returns
 * @throws {CommandError} If the command fails.
 */
export const runCommand = (() => {
  if (Files.isNode) {
    const { exec } = window.reqnode!("child_process");

    return async function runCommand(command: string, options?: { cwd?: string }): Promise<string> {
      const { cwd } = options ?? {};

      return new Promise((resolve, reject) => {
        exec(command, { cwd }, (error, stdout, stderr) => {
          if (error) reject(error);
          else if (stderr) reject(new CommandError(stderr));
          else resolve(stdout);
        });
      });
    };
  }

  if (Files.isMac)
    return async function runCommand(command: string, options?: { cwd?: string }): Promise<string> {
      const { cwd } = options ?? {};

      return new Promise((resolve, reject) => {
        window.bridge!.callHandler(
          "controller.runCommand",
          { args: command, ...(cwd ? { cwd } : {}) },
          ([success, stdout, stderr]) => {
            if (success) resolve(stdout);
            else reject(new CommandError(stderr));
          },
        );
      });
    };

  throw new PlatformError("Unsupported platform for `runCommand`");
})();

/**
 * Get the environment variables.
 * @returns
 */
export const getEnv: () => Promise<ReadonlyRecord<string, string | undefined>> = (() => {
  if (Files.isNode)
    // eslint-disable-next-line @typescript-eslint/require-await
    return async function getEnv() {
      return process.env;
    };

  if (Files.isMac) {
    let cache:
      | ReadonlyRecord<string, string | undefined>
      | Promise<ReadonlyRecord<string, string | undefined>>
      | null = null;
    return async function getEnv() {
      if (cache) return cache;
      cache = runCommand("printenv")
        .then((output) =>
          output
            .trim()
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        )
        .then((lines) => {
          const env: Record<string, string | undefined> = {};
          for (const line of lines) {
            const [key, value] = line.split("=");
            env[key!] = value;
          }
          return env;
        })
        .catch(() => ({}));
      return cache;
    };
  }

  throw new PlatformError("Unsupported platform for `getEnv`");
})();

/**
 * Find a free localhost port.
 *
 * **⚠️ Warning:** This function only works on macOS and Linux.
 * @throws {NoFreePortError} If no free port is found.
 * @returns
 */
export const findFreePort = async (startAt = 6190): Promise<number> => {
  const command = /* sh */ `
    for port in {${startAt}..${startAt + 100 > 65535 ? 65535 : startAt + 100}}; do
      nc -z localhost $port &>/dev/null || { echo $port; break; }
    done
  `;
  const output = await runCommand(command);
  const port = Number.parseInt(output.trim());
  if (Number.isNaN(port)) throw new NoFreePortError("Cannot find free port");
  return port;
};
