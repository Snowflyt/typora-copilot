import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import postcss from "rollup-plugin-postcss";

import type { InputPluginOption } from "rollup";

const plugins = [
  typescript({
    tsconfig: "./tsconfig.build.json",
  }),
  nodeResolve({
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  }),
  json(),
  commonjs(),
  {
    name: "clean",
    transform: (code) =>
      code
        .replace(/\n?^\s*\/\/ @ts-.+$/gm, "")
        .replace(/\n?^\s*\/\/\/ <reference.+$/gm, "")
        .replace(/\n?^\s*(\/\/|\/\*) eslint-disable.+$/gm, ""),
  },
] satisfies InputPluginOption;

export default defineConfig([
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "iife",
    },
    plugins: [...plugins, postcss({ inject: true })],
  },
  {
    input: "src/mac-server.ts",
    output: {
      file: "dist/mac-server.cjs",
      format: "cjs",
    },
    plugins,
  },
]);
