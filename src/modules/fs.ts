import { unique } from "radash";

import * as path from "./path";

import type fs from "node:fs";

import { PlatformError } from "@/errors";
import { getEnv, runCommand } from "@/utils/cli-tools";

export const constants = {
  // File Access Constants
  /** Constant for `fs.access()`. File is visible to the calling process. */
  F_OK: 0,
  /** Constant for `fs.access()`. File can be read by the calling process. */
  R_OK: 4,
  /** Constant for `fs.access(). File can be written by the calling process. */
  W_OK: 2,
  /** Constant for `fs.access()`. File can be executed by the calling process. */
  X_OK: 1,
} as const satisfies Partial<typeof fs.constants>;

/**
 * Tests a user's permissions for the file or directory specified by `path`, and returns the
 * resolved path if the accessibility check is successful, or `null` if any of the checks fail.
 *
 * The `mode` argument is an optional integer that specifies the accessibility checks to be
 * performed. `mode` should be either the value `fs.constants.F_OK` or a mask consisting of the
 * bitwise OR of any of `fs.constants.R_OK`, `fs.constants.W_OK`, and `fs.constants.X_OK`
 * (e.g.`fs.constants.W_OK | fs.constants.R_OK`). Check `File access constants` for possible values
 * of `mode`.
 * @param [mode=fs.constants.F_OK]
 * @returns
 */
