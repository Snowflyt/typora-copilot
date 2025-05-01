import type { ChildProcessWithoutNullStreams } from "node:child_process";

import {
  accessDir,
  accessFile,
  lookApp,
  lookAppFirst,
  lookPath,
  lookPathFirst,
  readDir,
  realpath,
  trueCasePath,
} from "@modules/fs";
import * as path from "@modules/path";

import { unique } from "radash";
import semverGte from "semver/functions/gte";
import semverLt from "semver/functions/lt";
import semverRCompare from "semver/functions/rcompare";
import semverValid from "semver/functions/valid";

import { PLUGIN_DIR } from "@/constants";
import { TYPORA_VERSION } from "@/typora-utils";

import { findFreePort, getEnv, runCommand } from "./cli-tools";
import { cache } from "./function";

export abstract class NodeServer {
  abstract readonly pid: number;

  abstract send(message: string): void;
  abstract onMessage(listener: (message: string) => void): void;

  static async start(nodePath: string, modulePath: string): Promise<NodeServer> {
    if (Files.isNode) return ElectronNodeServer.start(nodePath, modulePath);
    return await MacOSNodeServer.start(nodePath, modulePath);
  }

  static getMock(): NodeServer {
    return {
      pid: -1,
      send() {},
      onMessage() {},
    };
  }
}

class ElectronNodeServer implements NodeServer {
  private readonly childProcess: ChildProcessWithoutNullStreams;

  private constructor(nodePath: string, modulePath: string) {
    if (nodePath === "bundled")
      this.childProcess = window.reqnode!("child_process").fork(modulePath, ["--stdio", "true"], {
        silent: true,
      }) as ChildProcessWithoutNullStreams;
    else
      this.childProcess = window.reqnode!("child_process").spawn(nodePath, [
        modulePath,
        "--stdio",
        "true",
      ]);
  }

  get pid(): number {
    return this.childProcess.pid!;
  }

  send(message: string): void {
    this.childProcess.stdin.write(message);
  }

  onMessage(listener: (message: string) => void): void {
    this.childProcess.stdout.on("data", (data) => {
      const message: string = data.toString("utf-8");
      listener(message);
    });
  }

  static start(nodePath: string, modulePath: string): NodeServer {
    return new ElectronNodeServer(nodePath, modulePath);
  }
}

class MacOSNodeServer implements NodeServer {
  private readonly wsClient: WebSocket;
  private readonly listeners: ((message: string) => void)[] = [];

  private constructor(
    public readonly pid: number,
    port: number,
  ) {
    this.wsClient = new WebSocket(`ws://localhost:${port}`);
    this.wsClient.onmessage = (event) => {
      this.listeners.forEach((listener) => listener(event.data as string));
    };
  }

  send(message: string): void {
    this.wsClient.send(message);
  }

  onMessage(listener: (message: string) => void): void {
    this.listeners.push(listener);
  }

  static async start(nodePath: string, modulePath: string): Promise<NodeServer> {
    const port = await findFreePort();

    const serverExecPath = path.join(PLUGIN_DIR, "mac-server.cjs");
    const logFileName = ".typora-copilot-lsp-sever-output.log";
    const command = `nohup ${nodePath} '${serverExecPath}' ${port} '${modulePath}' > ~/${logFileName} 2>&1 &`;
    void runCommand(command);

    const pid = await MacOSNodeServer.getPortPID(port);
    if (pid === -1) throw new Error("Failed to start Node LSP server");

    return new MacOSNodeServer(pid, port);
  }

  private static getPortPID(port: number): Promise<number> {
    return new Promise<number>((resolve) => {
      let times = 0;
      const go = async () => {
        const pid = Number.parseInt(await runCommand(`lsof -t -i:${port} | tail -n 1`));
        if (Number.isNaN(pid)) {
          if (times > 50) {
            resolve(-1);
          } else {
            setTimeout(() => void go(), 100);
            times++;
          }
        } else resolve(pid);
      };
      void go();
    });
  }
}

