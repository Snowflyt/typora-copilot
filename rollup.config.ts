import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import type { InputPluginOption } from "rollup";
import { defineConfig } from "rollup";
import postcss from "rollup-plugin-postcss";

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
    plugins: [
      ...plugins,
      postcss({
        inject: true,
        // Disable Dart Sass deprecated legacy JS API warning until rollup-plugin-postcss is updated
        // to support modern Sass API: https://github.com/egoist/rollup-plugin-postcss/issues/463
        use: {
          sass: {
            silenceDeprecations: ["legacy-js-api"],
          },
        } as never,
      }),
    ],
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
