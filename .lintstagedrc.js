// @ts-check

/** @satisfies {import("lint-staged").Config} */
const config = {
  "{src,test}/**/*.{js,jsx,ts,tsx}":
    "eslint --fix --no-error-on-unmatched-pattern --report-unused-disable-directives-severity error --max-warnings 0",
  "*.{js,cjs,mjs,ts,cts,mts}":
    "eslint --fix --no-error-on-unmatched-pattern --report-unused-disable-directives-severity error --max-warnings 0",
  "src/**/*.{css,scss}": "stylelint --fix",
  "{src,test}/**/*.json": "prettier --log-level=silent --no-error-on-unmatched-pattern --write",
  "*.{json,md}": "prettier --log-level=silent --no-error-on-unmatched-pattern --write",
};

export default config;
