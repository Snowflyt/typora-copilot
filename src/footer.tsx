import { useSignal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useMemo } from "preact/hooks";
import { match } from "ts-pattern";

import CopilotIcon from "./components/CopilotIcon";
import { logger } from "./logging";
import { File } from "./typora-utils";
import { css, registerCSS } from "./utils/tools";

import type {
  CopilotAccountStatus,
  CopilotClient,
  CopilotClientEventHandler,
  CopilotStatus,
} from "./client";

registerCSS(css`
  #footer-copilot {
    margin-left: 8px;
    margin-right: 0;
    padding: 0 8px;
    opacity: 0.75;
    cursor: pointer;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }
  #footer-copilot:hover {
    opacity: 1;
  }
  #footer-copilot-panel {
    left: auto;
    right: 4px;
    top: auto;
    padding-top: 8px;
    padding-bottom: 8px;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    min-width: 160px;
  }
  .footer-copilot-panel-hint {
    padding: 0 16px;
    padding-bottom: 6px;
    font-size: 8pt;
    font-weight: normal;
    line-height: 1.8;
  }
  .footer-copilot-panel-btn {
    border: none !important;
    border-radius: 0 !important;
    padding: 3px 16px !important;
    font-size: 10pt !important;
    font-weight: normal !important;
    line-height: 1.8 !important;
  }
  .footer-copilot-panel-btn:hover {
    background-color: var(--item-hover-bg-color);
    color: var(--item-hover-text-color);
  }
`);

const getFooterBarDOM = () => document.querySelector<HTMLElement>("footer.ty-footer");

const createFooterTextColorGetter = (options?: { className?: string }) => {
  const { className = "" } = options ?? {};

  let destroyed = false;

  const getter = document.createElement("div");
  getter.style.height = "0";
  getter.style.width = "0";
  getter.style.position = "absolute";
  getter.style.left = "0";
  getter.style.top = "0";
  getter.classList.add(
    "footer-item",
    "footer-item-right",
    ...className.split(/\s+/g).filter((c) => c),
  );
  document.body.appendChild(getter);

  return {
    getFooterTextColor: () => {
      if (destroyed) throw new Error("Getter has been destroyed");
      return window.getComputedStyle(getter).color;
    },

    destroy: () => {
      destroyed = true;
      getter.remove();
    },
  };
};

const footerTextColorGetter = createFooterTextColorGetter();
export let footerTextColor = footerTextColorGetter.getFooterTextColor();
setInterval(() => {
  footerTextColor = footerTextColorGetter.getFooterTextColor();
}, 1000);

export interface FooterPanelOptions {
  copilot: CopilotClient;
  open?: boolean;
}