export const access: (path: string, mode?: number) => Promise<string | null> = (() => {
  if (Files.isNode) {
    const fs = window.reqnode!("fs");

    return async function access(path, mode = constants.F_OK) {
      return new Promise((resolve) =>
        fs.access(path, mode, (err) => {
          if (err) return resolve(null);
          resolve(path);
        }),
      );
    };
  }

  if (Files.isMac)
    return async function access(path, mode = constants.F_OK) {
      const command = (() => {
        switch (mode) {
          case constants.F_OK:
            return `if [ -e "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK:
            return `if [ -r "${path}" ]; then echo "${path}"; fi`;
          case constants.W_OK:
            return `if [ -w "${path}" ]; then echo "${path}"; fi`;
          case constants.X_OK:
            return `if [ -x "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK | constants.W_OK:
            return `if [ -r "${path}" ] && [ -w "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK | constants.X_OK:
            return `if [ -r "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          case constants.W_OK | constants.X_OK:
            return `if [ -w "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK | constants.W_OK | constants.X_OK:
            return `if [ -r "${path}" ] && [ -w "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          default:
            throw new Error(`Invalid mode for \`access\`: ${mode}`);
        }
      })();

      return (await runCommand(command)).trim() || null;
    };

  throw new PlatformError("Unsupported platform for `access`");
})();

/**
 * Tests a user's permissions for the file specified by `path`, and returns the
 * resolved path if the accessibility check is successful, or `null` if any of the checks fail.
 *
 * The `mode` argument is an optional integer that specifies the accessibility checks to be
 * performed. `mode` should be either the value `fs.constants.F_OK` or a mask consisting of the
 * bitwise OR of any of `fs.constants.R_OK`, `fs.constants.W_OK`, and `fs.constants.X_OK`
 * (e.g.`fs.constants.W_OK | fs.constants.R_OK`). Check `File access constants` for possible values
 * of `mode`.
 * @param [mode=fs.constants.F_OK]
 * @returns
 */
export const accessFile: (path: string, mode?: number) => Promise<string | null> = (() => {
  if (Files.isNode) {
    const fs = window.reqnode!("fs");

    return async function accessFile(path, mode = constants.F_OK) {
      return new Promise((resolve) =>
        fs.access(path, mode, (err) => {
          if (err) return resolve(null);
          fs.stat(path, (err, stats) => {
            if (err) return resolve(null);
            if (stats.isFile()) resolve(path);
            else resolve(null);
          });
        }),
      );
    };
  }

  if (Files.isMac)
    return async function accessFile(path, mode = constants.F_OK) {
      const command = (() => {
        switch (mode) {
          case constants.F_OK:
            return `if [ -f "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK:
            return `if [ -f "${path}" ] && [ -r "${path}" ]; then echo "${path}"; fi`;
          case constants.W_OK:
            return `if [ -f "${path}" ] && [ -w "${path}" ]; then echo "${path}"; fi`;
          case constants.X_OK:
            return `if [ -f "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK | constants.W_OK:
            return `if [ -f "${path}" ] && [ -r "${path}" ] && [ -w "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK | constants.X_OK:
            return `if [ -f "${path}" ] && [ -r "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          case constants.W_OK | constants.X_OK:
            return `if [ -f "${path}" ] && [ -w "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK | constants.W_OK | constants.X_OK:
            return `if [ -f "${path}" ] && [ -r "${path}" ] && [ -w "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          default:
            throw new Error(`Invalid mode for \`accessFile\`: ${mode}`);
        }
      })();

      return (await runCommand(command)).trim() || null;
    };

  throw new PlatformError("Unsupported platform for `accessFile`");
})();

/**
 * Tests a user's permissions for the directory specified by `path`, and returns the
 * resolved path if the accessibility check is successful, or `null` if any of the checks fail.
 *
 * The `mode` argument is an optional integer that specifies the accessibility checks to be
 * performed. `mode` should be either the value `fs.constants.F_OK` or a mask consisting of the
 * bitwise OR of any of `fs.constants.R_OK`, `fs.constants.W_OK`, and `fs.constants.X_OK`
 * (e.g.`fs.constants.W_OK | fs.constants.R_OK`). Check `File access constants` for possible values
 * of `mode`.
 * @param [mode=fs.constants.F_OK]
 * @returns
 */
export const accessDir: (path: string, mode?: number) => Promise<string | null> = (() => {
  if (Files.isNode) {
    const fs = window.reqnode!("fs");

    return async function accessDir(path, mode = constants.F_OK) {
      return new Promise((resolve) =>
        fs.access(path, mode, (err) => {
          if (err) return resolve(null);
          fs.stat(path, (err, stats) => {
            if (err) return resolve(null);
            if (stats.isDirectory()) resolve(path);
            else resolve(null);
          });
        }),
      );
    };
  }

  if (Files.isMac)
    return async function accessDir(path, mode = constants.F_OK) {
      const command = (() => {
        switch (mode) {
          case constants.F_OK:
            return `if [ -d "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK:
            return `if [ -d "${path}" ] && [ -r "${path}" ]; then echo "${path}"; fi`;
          case constants.W_OK:
            return `if [ -d "${path}" ] && [ -w "${path}" ]; then echo "${path}"; fi`;
          case constants.X_OK:
            return `if [ -d "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK | constants.W_OK:
            return `if [ -d "${path}" ] && [ -r "${path}" ] && [ -w "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK | constants.X_OK:
            return `if [ -d "${path}" ] && [ -r "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          case constants.W_OK | constants.X_OK:
            return `if [ -d "${path}" ] && [ -w "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          case constants.R_OK | constants.W_OK | constants.X_OK:
            return `if [ -d "${path}" ] && [ -r "${path}" ] && [ -w "${path}" ] && [ -x "${path}" ]; then echo "${path}"; fi`;
          default:
            throw new Error(`Invalid mode for \`accessDir\`: ${mode}`);
        }
      })();

      return (await runCommand(command)).trim() || null;
    };

  throw new PlatformError("Unsupported platform for `accessDir`");
})();

/**
 * Given a possibly case-variant version of an existing filesystem path, returns the absolute,
 * case-exact, normalized version as stored in the filesystem.
 *
 * Modified from the [npm package `true-case-path`](https://www.npmjs.com/package/true-case-path):
 * <https://github.com/Profiscience/true-case-path/blob/8a016e6a8be64c873aba414fbcdb4748e24dc796/index.js>
 * @param filePath The path to resolve.
 * @param [basePath] The base path to use.
 * @returns The resolved path.
 * @throws {Error} If the file does not exist.
 */
export const trueCasePath: (filePath: string, basePath?: string) => Promise<string> = (() => {
  const delimiter = Files.isWin ? "\\" : "/";

  const getRelevantFilePathSegments = (filePath: string) =>
    filePath.split(delimiter).filter((s) => s !== "");

  const escapeString = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const matchCaseInsensitive = (
    fileOrDirectory: string,
    directoryContents: string[],
    filePath: string,
  ) => {
    const caseInsensitiveRegex = new RegExp(`^${escapeString(fileOrDirectory)}$`, "i");
    for (const file of directoryContents) if (caseInsensitiveRegex.test(file)) return file;
    throw new Error(`[true-case-path]: Called with ${filePath}, but no matching file exists`);
  };

  return async function trueCasePath(filePath, basePath) {
    if (basePath) {
      if (!path.isAbsolute(basePath))
        throw new Error(
          `[true-case-path]: basePath argument must be absolute. Received "${basePath}"`,
        );
      basePath = path.normalize(basePath);
    }
    filePath = path.normalize(filePath);
    const segments = getRelevantFilePathSegments(filePath);
    if (path.isAbsolute(filePath)) {
      if (basePath)
        throw new Error("[true-case-path]: filePath must be relative when used with basePath");
      basePath =
        Files.isWin ?
          segments.shift()?.toUpperCase() || "" // drive letter
        : "";
    } else if (!basePath) {
      basePath = process.cwd();
    }
    return await segments.reduce(
      async (realPathPromise, fileOrDirectory) =>
        (await realPathPromise) +
        delimiter +
        matchCaseInsensitive(
          fileOrDirectory,
          await readDir((await realPathPromise) + delimiter),
          filePath,
        ),
      basePath as string | Promise<string>,
    );
  };
})();

/**
 * [`realpath(3)`](http://man7.org/linux/man-pages/man3/realpath.3.html).
 *
 * The absolute and case-exact (if the filesystem is case-insensitive) path is returned, and
 * symbolic links are resolved.
 * @param path A file path.
 * @returns The resolved path, or `null` if the path does not exist.
 */
export const realpath: (path: string) => Promise<string | null> = (() => {
  if (Files.isNode) {
    const fs = window.reqnode!("fs");

    return async function realpath(path) {
      return new Promise((resolve) =>
        (Files.isWin ? fs.realpath.native : fs.realpath)(path, (err, resolvedPath) => {
          if (err) return resolve(null);
          resolve(resolvedPath);
        }),
      );
    };
  }

  if (Files.isMac)
    return async function realpath(path) {
      return (await runCommand(`realpath "${path}"`).catch(() => "")).trim() || null;
    };

  throw new PlatformError("Unsupported platform for `realpath`");
})();

/**
 * Check an array of possible executable file paths. The resolved paths are normalized and
 * case-exact path will be returned on Windows.
 *
 * If `addCommonExts` is `true`, common executable file extensions are appended to the paths.
 *
 * If `first` is `true`, the function will return the first resolved path, or `null` if none of the
 * paths match. Otherwise, the function will return an array of resolved paths.
 */
const _checkExecutableFilePaths: (
  paths: string[],
  { addCommonExts, first }: { addCommonExts: boolean; first: boolean },
) => Promise<string[] | string | null> = (() => {
  const COMMON_EXEC_EXTS = unique([
    "",
    ...((window.process && process.env["PATHEXT"]) || "").split(path.delimiter),
    ...(Files.isMac || Files.isLinux ? [".sh", ".bash"] : []),
  ]);

  if (Files.isWin)
    return async function checkExecutableFilePaths(paths, { addCommonExts, first }) {
      const processedPaths =
        addCommonExts ? paths.flatMap((path) => COMMON_EXEC_EXTS.map((ext) => path + ext)) : paths;

      if (first)
        return await Promise.orderedFirstResolved(
          processedPaths.map((path) =>
            accessFile(path).then((p) => (p ? p : Promise.reject(new Error("Not found")))),
          ),
        ).catch(() => null);

      return await Promise.all(processedPaths.map((path) => accessFile(path))).then((paths) =>
        paths.filter(Boolean),
      );
    };

  if (Files.isMac || Files.isLinux)
    return async function checkExecutableFilePaths(paths, { addCommonExts, first }) {
      const processedPaths =
        addCommonExts ? paths.flatMap((path) => COMMON_EXEC_EXTS.map((ext) => path + ext)) : paths;

      let script = "for path in";
      for (const path of processedPaths) script += ` "${path}"`;
      script += "; do\n";
      script += '  if [ -f "$path" ] && [ -x "$path" ]; then\n';
      script += '    echo "$path"\n';
      if (first) script += "    break\n";
      script += "  fi\n";
      script += "done\n";

      return first ?
          await runCommand(script)
            .then((output) => output.trim() || null)
            .catch((err) => {
              console.warn("Warning: `checkExecutableFilePaths` failed:", err);
              return null;
            })
        : await runCommand(script)
            .then((output) =>
              output
                .trim()
                .split("\n")
                .map((bin) => bin.trim())
                .filter(Boolean),
            )
            .catch((err) => {
              console.warn("Warning: `checkExecutableFilePaths` failed:", err);
              return [];
            });
    };

  throw new PlatformError("Unsupported platform for `checkExecutableFilePaths`");
})();

/**
 * Get an array of file names in a directory.
 * @param dir Directory path.
 * @param strategy Strategy to use.
 * @returns An array of file names.
 */
export const readDir: (
  dir: string,
  strategy?: "all" | "dirsOnly" | "filesOnly",
) => Promise<string[]> = (() => {
  if (Files.isNode) {
    const fs = window.reqnode!("fs");

    return async function readDir(dir, strategy = "all") {
      if (strategy === "all")
        return new Promise((resolve, reject) => {
          fs.readdir(dir, (err, files) => {
            if (err) reject(err);
            else resolve(files);
          });
        });

      return new Promise((resolve, reject) => {
        fs.readdir(dir, { withFileTypes: true }, (err, files) => {
          if (err) reject(err);
          else {
            const filtered = files.filter((file) => {
              if (strategy === "dirsOnly") return file.isDirectory();
              if (strategy === "filesOnly") return file.isFile();
              return false;
            });
            resolve(filtered.map((file) => file.name));
          }
        });
      });
    };
  }

  if (Files.isMac)
    return async function readDir(dir, strategy = "all") {
      if (strategy === "all") {
        const output = await runCommand(/* sh */ `
          for file in "${dir}"/* "${dir}"/.[!.]* "${dir}"/..?*; do
            echo $(basename "$file")
          done
        `);
        return output.trim().split("\n");
      }

      if (strategy === "dirsOnly") {
        const output = await runCommand(/* sh */ `
          for file in "${dir}"/* "${dir}"/.[!.]* "${dir}"/..?*; do
            if [ -d "$file" ]; then
              echo $(basename "$file")
            fi
          done
        `);
        return output.trim().split("\n");
      }

      const output = await runCommand(/* sh */ `
        for file in "${dir}"/* "${dir}"/.[!.]* "${dir}"/..?*; do
          if [ -f "$file" ]; then
            echo $(basename "$file")
          fi
        done
      `);
      return output.trim().split("\n");
    };

  throw new PlatformError("Unsupported platform for `readDir`");
})();

/**
 * Read the contents of a file.
 * @param path File path.
 * @returns
 */
export const readFile: (path: string) => Promise<string> = (() => {
  if (Files.isNode) {
    const fs = window.reqnode!("fs");

    return async function readFile(path) {
      return new Promise((resolve, reject) => {
        fs.readFile(path, "utf-8", (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    };
  }

  if (Files.isMac)
    return async function readFile(path) {
      return await runCommand(`\\cat "${path}"`);
    };

  throw new PlatformError("Unsupported platform for `readFile`");
})();

/**
 * Get all paths of a command.
 *
 * Modified from the [npm package `lookpath`](https://www.npmjs.com/package/lookpath):
 * <https://github.com/otiai10/lookpath/blob/f6ae8dbc990e0b5ecc2bf77fa62179ce13fbe8e9/src/index.ts>
 * @param command The command to look for.
 * @returns The absolute paths of the command.
 */
export const lookPath = async (command: string): Promise<string[]> => {
  const dirs = (
    (window.process ? process.env : await getEnv())[Files.isWin ? "Path" : "PATH"] || ""
  ).split(path.delimiter);
  return (await _checkExecutableFilePaths(
    dirs.map((dir) => path.join(dir, command)),
    { addCommonExts: true, first: false },
  )) as string[];
};
/**
 * Get the path of a command.
 *
 * Modified from the [npm package `lookpath`](https://www.npmjs.com/package/lookpath):
 * <https://github.com/otiai10/lookpath/blob/f6ae8dbc990e0b5ecc2bf77fa62179ce13fbe8e9/src/index.ts>
 * @param command The command to look for.
 * @returns The absolute path of the command, or `null` if not found.
 */
export const lookPathFirst = async (command: string): Promise<string | null> => {
  const dirs = (
    (window.process ? process.env : await getEnv())[Files.isWin ? "Path" : "PATH"] || ""
  ).split(path.delimiter);
  return (await _checkExecutableFilePaths(
    dirs.map((dir) => path.join(dir, command)),
    { addCommonExts: true, first: true },
  )) as string | null;
};

export const {
  lookApp,
  lookAppFirst,
}: {
  /**
   * Look for an application in common directories.
   * @param app Application name.
   * @param executableName Name of the executable file.
   * @returns The absolute paths of the application.
   * @throws {PlatformError} If the platform is not supported.
   */
  lookApp: (app: string, executableName?: string) => Promise<string[]>;
  /**
   * Look for an application in common directories.
   * @param app Application name.
   * @param executableName Name of the executable file.
   * @returns The absolute path of the application, or `null` if not found.
   * @throws {PlatformError} If the platform is not supported.
   */
  lookAppFirst: (app: string, executableName?: string) => Promise<string | null>;
} = (() => {
  if (Files.isWin) {
    const APP_DIRS = [
      "C:\\",
      ...[
        "APPDATA",
        "LOCALAPPDATA",
        "USERPROFILE",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "ProgramData",
      ].map((env) => process.env[env]),
    ].filter(Boolean);

    return {
      async lookApp(this: void, app, executableName = app) {
        return (await _checkExecutableFilePaths(
          APP_DIRS.map((dir) => path.join(dir, app, executableName)),
          { addCommonExts: true, first: false },
        )) as string[];
      },

      async lookAppFirst(this: void, app, executableName = app) {
        return (await _checkExecutableFilePaths(
          APP_DIRS.map((dir) => path.join(dir, app, executableName)),
          { addCommonExts: true, first: true },
        )) as string | null;
      },
    };
  }

  if (Files.isMac || Files.isLinux) {
    const COMMON_APP_DIRS = [
      ...(Files.isMac ?
        ["/Library/Application Support", path.expandHomeDir("~/Library/Application Support")]
      : []),
      path.expandHomeDir("~"),
      path.expandHomeDir("~/.config"),
      path.expandHomeDir("~/.local"),
      path.expandHomeDir("~/.local/etc"),
      path.expandHomeDir("~/.local/share"),
      path.expandHomeDir("~/.local/share/applications"),
      "/",
      "/opt",
      "/opt/local",
      "/home",
      "/usr/share",
      "/usr/local",
      "/usr/local/etc",
      "/usr/local/share",
      "/usr/local/share/applications",
    ];
    const COMMON_EXEC_SUB_DIRS = ["bin", "sbin", "lib", "exec", "libexec"];

    const _lookApp = async (
      app: string,
      executableName: string,
      first: boolean,
    ): Promise<string[] | string | null> => {
      const possiblePaths = [
        ...(Files.isMac ?
          ["/Applications", "/Applications/Utilities", path.expandHomeDir("~/Applications")].map(
            (dir) => path.join(dir, `${app}.app`, "Contents", "MacOS", executableName),
          )
        : []),
        ...COMMON_APP_DIRS.flatMap((dir) => [
          path.join(dir, executableName),
          ...COMMON_EXEC_SUB_DIRS.flatMap((sub) => path.join(dir, sub, executableName)),
          path.join(dir, app, executableName),
          path.join(dir, "." + app, executableName),
          ...COMMON_EXEC_SUB_DIRS.flatMap((sub) => path.join(dir, app, sub, executableName)),
          ...COMMON_EXEC_SUB_DIRS.flatMap((sub) => path.join(dir, "." + app, sub, executableName)),
          path.join(dir, app, app, executableName),
          path.join(dir, app, "." + app, executableName),
          path.join(dir, "." + app, app, executableName),
          path.join(dir, "." + app, "." + app, executableName),
          ...COMMON_EXEC_SUB_DIRS.flatMap((sub) => path.join(dir, app, app, sub, executableName)),
          ...COMMON_EXEC_SUB_DIRS.flatMap((sub) =>
            path.join(dir, app, "." + app, sub, executableName),
          ),
          ...COMMON_EXEC_SUB_DIRS.flatMap((sub) =>
            path.join(dir, "." + app, app, sub, executableName),
          ),
          ...COMMON_EXEC_SUB_DIRS.flatMap((sub) =>
            path.join(dir, "." + app, "." + app, sub, executableName),
          ),
        ]),
      ];

      return await _checkExecutableFilePaths(possiblePaths, { addCommonExts: true, first });
    };

    return {
      async lookApp(this: void, app, executableName = app) {
        return (await _lookApp(app, executableName, false)) as string[];
      },

      async lookAppFirst(this: void, app, executableName = app) {
        return (await _lookApp(app, executableName, true)) as string | null;
      },
    };
  }

  throw new PlatformError("Unsupported platform for `lookApp`");
})();
