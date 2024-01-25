// @ts-check

/* eslint-env node */

/** @satisfies {import("eslint").Linter.Config} */
const config = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:prettier/recommended",
    "plugin:sonarjs/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: ["./tsconfig.json", "./tsconfig.eslint.json"],
    tsconfigRootDir: __dirname,
  },
  plugins: ["sort-destructure-keys"],
  rules: {
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
    "import/namespace": "off",
    "import/no-unresolved": "off",
    "import/order": [
      "error",
      {
        alphabetize: { order: "asc" },
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
        pathGroups: [
          {
            pattern: "@modules/**",
            group: "external",
            position: "before",
          },
          {
            pattern: "@/",
            group: "internal",
            position: "after",
          },
        ],
        pathGroupsExcludedImportTypes: ["builtin", "type"],
        "newlines-between": "always",
      },
    ],
    "no-undef": "off",
    "sonarjs/cognitive-complexity": "off",
    "sort-destructure-keys/sort-destructure-keys": "error",
    "sort-imports": [
      "error",
      {
        ignoreCase: false,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
      },
    ],
  },
  reportUnusedDisableDirectives: true,
};

module.exports = config;
