import { fork } from "@modules/child_process";
import * as path from "@modules/path";
import { pathToFileURL } from "@modules/url";

import { debounce } from "lodash-es";

import { createCopilotClient } from "./client";
import { VERSION } from "./constants";
import {
  File,
  TYPORA_RESOURCE_DIR,
  TYPORA_VERSION,
  getCursorPlacement,
  waitUntilEditorInitialized,
} from "./typora-utils";
import { createLogger } from "./utils/logging";
import { css, registerCSS, setGlobalVar, sliceTextByRange } from "./utils/tools";

import type { Completion, CopilotAccountStatus, CopilotStatus } from "./client";
import type { Position } from "./types/lsp";
import type { ChildProcessWithoutNullStreams } from "@modules/child_process";

const COPILOT_DIR = path.join(TYPORA_RESOURCE_DIR, "copilot");
setGlobalVar("__copilotDir", COPILOT_DIR);
const COPILOT_ICON_PATHNAME = path.join(COPILOT_DIR, "assets", "copilot-icon.png");
const COPILOT_WARNING_ICON_PATHNAME = path.join(COPILOT_DIR, "assets", "copilot-icon-warning.png");

const server = fork(path.join(COPILOT_DIR, "language-server", "agent"), { silent: true });

const logger = createLogger({ prefix: `\x1b[1mCopilot plugin:\x1b[0m ` });
logger.info("Copilot plugin activated. Version:", VERSION);
logger.debug("Copilot LSP server started. PID:", server.pid);

/**
 * Copilot LSP client.
 */
const copilot = createCopilotClient(server as ChildProcessWithoutNullStreams, { logging: "debug" });
setGlobalVar("copilot", copilot);

// Register CSS for completion text to use
registerCSS(css`
  .text-gray {
    color: gray !important;
  }
  .font-italic {
    font-style: italic !important;
  }
  .completion-panel {
    position: absolute;
    z-index: 9999;
    pointer-events: none;
    white-space: pre-wrap;
    border: 1px solid #ccc;
    display: flex;
    flex-direction: column;
    padding: 0.5em;
    border-radius: 5px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
  }
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

/**
 * Fake temporary workspace folder, only used when no folder is opened.
 */
const FAKE_TEMP_WORKSPACE_FOLDER = File.isWin
  ? "C:\\Users\\FakeUser\\FakeTyporaCopilotWorkspace"
  : "/home/fakeuser/faketyporacopilotworkspace";
const FAKE_TEMP_FILENAME = "typora-copilot-fake-markdown.md";

/* Footer stuff start */
const footerContainer: HTMLElement | null = document.querySelector("footer.ty-footer");
const footerTextColorGetterElement = document.createElement("div");
footerTextColorGetterElement.style.height = "0";
footerTextColorGetterElement.style.width = "0";
footerTextColorGetterElement.style.position = "absolute";
footerTextColorGetterElement.style.left = "0";
footerTextColorGetterElement.style.top = "0";
footerTextColorGetterElement.classList.add("footer-item", "footer-item-right");
document.body.appendChild(footerTextColorGetterElement);
/**
 * Text color of footer.
 */
let footerTextColor = window.getComputedStyle(footerTextColorGetterElement).color;
setInterval(() => {
  const newTextColor = window.getComputedStyle(footerTextColorGetterElement).color;
  if (newTextColor !== footerTextColor) {
    footerTextColor = newTextColor;
    footer.childNodes.forEach((node) => {
      node.remove();
    });
    const icon = createCopilotIcon(copilot.status);
    footer.appendChild(icon);
  }
}, 1000);

// Update footer icon when Copilot status changes
copilot.on("changeStatus", ({ newStatus: status }) => {
  footer.childNodes.forEach((node) => {
    node.remove();
  });
  const icon = createCopilotIcon(status);
  footer.appendChild(icon);
  footer.setAttribute(
    "ty-hint",
    `Copilot (${status === "Normal" ? "Ready" : status === "InProgress" ? "In Progress" : status})`,
  );
});

/**
 * Create Copilot footer icon DOM element by status.
 * @param status Status of Copilot.
 */
const createCopilotIcon = (status: CopilotStatus) => {
  if (status === "InProgress") {
    // Use a svg spinner
    const result = document.createElement("div");
    result.style.height = "50%";
    result.style.aspectRatio = "1 / 1";
    result.style.display = "flex";
    result.style.flexDirection = "row";
    result.style.alignItems = "center";
    result.style.justifyContent = "center";
    result.innerHTML = /* html */ `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <style>
          .spinner_aj0A {
            transform-origin: center;
            animation: spinner_KYSC .75s infinite linear
          }
          @keyframes spinner_KYSC {
            100% {
              transform:rotate(360deg)
            }
          }
        </style>
        <path
          d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
          class="spinner_aj0A"
          fill="${footerTextColor}"
        />
      </svg>
    `;
    return result;
  } else {
    const result = document.createElement("div");
    result.style.height = "50%";
    result.style.aspectRatio = "1 / 1";
    result.style.backgroundColor = footerTextColor;
    result.style.webkitMaskImage = `url('${path.posix.join(
      ...(status === "Normal" ? COPILOT_ICON_PATHNAME : COPILOT_WARNING_ICON_PATHNAME).split(
        path.sep,
      ),
    )}')`;
    result.style.maskImage = `url('${path.posix.join(
      ...(status === "Normal" ? COPILOT_ICON_PATHNAME : COPILOT_WARNING_ICON_PATHNAME).split(
        path.sep,
      ),
    )}')`;
    result.style.webkitMaskRepeat = "no-repeat";
    result.style.maskRepeat = "no-repeat";
    result.style.webkitMaskPosition = "center";
    result.style.maskPosition = "center";
    result.style.webkitMaskSize = "contain";
    result.style.maskSize = "contain";
    return result;
  }
};

