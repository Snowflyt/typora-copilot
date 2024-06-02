/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable sonarjs/no-duplicate-string */

import { forkNode } from "@modules/child_process";
import * as path from "@modules/path";
import { pathToFileURL } from "@modules/url";

import { debounce } from "radash";

import { createCopilotClient } from "./client";
import { createCompletionTaskManager } from "./completion";
import { attachSuggestionPanel } from "./components/SuggestionPanel";
import { PLUGIN_DIR, VERSION } from "./constants";
import { attachFooter } from "./footer";
import { logger } from "./logging";
import { settings } from "./settings";
import {
  File,
  TYPORA_VERSION,
  getActiveFilePathname,
  getCaretPosition,
  getCodeMirror,
  getWorkspaceFolder,
  waitUntilEditorInitialized,
} from "./typora-utils";
import { getCaretCoordinate } from "./utils/dom";
import { setGlobalVar, sliceTextByRange } from "./utils/tools";

import "./styles.scss";

import type { Completion } from "./client";

logger.info("Copilot plugin activated. Version:", VERSION);

/**
 * Fake temporary workspace folder, only used when no folder is opened.
 */
const FAKE_TEMP_WORKSPACE_FOLDER =
  File.isWin ?
    "C:\\Users\\FakeUser\\FakeTyporaCopilotWorkspace"
  : "/home/fakeuser/faketyporacopilotworkspace";
const FAKE_TEMP_FILENAME = "typora-copilot-fake-markdown.md";

