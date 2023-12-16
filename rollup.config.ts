import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";

export default defineConfig({
  input: "src/main.ts",
  output: {
    file: "dist/index.js",
    format: "iife",
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.build.json",
    }),
    nodeResolve({
      extensions: [".js", ".ts"],
    }),
    commonjs(),
  ],
});