// The following 2 variables are used as global state in the application and are not persisted.
// They should be set manually by other parts of the codebase.
let currentNodeRuntime: NodeRuntime = { path: "not found", version: "unknown" };
export const getCurrentNodeRuntime = () => currentNodeRuntime;
export const setCurrentNodeRuntime = (runtime: NodeRuntime) => {
  currentNodeRuntime = runtime;
};

let allAvailableNodeRuntimes: readonly NodeRuntime[] = [];
export const getAllAvailableNodeRuntimes = () => allAvailableNodeRuntimes;
export const setAllAvailableNodeRuntimes = (runtimes: readonly NodeRuntime[]) => {
  allAvailableNodeRuntimes = runtimes;
};

export interface NodeRuntime {
  readonly path: string;
  readonly version: string;
}

/**
 * Detect all available Node.js runtimes.
 * @returns
 */
export const detectAvailableNodeRuntimes = async ({
  onFirstResolved = () => {},
}: { onFirstResolved?: (runtime: NodeRuntime) => void } = {}): Promise<readonly NodeRuntime[]> => {
  // The language server of GitHub Copilot requires at least Node.js >= 20 to run, so we need to
  // find a Node.js runtime that meets this requirement.
  const promises: Promise<
    ((NodeRuntime | string | null)[] | NodeRuntime | string | null)[] | NodeRuntime | string | null
  >[] = [];

  // On Windows and Linux, Typora is built as an Electron app, and since Typora 1.9, the bundled
  // Node.js version is >= 20.0.0. However, since Typora 1.10, the Electron `runAsNode` fuse is
  // disabled, so the Typora executable can no longer be used as a Node.js runtime.
  // Thus, for 1.9 <= Typora < 1.10.0 on Windows/Linux, we can use the bundled Node.js runtime.
  if (Files.isNode && semverLt(TYPORA_VERSION, "1.10.0") && semverGte(process.version, "20.0.0"))
    promises.push(Promise.resolve({ path: "bundled", version: process.version }));

  /* Detect Node.js runtimes from the system */
  const baseNodeNames = ["node", "nodejs"];
  promises.push(Promise.defer(() => lookPath("node")));
  baseNodeNames.forEach((name) => promises.push(Promise.defer(() => lookApp(name, "node"))));
  // When written this code, the latest Node.js version is v23, but for future compatibility, we
  // search for Node.js runtimes from v28 to v20.
  if (Files.isNode) {
    Array.from({ length: 28 - 20 + 1 }, (_, i) => i + 20)
      .reverse()
      .flatMap((i) =>
        baseNodeNames.flatMap((name) => [`${name}${i}`, `${name}-${i}`, `${name}-v${i}`]),
      )
      .forEach((name) => {
        promises.push(Promise.defer(() => lookPath(name)));
        promises.push(Promise.defer(() => lookApp(name, "node")));
      });
  } else {
    // Optimization for macOS. Since all CLI functions on macOS are polyfilled simply by running
    // command in the shell, we have to merge these operations into one command to reduce the number
    // of shell calls to prevent performance issues.
    const nodeMatchRegEx = "^node(([1][8-9]|2[0-6])|(-v?([1][8-9]|2[0-6])))$";
    const script = /* sh */ `
      regex='${nodeMatchRegEx}'
      echo "$PATH" | tr ':' '\n' | while read -r dir; do
        find "$dir" -maxdepth 1 -type f -executable 2>/dev/null | awk -F/ -v regex="$regex" '
          {
            # Extract basename and match against regex
            file = $NF
            if (file ~ regex) {
              print $0
            }
          }
        '
      done
    `;
    promises.push(
      Promise.defer(() => runCommand(script)).then((output) =>
        output
          .trim()
          .split("\n")
          .map((path) => path.trim())
          .filter(Boolean),
      ),
    );
  }

  /* (Windows) Detect Node.js installed by Scoop: https://scoop.sh/ */
  const lookScoop = cache(async function lookScoop() {
    const scoopPath = (await lookPathFirst("scoop")) || (await lookAppFirst("scoop"));
    if (!scoopPath) return null;

    const scoopRoot = path.dirname(path.dirname(scoopPath));
    const appsDir = path.join(scoopRoot, "apps");

    const appDirs = await readDir(appsDir, "dirsOnly");

    return { appsDir, appDirs };
  });

  if (Files.isWin)
    promises.push(
      Promise.defer(async () => {
        const scoop = await lookScoop();
        if (!scoop) return [];

        const { appDirs, appsDir } = scoop;

        const runtimes: NodeRuntime[] = [];
        await Promise.all(
          appDirs
            .filter((dir) => dir.startsWith("nodejs"))
            .map(async (dir) => {
              const versionDirs = await readDir(path.join(appsDir, dir), "dirsOnly");
              for (const versionDir of versionDirs)
                runtimes.push({
                  path: path.join(appsDir, dir, versionDir, "node.exe"),
                  version: versionDir,
                });
            })
            .map((p) => p.catch(() => {})),
        );
        return runtimes.sort((a, b) => semverRCompare(a.version, b.version));
      }),
    );

  /* (Windows) Detect Node.js installed by Chocolatey: https://chocolatey.org/ */
  const lookChocolatey = cache(async function lookChocolatey() {
    const chocoPath = (await lookPathFirst("choco")) || (await lookAppFirst("chocolatey", "choco"));
    if (!chocoPath) return null;

    const chocoRoot = path.dirname(path.dirname(chocoPath));
    const libDir = path.join(chocoRoot, "lib");

    const libDirs = await readDir(libDir, "dirsOnly");

    return { libDir, libDirs };
  });

  if (Files.isWin) {
    // It doesn't make sense to specifically support Chocolatey.
    // Chocolatey doesn't provide `nodejs.portable` or support multiple versions of Node.js,
    // `nodejs` and `nodejs-lts` are simply installed to `C:\Program Files\`, which should be
    // already detected by the common directories lookup.
    // `nvm.install` and `nvm.portable` are both installed to `C:\ProgramData\nvm\`, which should be
    // detected by the common directories lookup as well.
    // The only exception is `fnm` installed to `C:\ProgramData\chocolatey\lib\fnm\tools\fnm.exe`,
    // we'll detect it in the fnm section.
  }

  /* (macOS/Linux) Detect Node.js installed by Homebrew: https://brew.sh/ */
  const lookHomebrew = cache(async function lookHomebrew() {
    const brewPath =
      Files.isMac ?
        await (async () => {
          const brewPath1 = await lookPathFirst("brew");
          if (!brewPath1) return await lookAppFirst("homebrew", "brew");
          // On macOS M1/M2/M3/M4, two versions of Homebrew may be installed: one for x86 simulating
          // and one for ARM. We need to choose the latter if it exists.
          if (/* Intel */ brewPath1 === "/usr/local/bin/brew") {
            const brewPath2 = await lookAppFirst("homebrew", "brew");
            if (brewPath2) return brewPath2;
            return brewPath1;
          }
          return brewPath1;
        })()
      : (await lookPathFirst("brew")) || (await lookAppFirst("linuxbrew", "brew"));
    if (!brewPath) return null;

    const cellarDir = (await runCommand(`"${brewPath}" --cellar`)).trim();
    const cellarDirs = await readDir(cellarDir, "dirsOnly");

    return { cellarDir, cellarDirs };
  });

  if (Files.isMac || Files.isLinux)
    promises.push(
      Promise.defer(async () => {
        const homebrew = await lookHomebrew();
        if (!homebrew) return [];

        const { cellarDir, cellarDirs } = homebrew;

        const runtimes: NodeRuntime[] = [];
        await Promise.all(
          cellarDirs
            .filter((dir) => dir === "node" || dir.startsWith("node@"))
            .map(async (dir) => {
              const versionDirs = (await readDir(path.join(cellarDir, dir), "dirsOnly")).filter(
                (dir) => semverValid(dir),
              );
              for (const versionDir of versionDirs)
                runtimes.push({
                  path: path.join(cellarDir, dir, versionDir, "bin", "node"),
                  version: versionDir,
                });
            })
            .map((p) => p.catch(() => {})),
        );
        return runtimes.sort((a, b) => semverRCompare(a.version, b.version));
      }),
    );

  /* (macOS) Detect Node.js installed by MacPorts: https://www.macports.org/ */
  const lookMacPorts = cache(async function lookMacPorts() {
    const portPath = (await lookPathFirst("port")) || (await lookAppFirst("port"));
    if (!portPath) return null;

    return { portPath };
  });

  if (Files.isMac)
    promises.push(
      Promise.defer(async () => {
        const macPorts = await lookMacPorts();
        if (!macPorts) return [];

        const { portPath } = macPorts;

        const output = await runCommand(
          `"${portPath}" info installed | grep --color=never ^nodejs`,
        );

        const nodePaths = await Promise.all(
          output
            .trim()
            .split("\n")
            .map((line) => line.trim().split(" ", 2)[0]!)
            .map((name) =>
              runCommand(`"${portPath}" contents ${name} | head -n 2 | tail -n 1`)
                .then((path) => path.trim())
                .catch(() => null),
            ),
        );
        return nodePaths.filter(Boolean);
      }),
    );

  /* (macOS/Linux) Detect Node.js installed by Devbox: https://www.jetify.com/docs/devbox/ */
  if (Files.isMac || Files.isLinux)
    promises.push(
      Promise.defer(() =>
        // Devbox is typically installed to `/usr/local/bin/devbox`, which is usually in the PATH,
        // so invoke `devbox` directly should be enough
        runCommand('eval "$(devbox global shellenv)" && echo "$(which node)\n$(node -v)"')
          .then(
            (output) =>
              output
                .trim()
                .split("\n")
                .map((line) => line.trim()) as [string, string],
          )
          .then(([path, version]) => ({ path, version })),
      ),
    );

  /* (Windows) Detect NVM for Windows: https://github.com/coreybutler/nvm-windows */
  if (Files.isWin)
    promises.push(
      Promise.defer(async () => {
        const nvmPath =
          (await lookPathFirst("nvm")) ||
          (await lookAppFirst("nvm")) ||
          (await (async () => {
            const scoop = await lookScoop();
            if (!scoop) return null;
            const { appDirs, appsDir } = scoop;
            if (!appDirs.includes("nvm")) return null;
            return await accessFile(path.join(appsDir, "nvm", "current", "nvm.exe"));
          })());
        // NOTE: No need to detect NVM installed by Chocolatey, because Chocolatey installs NVM to
        // `C:\ProgramData\nvm\`, and it should be detected by the common directories lookup.
        // NOTE: No need to detect NVM installed by Homebrew or MacPorts, because both create a
        // symlink `~/.nvm/nvm.sh` to the actual NVM installation directory, and it should be
        // detected by the common directories lookup.
        if (!nvmPath) return [];

        const nvmRoot = (await runCommand(`"${nvmPath}" root`))
          .trim()
          .replace(/^Current Root:/i, "")
          .trim();
        const dirs = await readDir(nvmRoot, "dirsOnly");

        const runtimes: NodeRuntime[] = [];
        for (const dir of dirs)
          if (dir.startsWith("v")) {
            const version = dir.slice(1);
            runtimes.push({ path: path.join(nvmRoot, dir, "node.exe"), version });
          }
        return runtimes.sort((a, b) => semverRCompare(a.version, b.version));
      }),
    );

  /* (macOS/Linux) Detect NVM: https://github.com/nvm-sh/nvm */
  if (Files.isMac || Files.isLinux)
    promises.push(
      Promise.defer(async () => {
        // If found `NVM_DIR` in env, use it
        // https://stackoverflow.com/a/45139064/21418758
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        let nvmRoot = (window.process ? process.env : await getEnv())["NVM_DIR"];

        if (!nvmRoot) {
          // Lookup NVM from common directories
          const nvmPath = await lookAppFirst("nvm");
          if (!nvmPath) return [];
          // `NVM_DIR` is set to the parent directory of `nvm.sh` by default. See:
          // https://github.com/nvm-sh/nvm/blob/9659af6c164ef5258751f17c0c2e73dc7b491210/nvm.sh#L429
          nvmRoot = path.dirname(nvmPath);
        }

        const runtimes: NodeRuntime[] = [];
        await Promise.all(
          [
            accessDir(path.join(nvmRoot, "versions", "node")).then((path) =>
              path ?
                readDir(path, "dirsOnly")
                  .then((dirs) => ({ basePath: path, dirs }))
                  .catch(() => ({ basePath: path, dirs: [] }))
              : { basePath: "", dirs: [] },
            ),
            readDir(nvmRoot, "dirsOnly")
              .then((dirs) => ({ basePath: nvmRoot, dirs }))
              .catch(() => ({ basePath: nvmRoot, dirs: [] })),
          ].map((p) =>
            p.then(({ basePath, dirs }) => {
              for (const dir of dirs) {
                const match = /v\d+\.\d+\.\d+/.exec(dir);
                if (match) {
                  const version = match[0];
                  runtimes.push({ path: path.join(basePath, dir, "bin", "node"), version });
                }
              }
            }),
          ),
        );
        return runtimes.sort((a, b) => semverRCompare(a.version, b.version));
      }),
    );

  /* Detect Node.js installed by fnm: https://github.com/Schniz/fnm */
  promises.push(
    Promise.defer(async () => {
      const fnmPath =
        (await lookPathFirst("fnm")) ||
        (await lookAppFirst("fnm")) ||
        (Files.isWin &&
          (await (async () => {
            const scoop = await lookScoop();
            if (!scoop) return null;
            const { appDirs, appsDir } = scoop;
            if (!appDirs.includes("fnm")) return null;
            return await accessFile(path.join(appsDir, "fnm", "current", "fnm.exe"));
          })())) ||
        (Files.isWin &&
          (await (async () => {
            const chocolatey = await lookChocolatey();
            if (!chocolatey) return null;
            const { libDir, libDirs } = chocolatey;
            if (!libDirs.includes("fnm")) return null;
            return await accessFile(path.join(libDir, "fnm", "tools", "fnm.exe"));
          })())) ||
        ((Files.isMac || Files.isLinux) &&
          (await (async () => {
            const homebrew = await lookHomebrew();
            if (!homebrew) return null;
            const { cellarDir, cellarDirs } = homebrew;
            if (!cellarDirs.includes("fnm")) return null;
            const versionDirs = await readDir(path.join(cellarDir, "fnm"), "dirsOnly");
            if (versionDirs.length === 0) return null;
            const maxVersion = versionDirs.reduce((a, b) => (semverGte(a, b) ? a : b));
            return await accessFile(path.join(cellarDir, "fnm", maxVersion, "bin", "fnm"));
          })())) ||
        (Files.isMac &&
          (await (async () => {
            const macPorts = await lookMacPorts();
            if (!macPorts) return null;
            const { portPath } = macPorts;
            const output = (
              await runCommand(`"${portPath}" contents fnm | head -n 2 | tail -n 1`).catch(() => "")
            ).trim();
            if (!output || output.startsWith("Error:")) return null;
            return output;
          })())) ||
        ((Files.isMac || Files.isLinux) &&
          (await (async () => {
            const output = (
              await runCommand('eval "$(devbox global shellenv)" && which fnm').catch(() => "")
            ).trim();
            if (!output) return null;
            return output;
          })()));
      if (!fnmPath) return [];

      const fnmDirEnvRegEx = /^(?:export\s+)?FNM_DIR=(?:['"])?(.+?)(?:['"])?$/;
      const fnmDir = (await runCommand(`"${fnmPath}" env --shell bash`))
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .find((line) => fnmDirEnvRegEx.test(line))
        ?.match(fnmDirEnvRegEx)?.[1];
      if (!fnmDir) return [];

      const versionsDir = await accessDir(path.join(fnmDir, "node-versions"));
      if (!versionsDir) return [];

      const versionDirs = await readDir(versionsDir, "dirsOnly").catch(() => []);
      if (versionDirs.length === 0) return [];

      const runtimes: NodeRuntime[] = [];
      for (const dir of versionDirs) {
        const match = /v\d+\.\d+\.\d+/.exec(dir);
        if (match) {
          const version = match[0];
          runtimes.push({
            path: path.join(
              versionsDir,
              dir,
              "installation",
              ...(Files.isWin ? ["node.exe"] : ["bin", "node"]),
            ),
            version,
          });
        }
      }
      return runtimes.sort((a, b) => semverRCompare(a.version, b.version));
    }),
  );

  const filterVersion = (runtime: NodeRuntime | null) =>
    runtime && semverValid(runtime.version) && semverGte(runtime.version, "20.0.0") ?
      runtime
    : null;

  const resolveRuntime = (path: string) =>
    runCommand(`"${path}" -v`)
      .then((version) => ({ path, version: version.trim() }))
      .catch(() => null);

  const mayContainDuplicatesRuntimeFetcherPromises = promises.map((p) =>
    p
      .catch(() => null)
      .then((r) =>
        // Promisify all paths
        r === null ? r
        : typeof r === "string" ? resolveRuntime(r).then(filterVersion)
        : Array.isArray(r) ?
          r.map((r) =>
            r === null ? r
            : typeof r === "string" ? resolveRuntime(r).then(filterVersion)
            : Array.isArray(r) ?
              r.map((r) =>
                r === null ? r
                : typeof r === "string" ? resolveRuntime(r).then(filterVersion)
                : filterVersion(r),
              )
            : filterVersion(r),
          )
        : filterVersion(r),
      )
      .then((r) =>
        // Flatten 1
        r === null ? [r]
        : Array.isArray(r) ? Promise.all(r)
        : [r],
      )
      .then((r) =>
        // Flatten 2
        Promise.all(r.filter(Boolean).flatMap((r) => (Array.isArray(r) ? r.filter(Boolean) : [r]))),
      )
      .then((r) =>
        // Resolve true case path
        Promise.all(
          r.filter(Boolean).map((runtime) =>
            runtime.path === "bundled" ?
              runtime
            : trueCasePath(runtime.path)
                .then((path) => ({ path, version: runtime.version }))
                .catch(() => null),
          ),
        ).then((r) => r.filter(Boolean)),
      ),
  );

  Promise.orderedFirstResolved(
    mayContainDuplicatesRuntimeFetcherPromises.map((p) =>
      p.then((r) => (r.length === 0 ? Promise.reject(new Error("No runtime found")) : r[0]!)),
    ),
  )
    .then(onFirstResolved)
    .catch(() => {});

  const runtimes = await Promise.all(mayContainDuplicatesRuntimeFetcherPromises).then((runtimes) =>
    unique(runtimes.flat(), (runtime) => runtime.path),
  );
  // Filter out runtimes with same realpath
  return unique(
    await Promise.all(
      runtimes.map((runtime) =>
        runtime.path === "bundled" ?
          { ...runtime, realPath: runtime.path }
        : realpath(runtime.path)
            .then((realPath) => realPath && { ...runtime, realPath })
            .catch(() => null),
      ),
    ).then((runtimes) => runtimes.filter(Boolean)),
    (runtime) => runtime.realPath,
  ).map(({ path, version }) => ({ path, version }));
};
