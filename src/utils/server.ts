import type { ChildProcessWithoutNullStreams, NodeServer } from "@modules/child_process";

export const wrapNodeChildProcess = (cp: ChildProcessWithoutNullStreams): NodeServer => ({
  pid: cp.pid!,

  send: (message) => {
    cp.stdin.write(message);
  },
  onMessage: (listener) => {
    cp.stdout.on("data", (data) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const message: string = data.toString("utf-8");
      listener(message);
    });
  },
});
