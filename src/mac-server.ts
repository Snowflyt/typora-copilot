import { fork } from "child_process";
import net from "net";

import { WebSocketServer } from "ws";

import type { ChildProcessWithoutNullStreams } from "node:child_process";

if (!process.argv[2] || !process.argv[3]) {
  console.log("Usage: node mac-server.cjs <port> <lsp-node-module-path>");
  process.exit(1);
}

const port = Number.parseInt(process.argv[2]);
if (Number.isNaN(port)) {
  console.log(`Invalid port "${process.argv[2]}"`);
  process.exit(1);
}

console.log("Process PID:", process.pid);

const server = fork(process.argv[3], [], { silent: true }) as ChildProcessWithoutNullStreams;
console.log("Copilot LSP server started. PID:", server.pid);

const startWebSocketServer = () => {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    console.log(`➕➕ Connection (${wss.clients.size})`);

    ws.once("close", () => {
      console.log("🚨 WebSocket Server shutting down...");
      wss.close();
      process.exit(0);
    });

    ws.on("message", (data) => {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const payload = data.toString("utf-8");
      console.debug("📥", payload);
      server.stdin.write(payload);
    });

    server.stdout.on("data", (data) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const message: string = data.toString("utf-8");
      console.debug("📤", message);
      ws.send(message);
    });
  });

  console.log(`✅ WebSocket Server listening on ws://localhost:${port}`);

  const cleanupServer = (() => {
    let called = false;
    return () => {
      if (called) return;
      called = true;
      console.log("🚨 WebSocket Server shutting down...");
      wss.close((err) => {
        if (err) console.error(err);
        process.exit(0);
      });
    };
  })();

  process.on("exit", cleanupServer);
  process.on("SIGINT", cleanupServer);
  process.on("SIGTERM", cleanupServer);
  process.on("SIGUSR1", cleanupServer);
  process.on("SIGUSR2", cleanupServer);
  process.on("uncaughtException", cleanupServer);
};

const testServer = net.createServer();
testServer.once("error", (err) => {
  if ((err as unknown as { code: string }).code === "EADDRINUSE") {
    console.error(`🚨 Port ${port} is busy`);
    process.exit(1);
  }
});

testServer.once("listening", () => {
  testServer.close(startWebSocketServer);
});

testServer.listen(port);