/**
 * Footer container for Copilot.
 */
const footer = document.createElement("div");
footer.classList.add("footer-item", "footer-item-right");
footer.id = "footer-copilot";
footer.setAttribute("ty-hint", "Copilot (Ready)");
footer.setAttribute("data-lg", "Menu");
footer.setAttribute("aria-label", "Copilot");
footer.style.height = (footerContainer?.clientHeight ?? 30) + "px";
if (footerContainer)
  new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) {
      footer.style.height = entry.target.clientHeight + "px";
      footerPanel.style.bottom = entry.target.clientHeight + 2 + "px";
    }
  }).observe(footerContainer);
footer.addEventListener("click", (ev) => {
  if (footerPanel.style.display === "none") {
    footerPanel.style.removeProperty("display");
    document.body.classList.remove("ty-show-spell-check", "ty-show-word-count");
  } else {
    footerPanel.style.display = "none";
  }
  ev.stopPropagation();
});
document.addEventListener("click", () => {
  footerPanel.style.display = "none";
});
document.querySelector("#footer-spell-check")?.addEventListener("click", () => {
  footerPanel.style.display = "none";
});
document.querySelector("#footer-word-count")?.addEventListener("click", () => {
  footerPanel.style.display = "none";
});
footer.appendChild(createCopilotIcon("Normal"));
if (footerContainer) {
  const firstFooterItemRight = footerContainer.querySelector(".footer-item-right");
  if (firstFooterItemRight) firstFooterItemRight.insertAdjacentElement("beforebegin", footer);
  else footerContainer.appendChild(footer);
}

/**
 * Reset account status.
 * @param status Status of Copilot account.
 */
const resetAccountStatus = (status: CopilotAccountStatus) => {
  if (status !== "NotSignedIn") {
    footerPanelBtnSignIn.style.display = "none";
    footerPanelBtnSignOut.style.display = "block";
  } else {
    footerPanelBtnSignIn.style.display = "block";
    footerPanelBtnSignOut.style.display = "none";
  }
  if (status === "NotAuthorized") footerNoSubscribeHint.style.display = "block";
  else footerNoSubscribeHint.style.display = "none";
  if (status !== "OK") copilot.status = "Warning";
  else copilot.status = "Normal";
};