export const FooterPanel: FC<FooterPanelOptions> = ({ copilot, open = true }) => {
  const accountStatus = useSignal<CopilotAccountStatus>("NotSignedIn");

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
    else copilot.on("initialized", onCopilotInitialized);
  }, []);

  const bottom = useSignal(useMemo(() => (getFooterBarDOM()?.clientHeight ?? 30) + 2, []));

  // Watch footer bar height and change footer icon height accordingly
  useEffect(() => {
    const footerBar = getFooterBarDOM();
    if (!footerBar) return;
    new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) bottom.value = entry.target.clientHeight + 2;
    }).observe(footerBar);
  }, []);

  const handleSignIn = async () => {
    const { status, userCode, verificationUri } = await copilot.request.signInInitiate();
    if (status === "AlreadySignedIn") return;
    // Copy user code to clipboard
    void navigator.clipboard.writeText(userCode);
    // Open verification URI in browser
    File.editor?.EditHelper.showDialog({
      title: "Copilot Sign In",
      html: /* html */ `
        <div style="text-align: center; margin-top: 8px;">
          <span>The device activation code is:</span>
          <div style="margin-top: 8px; margin-bottom: 8px; font-size: 14pt; font-weight: bold;">
            ${userCode}
          </div>
          <span>
            It has been copied to your clipboard. Please open the following link in your browser
            and paste the code to sign in:
          </span>
          <div style="margin-top: 8px; margin-bottom: 8px;">
            <a href="${verificationUri}" target="_blank" rel="noopener noreferrer">
              Open verification page
            </a>
          </div>
          <span>Press OK <strong>after</strong> you have completed the verification.</span>
        </div>
      `,
      buttons: ["OK"],
      callback: () => {
        void copilot.request.signInConfirm({ userCode }).then(({ status }) => {
          accountStatus.value = status;
          copilot.status = "Normal";
          File.editor?.EditHelper.showDialog({
            title: "Copilot Signed In",
            html: /* html */ `
              <div style="text-align: center; margin-top: 8px;">
                <span>Sign in to Copilot successful!</span>
              </div>
            `,
            buttons: ["OK"],
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

  return (
    <div
      id="footer-copilot-panel"
      className="dropdown-menu"
      style={{
        bottom: bottom.value,
        ...(!open && { display: "none" }),
      }}>
      {accountStatus.value === "NotAuthorized" && (
        <div className="footer-copilot-panel-hint">
          Your GitHub account is not subscribed to Copilot
        </div>
      )}
      {accountStatus.value === "NotSignedIn" && (
        <button
          type="button"
          className="footer-copilot-panel-btn"
          onClick={() => void handleSignIn()}>
          Sign in to authenticate Copilot
        </button>
      )}
      {accountStatus.value !== "NotSignedIn" && (
        <button
          type="button"
          className="footer-copilot-panel-btn"
          onClick={() => void handleSignOut()}>
          Sign out
        </button>
      )}
    </div>
  );
};

export interface FooterOptions {
  copilot: CopilotClient;
}

export const Footer: FC<FooterOptions> = ({ copilot }) => {
  const status = useSignal<CopilotStatus>(copilot.status);

  // Sync status
  useEffect(() => {
    const handler: CopilotClientEventHandler<"changeStatus"> = ({ newStatus }) => {
      status.value = newStatus;
    };
    copilot.on("changeStatus", handler);
    return () => {
      copilot.off("changeStatus", handler);
    };
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
  }, []);

  const isPanelOpen = useSignal(false);

  // Close panel on click outside
  useEffect(() => {
    const listener = () => {
      isPanelOpen.value = false;
    };
    document.addEventListener("click", listener);
    return () => {
      document.removeEventListener("click", listener);
    };
  });

  // Close panel on click on spell check button or word count button
  $("#footer-spell-check, #footer-word-count").on("click", () => {
    isPanelOpen.value = !isPanelOpen.value;
  });

  return (
    <>
      <FooterPanel copilot={copilot} open={isPanelOpen.value} />

      <div
        className="footer-item footer-item-right"
        id="footer-copilot"
        ty-hint={`Copilot (${match(status.value)
          .with("Normal", () => "Ready")
          .with("InProgress", () => "In Progress")
          .otherwise(() => status.value)})`}
        data-lg="Menu"
        aria-label="Copilot"
        role="button"
        style={{ height: height.value }}
        onClick={(ev) => {
          isPanelOpen.value = !isPanelOpen.value;
          document.body.classList.remove("ty-show-spell-check", "ty-show-word-count");
          ev.stopPropagation();
        }}>
        <CopilotIcon status={status.value} textColor={footerTextColor} />
      </div>
    </>
  );
};

export const attachFooter = (copilot: CopilotClient) => {
  const footerBar = getFooterBarDOM();
  if (footerBar) {
    const container = document.createElement("div");
    const firstFooterItemRight = $(footerBar).find(".footer-item-right")[0];
    if (firstFooterItemRight) firstFooterItemRight.insertAdjacentElement("beforebegin", container);
    else footerBar.appendChild(container);
    const footer = <Footer copilot={copilot} />;
    render(footer, container);
  }
};
