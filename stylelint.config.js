// @ts-check

/** @satisfies {import("stylelint").Config} */
const config = {
  extends: "stylelint-config-standard-scss",
  rules: {
    "color-function-alias-notation": "with-alpha",
    "color-function-notation": "legacy",
  },
};

export default config;