const footerPanel = document.createElement("div");
footerPanel.id = "footer-copilot-panel";
footerPanel.classList.add("dropdown-menu");
footerPanel.style.display = "none";
const footerNoSubscribeHint = document.createElement("div");
footerNoSubscribeHint.classList.add("footer-copilot-panel-hint");
footerNoSubscribeHint.textContent = "Your GitHub account is not subscribed to Copilot";
footerNoSubscribeHint.style.display = "none";
footerPanel.appendChild(footerNoSubscribeHint);
const footerPanelBtnSignIn = document.createElement("button");
footerPanelBtnSignIn.classList.add("footer-copilot-panel-btn");
footerPanelBtnSignIn.textContent = "Sign in to authenticate Copilot";
footerPanel.appendChild(footerPanelBtnSignIn);
footerPanelBtnSignIn.addEventListener("click", () => {
  void (async () => {
    const { status, userCode, verificationUri } = await copilot.request.signInInitiate();
    if (status === "AlreadySignedIn") return;
    // Copy user code to clipboard
    void navigator.clipboard.writeText(userCode);
    // Open verification URI in browser
    // // @ts-expect-error - `electron` is not declared in types
    // require("electron").shell.openExternal(verificationUri);
    File.editor.EditHelper.showDialog({
      title: "Copilot Sign In",
      html: /* html */ `
      <div style="text-align: center; margin-top: 8px;">
        <span>The device activation code is:</span>
        <div style="margin-top: 8px; margin-bottom: 8px; font-size: 14pt; font-weight: bold;">${userCode}</div>
        <span>It has been copied to your clipboard. Please paste it in the popup GitHub page.</span>
        <span>If the popup page does not show up, please open the following link in your browser:</span>
        <div style="margin-top: 8px; margin-bottom: 8px;">
          <a href="${verificationUri}" target="_blank" rel="noopener noreferrer">Open verification page</a>
        </div>
        <span>Press OK <strong>after</strong> you have completed the verification.</span>
      </div>
    `,
      buttons: ["OK"],
      callback: () => {
        void copilot.request.signInConfirm({ userCode }).then(({ status }) => {
          resetAccountStatus(status);
          File.editor.EditHelper.showDialog({
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
  })();
});
const footerPanelBtnSignOut = document.createElement("button");
footerPanelBtnSignOut.classList.add("footer-copilot-panel-btn");
footerPanelBtnSignOut.textContent = "Sign out";
footerPanelBtnSignOut.style.display = "none";
footerPanelBtnSignOut.addEventListener("click", () => {
  void copilot.request.signOut().then(({ status }) => {
    resetAccountStatus(status);
  });
});
footerPanel.appendChild(footerPanelBtnSignOut);
document.body.appendChild(footerPanel);
/* Footer stuff end */

/**
 * Main function.
 */
const main = async () => {
  /*********************
   * Utility functions *
   *********************/
  /**
   * Get workspace folder path.
   * @returns
   */
  const getWorkspaceFolder = (): string | null => editor.library?.watchedFolder ?? null;
  /**
   * Get active file pathname.
   * @returns
   */
  const getActiveFilePathname = (): string | null =>
    (File.filePath ?? (File.bundle && File.bundle.filePath)) || null;

  /**
   * Get current cursor position in source markdown text.
   * @returns
   */
  const getCursorPos = (): Position | null => {
    // When selection, return null
    if (sourceView.inSourceMode) {
      if (cm.getSelection()) return null;
    } else {
      const rangy = editor.selection.getRangy();
      if (!rangy) return null;
      if (!rangy.collapsed) return null;
    }

    /* If in source mode, simply return cursor position get from `cm` */
    if (sourceView.inSourceMode) {
      const { ch, line } = cm.getCursor();
      return { line, character: ch };
    }

    /* When in live preview mode, calculate cursor position */
    // First sync `cm` with live preview mode markdown text
    // @ts-expect-error - CodeMirror supports 2nd parameter, but not declared in types
    cm.setValue(editor.getMarkdown(), "begin");

    let placement: Typora.CursorPlacement | null;
    try {
      placement = getCursorPlacement();
    } catch (e) {
      if (e instanceof Error && e.stack) console.warn(e.stack);
      return null;
    }
    if (!placement) return null;

    let lineContent: string | null;
    let ch = placement.ch;

    // If line number is negative, set it to the last line
    if (placement.line < 0) placement.line = cm.lineCount() - 1;

    // Handle indentation after list items, blockquotes, etc.
    if (placement.afterIndent) {
      lineContent = cm.getLine(placement.line);
      ch = (/^((\s+)|([-+*]\s)|(\[( |x)\])|>|(\d+(\.|\))\s))+/i.exec(lineContent) || [""])[0]
        .length;
    }

    // If character position is not defined
    if (ch === undefined) {
      lineContent = cm.getLine(placement.line) ?? "";
      if (placement.before) {
        // Find the position of the 'before' text
        ch = lineContent.indexOf(placement.before) + placement.before.length;
      } else if (placement.beforeRegExp) {
        // Find the position based on regular expression
        const pattern = new RegExp(placement.beforeRegExp, "g");
        pattern.exec(lineContent);
        ch = pattern.lastIndex;
      }
    }

    return { line: placement.line, character: ch !== undefined && ch > 0 ? ch : 0 };
  };

  /**
   * Insert completion text to editor.
   * @param options Completion options.
   * @returns
   */
  const insertCompletionTextToEditor = (options: Completion) => {
    const { displayText, position, range, text } = options;

    const activeElement = document.activeElement;
    if (!activeElement) return;

    // When in input, do not insert completion text
    if (
      "INPUT" === activeElement.tagName ||
      (activeElement.classList && activeElement.classList.contains("ty-input"))
    )
      return;

    // When not in writer, do not insert completion text
    if ("BODY" === activeElement.tagName) return;

    // If in a code block, use the cm way to insert completion text
    if ("TEXTAREA" === activeElement.tagName) {
      const cms = $(activeElement).closest(".CodeMirror");
      if (!cms || !cms.length) return;
      const cm = (cms[0] as unknown as { CodeMirror: CodeMirror.Editor }).CodeMirror;
      const subCmCompletion = { ...options };
      const startPos = getCursorPos()!;
      startPos.line -= cm.getValue().split(File.useCRLF ? "\r\n" : "\n").length - 1;
      startPos.character -= cm.getCursor().ch;
      // Set `position` and `range` to be relative to `startPos`
      subCmCompletion.position = {
        line: position.line - startPos.line,
        character: position.character - startPos.character,
      };
      subCmCompletion.range = {
        start: {
          line: range.start.line - startPos.line,
          character: range.start.character - startPos.character,
        },
        end: {
          line: range.end.line - startPos.line,
          character: range.end.character - startPos.character,
        },
      };
      // Get the code block starter "```" or "~~~"
      const codeBlockStarter = state.markdown
        .split(File.useCRLF ? "\r\n" : "\n")
        [startPos.line - 1]!.slice(startPos.character, startPos.character + 3);
      // Get only completion text before code block starter, as in Typora code block it is not possible
      // to insert a new code block or end one using "```" or "~~~"
      const indexOfCodeBlockStarter = subCmCompletion.text.indexOf(codeBlockStarter);
      if (indexOfCodeBlockStarter !== -1) {
        subCmCompletion.displayText = subCmCompletion.displayText.slice(
          0,
          subCmCompletion.displayText.indexOf(codeBlockStarter),
        );
        subCmCompletion.text = subCmCompletion.text.slice(0, indexOfCodeBlockStarter);
        const textAfterCodeBlockStarter = subCmCompletion.text.slice(indexOfCodeBlockStarter);
        // Reduce `subCmCompletion.range` to only include text before code block starter
        const rows = textAfterCodeBlockStarter.split(File.useCRLF ? "\r\n" : "\n").length - 1;
        subCmCompletion.range.end.line -= rows;
        subCmCompletion.range.end.character = textAfterCodeBlockStarter
          .split(File.useCRLF ? "\r\n" : "\n")
          .pop()!.length;
      }
      insertCompletionTextToCodeMirror(cm, subCmCompletion);

      return;
    }

    const focusedElem = document.querySelector(`[cid=${editor.focusCid}]`);
    if (!focusedElem) return;
    if (!(focusedElem instanceof HTMLElement)) return;

    const getMouseCursorPosition = (): { x: number; y: number } | null => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0).cloneRange();
        const caret = document.createElement("span");
        range.insertNode(caret);
        const rect = caret.getBoundingClientRect();
        if (caret.parentNode) caret.parentNode.removeChild(caret);
        return { x: rect.left, y: rect.top };
      }
      return null;
    };
    const pos = getMouseCursorPosition();
    if (!pos) return;

    // Insert a completion panel below the cursor
    const completionPanel = document.createElement("div");
    const maxAvailableWidth =
      editor.writingArea.getBoundingClientRect().width -
      (pos.x - editor.writingArea.getBoundingClientRect().left) -
      30;
    completionPanel.classList.add("completion-panel");
    completionPanel.style.visibility = "hidden";
    completionPanel.style.left = "0";
    completionPanel.style.top = `calc(${pos.y}px + 1.5em)`;
    completionPanel.style.maxWidth = `min(80ch, max(40ch, ${maxAvailableWidth}px))`;
    completionPanel.style.backgroundColor = window.getComputedStyle(document.body).backgroundColor;
    completionPanel.style.color = window.getComputedStyle(document.body).color;
    const code = document.createElement("textarea");
    code.style.padding = "0";
    code.innerText = displayText;
    completionPanel.appendChild(code);
    const hint = document.createElement("div");
    hint.style.color = footerTextColor;
    hint.style.marginTop = "0.25em";
    hint.style.marginLeft = "0.25em";
    hint.style.display = "flex";
    hint.style.flexDirection = "row";
    hint.style.alignItems = "center";
    const icon = document.createElement("div");
    icon.style.marginRight = "0.4em";
    icon.style.height = "1em";
    icon.style.width = "1em";
    icon.style.backgroundColor = footerTextColor;
    icon.style.webkitMaskImage = `url('${path.posix.join(
      ...COPILOT_ICON_PATHNAME.split(path.sep),
    )}')`;
    icon.style.maskImage = `url('${path.posix.join(...COPILOT_ICON_PATHNAME.split(path.sep))}')`;
    icon.style.webkitMaskRepeat = "no-repeat";
    icon.style.maskRepeat = "no-repeat";
    icon.style.webkitMaskPosition = "center";
    icon.style.maskPosition = "center";
    icon.style.webkitMaskSize = "contain";
    icon.style.maskSize = "contain";
    hint.appendChild(icon);
    const hintText = document.createElement("span");
    hintText.style.marginRight = "0.25em";
    hintText.innerText = "Generated by GitHub Copilot";
    hint.appendChild(hintText);
    completionPanel.appendChild(hint);
    document.body.appendChild(completionPanel);
    const actualWidth = completionPanel.getBoundingClientRect().width;
    completionPanel.style.left = `min(${pos.x}px, calc(${pos.x}px + ${maxAvailableWidth}px - ${actualWidth}px))`;
    completionPanel.style.visibility = "visible";
    const completionPanelCm = CodeMirror.fromTextArea(code, {
      lineWrapping: true,
      mode: "gfm",
      theme: "typora-default",
      maxHighlightLength: Infinity,
      // @ts-expect-error - Extracted from Typora. I don't really know if this prop is used,
      // but to be safe, I just keep it like original
      styleActiveLine: true,
      visibleSpace: true,
      autoCloseTags: true,
      resetSelectionOnContextMenu: false,
      lineNumbers: false,
      dragDrop: false,
    });
    code.style.backgroundColor = window.getComputedStyle(document.body).backgroundColor;
    completionPanelCm.getWrapperElement().style.backgroundColor = window.getComputedStyle(
      document.body,
    ).backgroundColor;
    completionPanelCm.getWrapperElement().style.padding = "0";
    Array.from(completionPanelCm.getWrapperElement().children).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.classList.contains("CodeMirror-hscrollbar")) {
        node.remove();
        return;
      }
      node.style.backgroundColor = window.getComputedStyle(document.body).backgroundColor;
    });
    completionPanelCm
      .getWrapperElement()
      .querySelectorAll(".CodeMirror-activeline-background")
      .forEach((node) => {
        node.remove();
      });

    copilot.notification.notifyShown({ uuid: options.uuid });

    const scrollListener = () => {
      const pos = getMouseCursorPosition();
      if (!pos) return;
      completionPanel.style.top = `calc(${pos.y}px + 1.5em)`;
    };
    document.querySelector("content")?.addEventListener("scroll", scrollListener);

    /**
     * Reject the completion.
     */
    const _reject = () => {
      if (completion.reject === reject) completion.reject = null;
      if (completion.accept === accept) completion.accept = null;
      if (finished) return;

      finished = true;

      completionPanel.remove();

      copilot.notification.notifyRejected({ uuids: [options.uuid] });

      logger.debug("Rejected completion", options.uuid);
    };
    /**
     * Accept the completion.
     */
    const _accept = () => {
      if (completion.accept === accept) completion.accept = null;
      if (completion.reject === reject) completion.reject = null;
      if (finished) return;

      finished = true;

      completionPanel.remove();

      // Calculate whether it is safe to just use `insertText` to insert completion text
      let safeToJustUseInsertText = false;
      let textToInsert = text;
      const cursorPos = getCursorPos();
      if (
        cursorPos &&
        cursorPos.line === range.end.line &&
        cursorPos.character === range.end.character
      ) {
        const markdownInRange = sliceTextByRange(
          state.markdown,
          range,
          File.useCRLF ? "\r\n" : "\n",
        );
        if (text.startsWith(markdownInRange)) {
          safeToJustUseInsertText = true;
          textToInsert = text.slice(markdownInRange.length);
        }
      }

      if (safeToJustUseInsertText) {
        editor.insertText(textToInsert);
      } else {
        // @ts-expect-error - CodeMirror supports 2nd parameter, but not declared in types
        cm.setValue(editor.getMarkdown(), "begin");
        cm.setCursor({ line: position.line, ch: position.character });
        cm.replaceRange(
          text,
          { line: range.start.line, ch: range.start.character },
          { line: range.end.line, ch: range.end.character },
        );
        const newMarkdown = cm.getValue(File.useCRLF ? "\r\n" : "\n");
        const cursorPos = Object.assign(cm.getCursor(), {
          lineText: cm.getLine(cm.getCursor().line),
        });
        File.reloadContent(newMarkdown, {
          fromDiskChange: false,
          skipChangeCount: true,
          skipStore: false,
        });
        // Restore text cursor position
        sourceView.gotoLine(cursorPos);
        editor.refocus();
      }

      copilot.notification.notifyAccepted({ uuid: options.uuid });

      logger.debug("Accepted completion");
    };

    /**
     * Whether completion is already accepted or rejected.
     */
    let finished = false;
    /**
     * Whether completion listeners attached for this completion are cleared.
     */
    let cleared = false;
    const clearListeners = () => {
      cleared = true;
      editor.writingArea.removeEventListener("keydown", keydownHandler);
      document.querySelector("content")?.removeEventListener("scroll", scrollListener);
      clearInterval(cursorMoveListener);
    };

    /**
     * Intercept `Tab` key once and change it to accept completion.
     * @param event
     * @returns
     */
    const keydownHandler = (event: KeyboardEvent) => {
      if (cleared) return;

      // Prevent tab key to trigger tab once
      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        clearListeners();
        _accept();
        return;
      }
    };
    editor.writingArea.addEventListener("keydown", keydownHandler, true);

    const lastCursor = editor.lastCursor;
    const cursorMoveListener = setInterval(() => {
      if (cleared) return;

      if (editor.lastCursor !== lastCursor) {
        clearListeners();
        _reject();
      }
    });

    const reject = () => {
      clearListeners();
      _reject();
    };
    completion.reject = reject;
    const accept = () => {
      clearListeners();
      _accept();
    };
    completion.accept = accept;

    return;
  };

  /**
   * Insert completion text to CodeMirror.
   * @param cm
   * @param param_1
   * @returns
   */
  const insertCompletionTextToCodeMirror = (
    cm: CodeMirror.Editor,
    { displayText, position, range, text, uuid }: Completion,
  ) => {
    interface CodeMirrorHistory {
      done: readonly object[];
      undone: readonly object[];
    }

    const cloneHistory = (history: CodeMirrorHistory): CodeMirrorHistory => ({
      done: history.done.map((item) =>
        "primIndex" in item
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            new (item.constructor as any)([...(item as any).ranges], item.primIndex)
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            { ...item, changes: [...(item as any).changes] },
      ),
      undone: history.undone.map((item) =>
        "primIndex" in item
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            new (item.constructor as any)([...(item as any).ranges], item.primIndex)
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            { ...item, changes: [...(item as any).changes] },
      ),
    });

    const cursorBefore = cm.getCursor();
    const historyBefore = cloneHistory(cm.getHistory() as CodeMirrorHistory);
    const commandStackBefore = editor.undo.commandStack.map((item) => ({
      ...item,
      undo: [...item.undo],
      redo: [...item.redo],
    }));
    state.suppressMarkdownChange++;
    cm.replaceRange(displayText, { line: position.line, ch: position.character });
    const cursorAfter = cm.getCursor();
    cm.setCursor(cursorBefore);
    const textMarker = cm.markText({ line: position.line, ch: position.character }, cursorAfter, {
      className: "text-gray font-italic",
    });

    // Force set `history.undone` to enable redo.
    // The first redo after it should be intercepted and then reject the completion (the history
    // will be restored to `historyBefore`), so the editor state will not be corrupted.
    cm.setHistory({
      done: (cm.getHistory() as CodeMirrorHistory).done,
      undone: historyBefore.undone,
    });

    // Remove the last registered operation command, so the completion text will not be
    // registered as a new operation command
    if (!sourceView.inSourceMode) editor.undo.removeLastRegisteredOperationCommand();

    copilot.notification.notifyShown({ uuid });

    /**
     * Reject the completion.
     *
     * **Warning:** It should only be called when no more changes is applied after
     * completion text is inserted, otherwise history will be corrupted.
     */
    const _reject = () => {
      if (completion.reject === reject) completion.reject = null;
      if (completion.accept === accept) completion.accept = null;
      if (finished) return;

      finished = true;

      const textMarkerRange = textMarker.find();
      if (!textMarkerRange) {
        clearListeners();
        return;
      }
      const { from, to } = textMarkerRange;

      state.suppressMarkdownChange++;
      cm.replaceRange("", from, to);
      cm.setHistory(historyBefore);

      if (!sourceView.inSourceMode) {
        editor.undo.commandStack.length = 0;
        editor.undo.commandStack.push(...commandStackBefore);
      }

      copilot.notification.notifyRejected({ uuids: [uuid] });

      logger.debug("Rejected completion", uuid);
    };
    /**
     * Accept the completion.
     */
    const _accept = () => {
      if (completion.accept === accept) completion.accept = null;
      if (completion.accept === accept) completion.accept = null;
      if (finished) return;

      finished = true;

      // Clear completion hint
      const textMarkerRange = textMarker.find();
      if (!textMarkerRange) {
        clearListeners();
        return;
      }
      const { from, to } = textMarkerRange;

      state.suppressMarkdownChange++;
      cm.replaceRange("", from, to);
      cm.setHistory(historyBefore);

      if (!sourceView.inSourceMode) {
        editor.undo.commandStack.length = 0;
        editor.undo.commandStack.push(...commandStackBefore);
      }

      // Insert completion text
      cm.replaceRange(
        text,
        { line: range.start.line, ch: range.start.character },
        { line: range.end.line, ch: range.end.character },
      );

      copilot.notification.notifyAccepted({ uuid });

      logger.debug("Accepted completion");
    };

    /**
     * Whether completion is already accepted or rejected.
     */
    let finished = false;
    /**
     * Whether completion listeners attached for this completion are cleared.
     */
    let cleared = false;
    /**
     * Clear completion listeners.
     */
    const clearListeners = () => {
      cleared = true;
      cm.off("keydown", cmTabFixer);
      cm.off("beforeChange", cmChangeFixer);
      cm.off("cursorActivity", cursorMoveHandler);
    };

    /**
     * Intercept `Tab` key once and change it to accept completion.
     * @param _
     * @param event
     */
    const cmTabFixer = (_: CodeMirror.Editor, event: KeyboardEvent) => {
      if (cleared) return;

      // Prevent tab key to trigger tab once
      if (event.key === "Tab") {
        event.preventDefault();
        clearListeners();
        _accept();
        return;
      }
    };
    cm.on("keydown", cmTabFixer);

    /**
     * Reject completion before any change applied.
     * @param cm
     * @param param_1
     */
    const cmChangeFixer = (
      cm: CodeMirror.Editor,
      { cancel, from, origin, text, to }: CodeMirror.EditorChangeCancellable,
    ) => {
      if (cleared) return;

      console.log("beforeChange", { text, from, to, origin });

      clearListeners();
      // Cancel the change temporarily
      cancel();
      // Reject completion and redo the change after 1 tick
      // It is to make sure these changes are applied after the `"beforeChange"` event
      // has finished, in order to avoid corrupting the CodeMirror instance
      void Promise.resolve().then(() => {
        _reject();
        if (origin === "undo" || origin === "redo") {
          if (sourceView.inSourceMode) cm[origin]();
          else editor.undo[origin]();
          state.latestCursorChangeTimestamp = Date.now();
        } else {
          cm.replaceRange(text.join(File.useCRLF ? "\r\n" : "\n"), from, to, origin);
        }
      });
    };
    cm.on("beforeChange", cmChangeFixer);

    /**
     * Reject completion if cursor moved.
     */
    const cursorMoveHandler = () => {
      if (cleared) return;

      state.latestCursorChangeTimestamp = Date.now();

      clearListeners();
      _reject();
    };
    cm.on("cursorActivity", cursorMoveHandler);

    const reject = () => {
      clearListeners();
      _reject();
    };
    completion.reject = reject;
    const accept = () => {
      clearListeners();
      _accept();
    };
    completion.accept = accept;
  };

  /*******************
   * Change handlers *
   *******************/
  /**
   * Callback to be invoked when workspace folder changed.
   * @param newFolder
   * @param oldFolder
   */
  const onChangeWorkspaceFolder = (newFolder: string | null, oldFolder: string | null) => {
    copilot.notification.workspace.didChangeWorkspaceFolders({
      event: {
        added: newFolder
          ? [{ uri: pathToFileURL(newFolder).href, name: path.basename(newFolder) }]
          : [],
        removed: oldFolder
          ? [{ uri: pathToFileURL(oldFolder).href, name: path.basename(oldFolder) }]
          : [],
      },
    });
  };

  /**
   * Callback to be invoked when active file changed.
   * @param newPathname
   * @param oldPathname
   */
  const onChangeActiveFile = (newPathname: string | null, oldPathname: string | null) => {
    if (oldPathname) {
      // Reject current completion if exists
      completion.reject?.();

      copilot.notification.textDocument.didClose({
        textDocument: { uri: pathToFileURL(oldPathname).href },
      });
    }
    if (newPathname) {
      copilot.version = 0;
      copilot.notification.textDocument.didOpen({
        textDocument: {
          uri: pathToFileURL(newPathname).href,
          languageId: "markdown",
          version: 0,
          text: editor.getMarkdown(),
        },
      });
    }
  };

  /**
   * Callback to be invoked when markdown text changed.
   */
  // @ts-expect-error - Unused parameter `oldMarkdown`
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onChangeMarkdown = debounce(async (newMarkdown: string, oldMarkdown: string) => {
    /* Tell Copilot that file has changed */
    const version = ++copilot.version;
    copilot.notification.textDocument.didChange({
      textDocument: { version, uri: pathToFileURL(state.activeFilePathname).href },
      contentChanges: [{ text: newMarkdown }],
    });

    /* Fetch completion from Copilot if cursor position exists */
    const cursorPos = getCursorPos();
    if (!cursorPos) return;

    // Fetch completion from Copilot
    const changeTimestamp = state.latestChangeTimestamp;
    const cursorChangeTimestamp = state.latestCursorChangeTimestamp;
    const { cancellationReason, completions } = await copilot.request.getCompletions({
      position: cursorPos,
      path: state.activeFilePathname,
      relativePath: state.workspaceFolder
        ? path.relative(state.workspaceFolder, state.activeFilePathname)
        : state.activeFilePathname,
    });

    if (
      state.latestChangeTimestamp !== changeTimestamp ||
      state.latestCursorChangeTimestamp !== cursorChangeTimestamp
    ) {
      if (state.latestChangeTimestamp !== changeTimestamp)
        logger.debug(
          "Ignoring completion due to markdown change timestamp mismatch",
          state.latestChangeTimestamp,
          changeTimestamp,
        );
      else
        logger.debug(
          "Ignoring completion due to text cursor change timestamp mismatch",
          state.latestCursorChangeTimestamp,
          cursorChangeTimestamp,
        );
      completions.forEach((completion) => {
        copilot.notification.notifyRejected({ uuids: [completion.uuid] });
      });
      return;
    }

    // Return if completion request cancelled
    if (cancellationReason !== undefined) {
      copilot.status = "Normal";
      return;
    }
    // Return if no completion is provided
    if (completions.length === 0) {
      copilot.status = "Normal";
      return;
    }

    // Reject other completions if exists
    if (completions.length > 1)
      copilot.notification.notifyRejected({ uuids: completions.slice(1).map((c) => c.uuid) });

    /* Insert completion text and wait to be accepted or cancelled */
    const firstCompletion = completions[0]!;
    const { uuid } = firstCompletion;
    completion.latestUUID = uuid;

    if (editor.sourceView.inSourceMode) insertCompletionTextToCodeMirror(cm, firstCompletion);
    else insertCompletionTextToEditor(firstCompletion);
  }, 500);

  /*********************
   * Initialize states *
   *********************/
  const editor = File.editor as Typora.EnhancedEditor;
  // Initialize state
  const state = {
    workspaceFolder: getWorkspaceFolder() ?? FAKE_TEMP_WORKSPACE_FOLDER,
    activeFilePathname:
      getActiveFilePathname() ?? path.join(FAKE_TEMP_WORKSPACE_FOLDER, FAKE_TEMP_FILENAME),
    markdown: editor.getMarkdown(),
    _actualLatestMarkdown: editor.getMarkdown(),
    latestChangeTimestamp: Date.now(),
    latestCursorChangeTimestamp: Date.now(),
    suppressMarkdownChange: 0,
  };
  // Initialize CodeMirror
  const sourceView = editor.sourceView as Typora.EnhancedSourceView;
  if (!sourceView.cm) sourceView.prep();
  const cm = sourceView.cm!;
  // Initialize completion state
  const completion = {
    latestUUID: "",
    /**
     * Reject current completion.
     */
    reject: null as (() => void) | null,
    /**
     * Accept current completion.
     */
    accept: null as (() => void) | null,
  };

  /**************************
   * Initialize Copilot LSP *
   **************************/
  /* Send `initialize` request */
  await copilot.request.initialize({
    processId: window.process?.pid ?? null,
    capabilities: { workspace: { workspaceFolders: true } },
    trace: "verbose",
    rootUri: state.workspaceFolder && pathToFileURL(state.workspaceFolder).href,
    ...(state.workspaceFolder && {
      workspaceFolders: [
        {
          uri: pathToFileURL(state.workspaceFolder).href,
          name: path.basename(state.workspaceFolder),
        },
      ],
    }),
  });
  copilot.notification.initialized();

  /* Register editor info */
  await copilot.request.setEditorInfo({
    editorInfo: { name: "Typora", version: TYPORA_VERSION },
    editorPluginInfo: { name: "typora-copilot", version: VERSION },
  });

  await copilot.request.getVersion();

  /* Check editor status */
  let initialCheckStatusResult: Awaited<ReturnType<typeof copilot.request.checkStatus>>;
  try {
    initialCheckStatusResult = await copilot.request.checkStatus();
  } catch (e) {
    logger.error("Checking copilot account status failed.", e);
    copilot.status = "Warning";
    return;
  }
  resetAccountStatus(initialCheckStatusResult.status);

  /* Send initial didOpen */
  if (state.activeFilePathname) onChangeActiveFile(state.activeFilePathname, null);

  /************
   * Watchers *
   ************/
  /* Interval to update workspace and active file pathname */
  setInterval(() => {
    const newWorkspaceFolder = getWorkspaceFolder() ?? FAKE_TEMP_WORKSPACE_FOLDER;
    if (newWorkspaceFolder !== state.workspaceFolder) {
      const oldWorkspaceFolder = state.workspaceFolder;
      state.workspaceFolder = newWorkspaceFolder;
      onChangeWorkspaceFolder(newWorkspaceFolder, oldWorkspaceFolder);
    }
    const newActiveFilePathname = getActiveFilePathname() ?? FAKE_TEMP_FILENAME;
    if (newActiveFilePathname !== state.activeFilePathname) {
      const oldActiveFilePathname = state.activeFilePathname;
      state.activeFilePathname = newActiveFilePathname;
      onChangeActiveFile(newActiveFilePathname, oldActiveFilePathname);
    }
  }, 100);

  /* Reject completion on toggle source mode */
  sourceView.on("beforeToggle", (_, on) => {
    if (completion.reject) {
      logger.debug(`Refusing completion before toggling source mode ${on ? "on" : "off"}`);
      completion.reject();
    }
  });

  /* Watch for markdown change in live preview mode */
  editor.on("change", (_, { newMarkdown, oldMarkdown }) => {
    if (sourceView.inSourceMode) return;

    // If not literally changed, simply return
    if (newMarkdown === state._actualLatestMarkdown) return;
    // If literally changed, update current actual markdown text
    state._actualLatestMarkdown = newMarkdown;
    // If update suppressed, return
    if (state.suppressMarkdownChange) {
      state.suppressMarkdownChange--;
      return;
    }
    // Update current markdown text
    state.markdown = newMarkdown;
    logger.debug("Changing markdown", { from: oldMarkdown, to: newMarkdown });
    // Reject last completion if exists
    completion.reject?.();
    // Invoke callback
    void onChangeMarkdown(newMarkdown, oldMarkdown);
  });

  /* Watch for markdown change in source mode */
  cm.on("change", (cm, change) => {
    if (!editor.sourceView.inSourceMode) return;

    const newMarkdown = cm.getValue();
    // If not literally changed, simply return
    if (newMarkdown === state._actualLatestMarkdown) return;
    // If literally changed, update current actual markdown text
    state._actualLatestMarkdown = newMarkdown;
    // If update suppressed, return
    if (state.suppressMarkdownChange) {
      state.suppressMarkdownChange--;
      return;
    }
    /* When update not suppressed */
    const oldMarkdown = state.markdown;
    // Update current markdown text
    state.markdown = newMarkdown;
    state.latestChangeTimestamp = Date.now();
    logger.debug("Changing markdown", { from: oldMarkdown, to: newMarkdown, change });
    // Reject last completion if exists
    completion.reject?.();
    // Invoke callback
    void onChangeMarkdown(newMarkdown, oldMarkdown);
  });
};

// Execute `main` function until Typora editor is initialized
void waitUntilEditorInitialized().then(main);
