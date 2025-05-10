import fs from "node:fs";
import path from "node:path";

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
  {
    name: "highlight.js-theme-switcher",
    transform(code, id) {
      if (id.includes("main.ts")) {
        const lightThemePath = path.resolve("node_modules/highlight.js/styles/github.min.css");
        const darkThemePath = path.resolve(
          "node_modules/@catppuccin/highlightjs/css/catppuccin-mocha.css",
        );

        const lightThemeCSS = fs.readFileSync(lightThemePath, "utf8");
        const darkThemeCSS = fs.readFileSync(darkThemePath, "utf8");

        const escapeCSS = (css: string) =>
          css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");

        const themeSwitch = `
// Highlight.js theme switcher
(function() {
  let styleElement = null;
  let currentTheme = null;

  const themes = {
    light: \`${escapeCSS(lightThemeCSS)}\`,
    dark: \`${escapeCSS(darkThemeCSS)}\`
  };

  window.setHighlightjsTheme = function(theme) {
    if (!themes[theme]) {
      console.error('Invalid theme: ' + theme + '. Use "light" or "dark"');
      return;
    }

    if (currentTheme === theme) return;
    currentTheme = theme;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'highlightjs-dynamic-theme';
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = themes[theme];
  };
})();`;

        return code + themeSwitch;
      }
      return code;
    },
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
