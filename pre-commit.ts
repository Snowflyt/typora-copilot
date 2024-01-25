import fs from "node:fs";

import replace from "replace-in-file";

import packageJSON from "./package.json";

const CONSTANTS_FILE_PATHNAME = "./src/constants.ts";

const { version } = packageJSON;

const options = {
  files: CONSTANTS_FILE_PATHNAME,
  from: /VERSION = ".*"/g,
  to: `VERSION = "${version}"`,
};

if (fs.readFileSync(CONSTANTS_FILE_PATHNAME, "utf-8").includes(options.to)) process.exit(0);

try {
  replace.sync(options);
  console.log("Plugin VERSION updated:", version);
} catch (error) {
  console.error("Error occurred while updating plugin VERSION:", error);
  process.exit(1);
}