(async () => {
  const server = await forkNode(path.join(PLUGIN_DIR, "language-server", "language-server.cjs"));
  logger.debug("Copilot LSP server started. PID:", server.pid);

  /**
   * Copilot LSP client.
   */
  const copilot = createCopilotClient(server, { logging: "debug" });
  setGlobalVar("copilot", copilot);

  await waitUntilEditorInitialized();

  /*********************
   * Utility functions *
   *********************/
  /**
   * Insert completion text to editor.
   * @param options Completion options.
   * @returns
   */
  const insertCompletionTextToEditor = (options: Completion) => {
    const { position, range } = options;
    let { displayText, text } = options;

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

    let mode: NonNullable<CodeMirror.EditorConfiguration["mode"]> | null = null;
    let fontSize: string | null = null;
    let backgroundColor: string | null = null;
    // If in a CodeMirror instance, prune completion text to only include text before code block starter
    if ("TEXTAREA" === activeElement.tagName && getCodeMirror(activeElement)) {
      const cm = getCodeMirror(activeElement)!;

      const startPos = getCaretPosition()!;
      startPos.line -=
        cm.getValue(File.useCRLF ? "\r\n" : "\n").split(File.useCRLF ? "\r\n" : "\n").length - 1;
      startPos.character -= cm.getCursor().ch;
      if (startPos.character < 0) startPos.character = 0;

      // Get starter of CodeMirror to determine whether it is a code block, formula, etc.
      const cmStarter = state.markdown.split(File.useCRLF ? "\r\n" : "\n")[startPos.line - 1];

      if (cmStarter) {
        const cmElement = cm.getWrapperElement();

        let handled = false;
        // * Code block *
        if (cmStarter.startsWith("```") || cmStarter.startsWith("~~~")) {
          handled = true;
          const lang = (cmElement as unknown as { lang: string }).lang;
          mode = window.getCodeMirrorMode(lang);
          fontSize = window.getComputedStyle(cmElement).fontSize;
          backgroundColor = window.getComputedStyle(cmElement).backgroundColor;

          // Keep only completion text before code block ender, as in Typora code block it is not possible
          // to insert a new code block or end one using "```" or "~~~"
          const ender = cmStarter.match(/^(.)\1*/)![0];
          const indexOfEnder = text.indexOf(ender);
          if (indexOfEnder !== -1) {
            displayText = displayText.slice(0, displayText.indexOf(ender));
            text = text.slice(0, indexOfEnder);
            const textAfterEnder = text.slice(indexOfEnder);
            // Reduce `range` to only include text before ender
            const rows = textAfterEnder.split(File.useCRLF ? "\r\n" : "\n").length - 1;
            range.end.line -= rows;
            range.end.character = textAfterEnder.split(File.useCRLF ? "\r\n" : "\n").pop()!.length;
          }
        }
        // * Math block *
        else if (cmStarter === "$$") {
          handled = true;
          mode = "stex";

          const match = text.match(/(?<!\\)\$\$/);
          const indexOfEnder = match ? match.index : -1;
          if (indexOfEnder !== -1) {
            const match = displayText.match(/(?<!\\)\$\$/);
            if (match) displayText = displayText.slice(0, match.index);
            text = text.slice(0, indexOfEnder);
            const textAfterEnder = text.slice(indexOfEnder);
            // Reduce `range` to only include text before ender
            const rows = textAfterEnder.split(File.useCRLF ? "\r\n" : "\n").length - 1;
            range.end.line -= rows;
            range.end.character = textAfterEnder.split(File.useCRLF ? "\r\n" : "\n").pop()!.length;
          }
        }

        if (handled && settings.useInlineCompletionTextInPreviewCodeBlocks) {
          const subCmCompletion = { ...options };

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
    const unattachSuggestionPanel = attachSuggestionPanel(displayText, mode, {
      backgroundColor,
      fontSize,
    });

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
      }
    };
    editor.writingArea.addEventListener("keydown", keydownHandler, true);

    $(editor.writingArea).once("caretMove", () => {
      if (cleared) return;

      taskManager.cancelAll();

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
        "primIndex" in item ?
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          new (item.constructor as any)([...(item as any).ranges], item.primIndex)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        : { ...item, changes: [...(item as any).changes] },
      ),
      undone: history.undone.map((item) =>
        "primIndex" in item ?
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          new (item.constructor as any)([...(item as any).ranges], item.primIndex)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        : { ...item, changes: [...(item as any).changes] },
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
          taskManager.cancelAll();
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

      taskManager.cancelAll();

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

  /**
   * Insert suggestion panel to CodeMirror.
   * @param cm
   * @param param_1
   * @returns
   */
  const insertSuggestionPanelToCodeMirror = (
    cm: CodeMirror.Editor,
    { displayText, range, text, uuid }: Completion,
  ) => {
    // Insert a suggestion panel below the cursor
    const unattachSuggestionPanel = attachSuggestionPanel(displayText, null, { cm });

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

      unattachSuggestionPanel();

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
      cm.off("keydown", keydownHandler);
      cm.off("cursorActivity", cursorMoveHandler);
    };

    /**
     * Intercept `Tab` key once and change it to accept completion.
     * @param event
     * @returns
     */

    const keydownHandler = (_: CodeMirror.Editor, event: KeyboardEvent) => {
      if (cleared) return;

      // Prevent tab key to trigger tab once
      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        clearListeners();
        _accept();
      }
    };
    cm.on("keydown", keydownHandler);

    /**
     * Reject completion if cursor moved.
     */
    const cursorMoveHandler = () => {
      if (cleared) return;

      taskManager.cancelAll();

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
        added:
          newFolder ? [{ uri: pathToFileURL(newFolder).href, name: path.basename(newFolder) }] : [],
        removed:
          oldFolder ? [{ uri: pathToFileURL(oldFolder).href, name: path.basename(oldFolder) }] : [],
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

  const onChangeMarkdown = debounce(
    { delay: 500 },
    (
      newMarkdown: string,
      // @ts-expect-error - Unused parameter `oldMarkdown`
      oldMarkdown: string,
    ) => {
      /* Tell Copilot that file has changed */
      const version = ++copilot.version;
      copilot.notification.textDocument.didChange({
        textDocument: { version, uri: pathToFileURL(taskManager.activeFilePathname).href },
        contentChanges: [{ text: newMarkdown }],
      });

      /* Fetch completion from Copilot if cursor position exists */
      const cursorPos = getCaretPosition();
      if (!cursorPos) return;

      taskManager.cancelAll();
      // Fetch completion from Copilot
      taskManager.startOne({
        position: cursorPos,
        onCompletion: (comp) => {
          completion.reject?.();
          if (editor.sourceView.inSourceMode)
            if (settings.useInlineCompletionTextInSource)
              insertCompletionTextToCodeMirror(cm, comp);
            else insertSuggestionPanelToCodeMirror(cm, comp);
          else insertCompletionTextToEditor(comp);
        },
      });
    },
  );

  /*********************
   * Initialize states *
   *********************/
  const editor = File.editor as Typora.EnhancedEditor;
  // Initialize state
  const state = {
    markdown: editor.getMarkdown(),
    _actualLatestMarkdown: editor.getMarkdown(),
    suppressMarkdownChange: 0,
  };
  // Initialize CodeMirror
  const sourceView = editor.sourceView as Typora.EnhancedSourceView;
  if (!sourceView.cm) sourceView.prep();
  const cm = sourceView.cm!;
  // Initialize completion state
  const completion = {
    /**
     * Reject current completion.
     */
    reject: null as (() => void) | null,
    /**
     * Accept current completion.
     */
    accept: null as (() => void) | null,
  };

  /***************************
   * Initialize task manager *
   ***************************/
  const taskManager = createCompletionTaskManager(copilot, {
    workspaceFolder: getWorkspaceFolder() ?? FAKE_TEMP_WORKSPACE_FOLDER,
    activeFilePathname:
      getActiveFilePathname() ?? path.join(FAKE_TEMP_WORKSPACE_FOLDER, FAKE_TEMP_FILENAME),
  });

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
    rootUri: taskManager.workspaceFolder && pathToFileURL(taskManager.workspaceFolder).href,
    ...(taskManager.workspaceFolder && {
      workspaceFolders: [
        {
          uri: pathToFileURL(taskManager.workspaceFolder).href,
          name: path.basename(taskManager.workspaceFolder),
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
  if (taskManager.activeFilePathname) onChangeActiveFile(taskManager.activeFilePathname, null);

  /************
   * Watchers *
   ************/
  /* Interval to update workspace and active file pathname */
  setInterval(() => {
    const newWorkspaceFolder = getWorkspaceFolder() ?? FAKE_TEMP_WORKSPACE_FOLDER;
    if (newWorkspaceFolder !== taskManager.workspaceFolder) {
      const oldWorkspaceFolder = taskManager.workspaceFolder;
      taskManager.workspaceFolder = newWorkspaceFolder;
      onChangeWorkspaceFolder(newWorkspaceFolder, oldWorkspaceFolder);
    }
    const newActiveFilePathname =
      getActiveFilePathname() ?? path.join(FAKE_TEMP_WORKSPACE_FOLDER, FAKE_TEMP_FILENAME);
    if (newActiveFilePathname !== taskManager.activeFilePathname) {
      const oldActiveFilePathname = taskManager.activeFilePathname;
      taskManager.activeFilePathname = newActiveFilePathname;
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
    if (settings.disableCompletions) return;
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
  cm.on("change", (cm, change): void => {
    if (settings.disableCompletions) return;
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
    logger.debug("Changing markdown", { from: oldMarkdown, to: newMarkdown, change });
    // Reject last completion if exists
    completion.reject?.();
    // Invoke callback
    void onChangeMarkdown(newMarkdown, oldMarkdown);
  });
})().catch((err) => {
  throw err;
});
