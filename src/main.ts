import { forkNode } from "@modules/child_process";
import * as path from "@modules/path";
import { pathToFileURL } from "@modules/url";

import { debounce } from "lodash-es";

import { createCopilotClient } from "./client";
import { attachSuggestionPanel } from "./components/SuggestionPanel";
import { PLUGIN_DIR, VERSION } from "./constants";
import { attachFooter } from "./footer";
import { logger } from "./logging";
import {
  File,
  TYPORA_VERSION,
  getCaretPlacement,
  waitUntilEditorInitialized,
} from "./typora-utils";
import { $S, getCaretCoordinate } from "./utils/dom";
import { css, registerCSS, setGlobalVar, sliceTextByRange } from "./utils/tools";

import type { Completion } from "./client";
import type { Position } from "./types/lsp";

const server = forkNode(path.join(PLUGIN_DIR, "language-server", "agent.cjs"));

logger.info("Copilot plugin activated. Version:", VERSION);
logger.debug("Copilot LSP server started. PID:", server.pid);

/**
 * Copilot LSP client.
 */
const copilot = createCopilotClient(server, { logging: "debug" });
setGlobalVar("copilot", copilot);

// Register CSS for completion text to use
registerCSS(css`
  .text-gray {
    color: gray !important;
  }
  .font-italic {
    font-style: italic !important;
  }
`);

/**
 * Fake temporary workspace folder, only used when no folder is opened.
 */
const FAKE_TEMP_WORKSPACE_FOLDER = File.isWin
  ? "C:\\Users\\FakeUser\\FakeTyporaCopilotWorkspace"
  : "/home/fakeuser/faketyporacopilotworkspace";
const FAKE_TEMP_FILENAME = "typora-copilot-fake-markdown.md";

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
   * Get current caret position in source markdown text.
   * @returns
   */
  const getCaretPosition = (): Position | null => {
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

    let placement: Typora.CaretPlacement | null;
    try {
      placement = getCaretPlacement();
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

    // If in a CodeMirror instance, try to use the cm way to insert completion text
    if ("TEXTAREA" === activeElement.tagName) {
      const cms = $(activeElement).closest(".CodeMirror");
      if (!cms || !cms.length) return;
      const cm = (cms[0] as unknown as { CodeMirror: CodeMirror.Editor }).CodeMirror;
      const subCmCompletion = { ...options };
      const startPos = getCaretPosition()!;
      startPos.line -=
        cm.getValue(File.useCRLF ? "\r\n" : "\n").split(File.useCRLF ? "\r\n" : "\n").length - 1;
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
      // Get starter of CodeMirror to determine whether it is a code block, formula, etc.
      let cmStarter = state.markdown.split(File.useCRLF ? "\r\n" : "\n")[startPos.line - 1];

      if (cmStarter) {
        if (cmStarter.startsWith("```") || cmStarter.startsWith("~~~")) {
          // * Code block *
          cmStarter = cmStarter.slice(0, 3);
          // Get only completion text before code block starter, as in Typora code block it is not possible
          // to insert a new code block or end one using "```" or "~~~"
          const indexOfCodeBlockStarter = subCmCompletion.text.indexOf(cmStarter);
          if (indexOfCodeBlockStarter !== -1) {
            subCmCompletion.displayText = subCmCompletion.displayText.slice(
              0,
              subCmCompletion.displayText.indexOf(cmStarter),
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
      }
    }

    const focusedElem = document.querySelector(`[cid=${editor.focusCid}]`);
    if (!focusedElem) return;
    if (!(focusedElem instanceof HTMLElement)) return;

    const pos = getCaretCoordinate();
    if (!pos) return;

    // Insert a suggestion panel below the cursor
    const unattachSuggestionPanel = attachSuggestionPanel(displayText);

    copilot.notification.notifyShown({ uuid: options.uuid });

    /**
     * Reject the completion.
     */
    const _reject = () => {
      if (completion.reject === reject) completion.reject = null;
      if (completion.accept === accept) completion.accept = null;
      if (finished) return;

      finished = true;

      unattachSuggestionPanel();

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

      unattachSuggestionPanel();

      // Calculate whether it is safe to just use `insertText` to insert completion text,
      // as using `reloadContent` uses much more resources and causes a flicker
      let safeToJustUseInsertText = false;
      let textToInsert = text;
      const cursorPos = getCaretPosition();
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

    $S(editor.writingArea).once("caretMove", () => {
      if (cleared) return;

      state.latestCaretMoveTimestamp = Date.now();

      clearListeners();
      _reject();
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
          state.latestCaretMoveTimestamp = Date.now();
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

      state.latestCaretMoveTimestamp = Date.now();

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
    const cursorPos = getCaretPosition();
    if (!cursorPos) return;

    // Fetch completion from Copilot
    const changeTimestamp = state.latestChangeTimestamp;
    const caretMoveTimestamp = state.latestCaretMoveTimestamp;
    const { cancellationReason, completions } = await copilot.request.getCompletions({
      position: cursorPos,
      path: state.activeFilePathname,
      relativePath: state.workspaceFolder
        ? path.relative(state.workspaceFolder, state.activeFilePathname)
        : state.activeFilePathname,
    });

    if (
      state.latestChangeTimestamp !== changeTimestamp ||
      state.latestCaretMoveTimestamp !== caretMoveTimestamp
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
          state.latestCaretMoveTimestamp,
          caretMoveTimestamp,
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
    latestCaretMoveTimestamp: Date.now(),
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

  /***********
   * UI Misc *
   ***********/
  attachFooter(copilot);

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

    const newMarkdown = cm.getValue(File.useCRLF ? "\r\n" : "\n");
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
