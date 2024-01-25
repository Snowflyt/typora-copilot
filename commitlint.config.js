// @ts-check

/**
 * @typedef {object} Parsed
 * @property {?string} emoji
 * @property {?string} type
 * @property {?string} scope
 * @property {?string} subject
 */

const emojiEnum = /** @type {const} */ ([
  2,
  "always",
  {
    "🎉": ["init", "Project initialization"],
    "✨": ["feat", "Adding new features"],
    "🐞": ["fix", "Fixing bugs"],
    "📃": ["docs", "Modify documentation only"],
    "🌈": [
      "style",
      "Only the spaces, formatting indentation, commas, etc. were changed, not the code logic",
    ],
    "🦄": ["refactor", "Code refactoring, no new features added or bugs fixed"],
    "🎈": ["perf", "Optimization-related, such as improving performance, experience"],
    "🧪": ["test", "Adding or modifying test cases"],
    "🔧": [
      "build",
      "Dependency-related content, such as Webpack, Vite, Rollup, npm, package.json, etc.",
    ],
    "🐎": ["ci", "CI configuration related, e.g. changes to k8s, docker configuration files"],
    "🐳": ["chore", "Other modifications, e.g. modify the configuration file"],
    "↩": ["revert", "Rollback to previous version"],
  },
]);

/** @satisfies {import("@commitlint/types").UserConfig} */
const config = {
  parserPreset: {
    parserOpts: {
      headerPattern:
        /^(?<emoji>\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]) (?<type>\w+)(?:\((?<scope>.*)\))?!?: (?<subject>(?:(?!#).)*(?:(?!\s).))$/,
      headerCorrespondence: ["emoji", "type", "scope", "subject"],
    },
  },
  plugins: [
    {
      rules: {
        "header-match-git-commit-message-with-emoji-pattern": (parsed) => {
          const { emoji, scope, subject, type } = /** @type {Parsed} */ (
            /** @type {unknown} */ (parsed)
          );
          if (emoji === null && type === null && scope === null && subject === null)
            return [
              false,
              'header must be in format "<emoji> <type>(<scope>?): <subject>", e.g:\n' +
                "    - 🎉 init: Initial commit\n" +
                "    - ✨ feat(assertions): Add assertions\n" +
                "   ",
            ];
          return [true, ""];
        },
        "emoji-enum": (parsed, _, value) => {
          const { emoji } = /** @type {Parsed} */ (/** @type {unknown} */ (parsed));
          const emojisObject = /** @type {typeof emojiEnum[2]} */ (/** @type {unknown} */ (value));
          if (emoji && !Object.keys(emojisObject).includes(emoji)) {
            return [
              false,
              "emoji must be one of:\n" +
                Object.entries(emojisObject)
                  .map(([emoji, [type, description]]) => `    ${emoji} ${type} - ${description}`)
                  .join("\n") +
                "\n   ",
            ];
          }
          return [true, ""];
        },
      },
    },
  ],
  rules: {
    "header-match-git-commit-message-with-emoji-pattern": [2, "always"],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
    "header-max-length": [2, "always", 72],
    "scope-case": [2, "always", ["lower-case", "upper-case"]],
    "subject-case": [2, "always", "sentence-case"],
    "subject-empty": [2, "never"],
    "subject-exclamation-mark": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "emoji-enum": emojiEnum,
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "type-enum": [
      2,
      "always",
      [
        "init",
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
  },
};

export default config;
