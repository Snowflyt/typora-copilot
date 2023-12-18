import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@modules": path.resolve(__dirname, "src/modules"),
      "@": path.resolve(__dirname, "src"),
      "@test": path.resolve(__dirname, "test"),
    },
  },
  test: {
    setupFiles: ["./setup-test.ts"],
    environment: "happy-dom",
  },
});
