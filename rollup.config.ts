import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import postcss from "rollup-plugin-postcss";

export default defineConfig([
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "iife",
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.build.json",
      }),
      nodeResolve({
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      }),
      json(),
      commonjs(),
      postcss({
        inject: true,
      }),
    ],
  },
  {
    input: "src/mac-server.ts",
    output: {
      file: "dist/mac-server.cjs",
      format: "cjs",
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.build.json",
      }),
      nodeResolve({
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      }),
      json(),
      commonjs(),
    ],
  },
]);
