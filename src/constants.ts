import * as path from "@modules/path";

import { TYPORA_RESOURCE_DIR } from "./typora-utils";
import { setGlobalVar } from "./utils/tools";

/**
 * Plugin version.
 */
export const VERSION = "0.2.7";

/**
 * Copilot plugin directory.
 */
export const PLUGIN_DIR = path.join(TYPORA_RESOURCE_DIR, "copilot");
setGlobalVar("__copilotDir", PLUGIN_DIR);

/**
 * Copilot icon pathnames.
 */
export const COPILOT_ICON_PATHNAME = {
  /**
   * Normal icon.
   */
  NORMAL: path.join(PLUGIN_DIR, "assets", "copilot-icon.png"),
  /**
   * Warning icon.
   */
  WARNING: path.join(PLUGIN_DIR, "assets", "copilot-icon-warning.png"),
};
