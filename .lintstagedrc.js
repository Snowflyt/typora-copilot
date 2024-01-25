// @ts-check

/** @satisfies {import("lint-staged").Config} */
const config = {
  "{src,test}/**/*.{js,jsx,ts,tsx}": "eslint --fix",
  "*.{js,cjs,mjs,ts,cts,mts}": "eslint --fix",
  "{src,test}/**/*.json": "prettier --loglevel=silent --write",
  "*.{json,md}": "prettier --loglevel=silent --write",
  ".hintrc": "prettier --loglevel=silent --write --parser json",
};

export default config;
