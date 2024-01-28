import * as path from "@modules/path";
import { pathToFileURL } from "@modules/url";

import Spinner from "./Spinner";

import type { CopilotStatus } from "@/client";

import { COPILOT_ICON_PATHNAME } from "@/constants";

export interface CopilotIconProps {
  status: CopilotStatus;
  textColor: string;
}

/**
 * Icon of Copilot, change according to status.
 * @returns
 */
const CopilotIcon: FC<CopilotIconProps> = ({ status, textColor }) => {
  if (status === "InProgress")
    return (
      <div
        style={{
          height: "50%",
          aspectRatio: "1 / 1",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <Spinner color={textColor} />
      </div>
    );

  let copilotIconPosixPathname = path.posix.join(
    ...(status === "Normal" ? COPILOT_ICON_PATHNAME.NORMAL : COPILOT_ICON_PATHNAME.WARNING).split(
      path.sep,
    ),
  );
  if (!(File as ExtendedFileConstructor).isWin && !copilotIconPosixPathname.startsWith("/"))
    copilotIconPosixPathname = "/" + copilotIconPosixPathname;
  copilotIconPosixPathname = pathToFileURL(copilotIconPosixPathname).href;

  return (
    <div
      style={{
        height: "50%",
        aspectRatio: "1 / 1",
        backgroundColor: textColor,
        webkitMaskImage: `url('${copilotIconPosixPathname}')`,
        maskImage: `url('${copilotIconPosixPathname}')`,
        webkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        webkitMaskPosition: "center",
        maskPosition: "center",
        webkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
};

export default CopilotIcon;
