import { useSignal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useMemo } from "preact/hooks";

import type {
  CopilotAccountStatus,
  CopilotClient,
  CopilotClientEventHandler,
  CopilotStatus,
} from "./client";
import { attachChatPanel, detachChatPanel } from "./components/ChatPanel";
import CopilotIcon from "./components/CopilotIcon";
import SettingsPanel from "./components/SettingsPanel";
import { t } from "./i18n";
import { logger } from "./logging";
import { settings } from "./settings";
import { getCSSClassStyles } from "./utils/dom";

import "./footer.scss";

/**
 * Get DOM element of Typora footer bar.
 * @returns
 */
const getFooterBarDOM = () => document.querySelector<HTMLElement>("footer.ty-footer");

const getFooterTextColor = () => getCSSClassStyles("footer-item", "footer-item-right").color;

export interface FooterPanelOptions {
  copilot: CopilotClient;
  open?: boolean;
}

/**
 * Panel for the user to control Copilot.
 * @returns
 */
export const FooterPanel: FC<FooterPanelOptions> = ({ copilot, open = true }) => {
  const accountStatus = useSignal<CopilotAccountStatus>("NotSignedIn");
  const disableCompletions = useSignal(settings.disableCompletions);

  // Initialize account status
  useEffect(() => {
    const onCopilotInitialized = async () => {
      const { status } = await copilot.request.checkStatus().catch((e) => {
        logger.error("Failed to check Copilot account status.", e);
        return { status: "CheckFailed" as const };
      });
      if (status === "CheckFailed") {
        copilot.status = "Warning";
        return;
      }
      accountStatus.value = status;
      if (status !== "OK") copilot.status = "Warning";
      else copilot.status = "Normal";
    };
    if (copilot.initialized) void onCopilotInitialized();
    else
      copilot.on("initialized", () => {
        // Delay `checkStatus` call to next tick to avoid a maybe BUG of GitHub Copilot LSP server
        void Promise.resolve(null).then(onCopilotInitialized);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync settings
  useEffect(() => {
    const unlistenSettingsChange = settings.onChange("disableCompletions", (value) => {
      disableCompletions.value = value;
    });
    return () => {
      unlistenSettingsChange();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Distance from the element bottom to App bottom.
   */
  const bottom = useSignal(useMemo(() => (getFooterBarDOM()?.clientHeight ?? 30) + 2, []));

  // Watch footer bar height and change footer icon height accordingly
  useEffect(() => {
    const footerBar = getFooterBarDOM();
    if (!footerBar) return;
    new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) bottom.value = entry.target.clientHeight + 2;
    }).observe(footerBar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignIn = async () => {
    let response!: Awaited<ReturnType<CopilotClient["request"]["signInInitiate"]>>;
    try {
      response = await copilot.request.signInInitiate();
    } catch (e) {
      Files.editor?.EditHelper.showDialog({
        title: t("dialog.sign-in-request-failed.title"),
        html: /* html */ `
          <div style="text-align: center; margin-top: 8px;">
            ${t("dialog.sign-in-request-failed.html")}
          </div>
        `,
        buttons: [t("button.understand")],
      });
      return;
    }
    const { status, userCode, verificationUri } = response;
    if (status === "AlreadySignedIn") return;
    // Copy user code to clipboard
    void navigator.clipboard.writeText(userCode);
    // Open verification URI in browser
    Files.editor?.EditHelper.showDialog({
      title: t("dialog.sign-in.title"),
      html: /* html */ `
        <div style="text-align: center; margin-top: 8px;">
          ${t("dialog.sign-in.html")
            .replace("{{USER_CODE}}", userCode)
            .replace("{{VERIFICATION_URI}}", verificationUri)}
        </div>
      `,
      buttons: [t("button.ok")],
      callback: () => {
        copilot.request
          .signInConfirm({ userCode })
          .then(({ status }) => {
            accountStatus.value = status;
            copilot.status = "Normal";
            Files.editor?.EditHelper.showDialog({
              title: t("dialog.signed-in.title"),
              html: /* html */ `
                <div style="text-align: center; margin-top: 8px;">
                  ${t("dialog.signed-in.html")}
                </div>
              `,
              buttons: [t("button.ok")],
            });
          })
          .catch(() => {
            Files.editor?.EditHelper.showDialog({
              title: t("dialog.sign-in-verification-failed.title"),
              html: /* html */ `
                <div style="text-align: center; margin-top: 8px;">
                  ${t("dialog.sign-in-verification-failed.html")}
                </div>
              `,
              buttons: [t("button.understand")],
            });
          });
      },
    });
  };

  const handleSignOut = async () => {
    await copilot.request.signOut();
    accountStatus.value = "NotSignedIn";
    copilot.status = "Warning";
  };

  const settingsPanelOpen = useSignal(false);

  return (
    <>
      {settingsPanelOpen.value && (
        <SettingsPanel
          onClose={() => {
            settingsPanelOpen.value = false;
          }}
        />
      )}

      <div
        id="footer-copilot-panel"
        className="dropdown-menu"
        style={{
          bottom: bottom.value,
          ...(!open && { display: "none" }),
        }}>
        {accountStatus.value === "NotAuthorized" && (
          <div className="footer-copilot-panel-hint">{t("footer.menu.not-authorized")}</div>
        )}
        {accountStatus.value === "NotSignedIn" && (
          <button
            type="button"
            className="footer-copilot-panel-btn"
            onClick={() => void handleSignIn()}>
            {t("footer.menu.sign-in")}
          </button>
        )}
        {accountStatus.value !== "NotSignedIn" && (
          <button
            type="button"
            className="footer-copilot-panel-btn"
            onClick={() => void handleSignOut()}>
            {t("footer.menu.sign-out")}
          </button>
        )}
        <button
          type="button"
          className="footer-copilot-panel-btn"
          onClick={() => {
            disableCompletions.value = !disableCompletions.value;
            settings.disableCompletions = disableCompletions.value;
          }}>
          {t(`footer.menu.${disableCompletions.value ? "enable" : "disable"}-completions`)}
        </button>
        <button
          type="button"
          className="footer-copilot-panel-btn"
          onClick={() => {
            settingsPanelOpen.value = true;
          }}>
          {t("footer.menu.settings")}
        </button>
      </div>
    </>
  );
};

export interface FooterOptions {
  copilot: CopilotClient;
}

/**
 * Footer of the plugin with an icon.
 * @returns
 */
export const Footer: FC<FooterOptions> = ({ copilot }) => {
  const status = useSignal<CopilotStatus | "Disabled">(
    settings.disableCompletions ? "Disabled" : copilot.status,
  );

  // Sync status
  useEffect(() => {
    const unlistenSettingsChange = settings.onChange("disableCompletions", (value) => {
      status.value = value ? "Disabled" : copilot.status;
    });
    const handler: CopilotClientEventHandler<"changeStatus"> = ({ newStatus }) => {
      if (status.value === "Disabled") return;
      status.value = newStatus;
    };
    copilot.on("changeStatus", handler);
    return () => {
      unlistenSettingsChange();
      copilot.off("changeStatus", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const height = useSignal(useMemo(() => getFooterBarDOM()?.clientHeight ?? 30, []));

  // Watch footer bar height and change footer icon height accordingly
  useEffect(() => {
    const footerBar = getFooterBarDOM();
    if (!footerBar) return;
    new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) height.value = entry.target.clientHeight;
    }).observe(footerBar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPanelOpen = useSignal(false);

  // Close panel on click outside
  useEffect(() => {
    const listener = () => {
      isPanelOpen.value = false;
    };
    document.addEventListener("click", listener);
    $("content").on("click", listener);
    return () => {
      document.removeEventListener("click", listener);
      $("content").off("click", listener);
    };
  }, [isPanelOpen]);

  // Close panel on click on spell check button or word count button
  $("#footer-spell-check, #footer-word-count").on("click", () => {
    isPanelOpen.value = !isPanelOpen.value;
  });

  // Remember chat panel open state
  useEffect(() => {
    if (localStorage.getItem("copilot-chat-panel-open") === "true") attachChatPanel();
  }, []);

  return (
    <>
      {/* Settings panel */}
      <FooterPanel copilot={copilot} open={isPanelOpen.value} />

      {/* Main footer item */}
      <div
        className="footer-item footer-item-right"
        id="footer-copilot"
        style={{ height: height.value, display: "flex", alignItems: "center" }}
        ty-hint={"Copilot (" + t(`copilot-status.${status.value}`) + ")"}>
        {/* Main Copilot icon - opens chat */}
        <div
          className="footer-copilot-icon"
          aria-label="Open Copilot Chat"
          role="button"
          onClick={(ev) => {
            isPanelOpen.value = false;
            document.body.classList.remove("ty-show-spell-check", "ty-show-word-count");
            const chatContainer = document.querySelector("#copilot-chat-container");
            if (chatContainer) {
              detachChatPanel?.();
            } else {
              attachChatPanel();
            }
            ev.stopPropagation();
          }}>
          <CopilotIcon status={status.value} textColor={getFooterTextColor()} />
        </div>

        {/* Arrow button - opens settings menu */}
        <div
          className="footer-copilot-menu-button"
          aria-label="Copilot Settings"
          role="button"
          onClick={(ev) => {
            isPanelOpen.value = !isPanelOpen.value;
            document.body.classList.remove("ty-show-spell-check", "ty-show-word-count");
            ev.stopPropagation();
          }}>
          <svg
            width="8"
            height="4"
            viewBox="0 0 8 4"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path d="M4 0L8 4H0L4 0Z" fill={getFooterTextColor()} />
          </svg>
        </div>
      </div>
    </>
  );
};

/**
 * Create and attach footer element to DOM.
 * @param copilot The Copilot client.
 * @returns A function that can be used to remove the footer element from the DOM.
 */
export const attachFooter = (copilot: CopilotClient) => {
  const container = document.createElement("div");

  const footerBar = getFooterBarDOM();
  if (footerBar) {
    const firstFooterItemRight = $(footerBar).find(".footer-item-right")[0];
    if (firstFooterItemRight) firstFooterItemRight.insertAdjacentElement("beforebegin", container);
    else footerBar.appendChild(container);
  } else {
    container.style.position = "fixed";
    container.style.bottom = "0.125rem";
    container.style.right = "0.75rem";
    container.style.zIndex = "1000";
    container.style.height = "2rem";
    container.style.width = "3.5rem";
    document.querySelector("content")!.appendChild(container);
  }

  const footer = <Footer copilot={copilot} />;
  render(footer, container);

  return () => {
    render(null, container);
    container.remove();
  };
};
