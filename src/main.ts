import * as path from "@modules/path";
import { pathToFileURL } from "@modules/url";

import diff from "fast-diff";
import { debounce } from "radash";
import semverGte from "semver/functions/gte";
import semverLt from "semver/functions/lt";
import semverValid from "semver/functions/valid";

import type { Completion } from "./client";
import { createCopilotClient } from "./client";
import CompletionTaskManager from "./completion";
import { attachSuggestionPanel } from "./components/SuggestionPanel";
import { PLUGIN_DIR, VERSION } from "./constants";
import { attachFooter } from "./footer";
import { t } from "./i18n";
import { logger } from "./logging";
import { settings } from "./settings";
import type { Position } from "./types/lsp";
import {
  TYPORA_VERSION,
  getActiveFilePathname,
  getCodeMirror,
  getWorkspaceFolder,
  waitUntilEditorInitialized,
} from "./typora-utils";
import { runCommand } from "./utils/cli-tools";
import { computeTextChanges } from "./utils/diff";
import { getCaretCoordinate } from "./utils/dom";
import type { NodeRuntime } from "./utils/node-bridge";
import {
  NodeServer,
  detectAvailableNodeRuntimes,
  setAllAvailableNodeRuntimes,
  setCurrentNodeRuntime,
} from "./utils/node-bridge";
import { Observable } from "./utils/observable";
import { replaceTextByRange, setGlobalVar } from "./utils/tools";

import "./styles.scss";

logger.info("Copilot plugin activated. Version:", VERSION);

/**
 * Fake temporary workspace folder, only used when no folder is opened.
 */
const FAKE_TEMP_WORKSPACE_FOLDER =
  Files.isWin ?
    "C:\\Users\\FakeUser\\FakeTyporaCopilotWorkspace"
  : "/home/fakeuser/faketyporacopilotworkspace";
const FAKE_TEMP_FILENAME = "typora-copilot-fake-markdown.md";

Promise.defer(async () => {
  const runtime = await new Promise<NodeRuntime>((resolve) => {
    const start = Date.now();

    const customNodePath = settings.nodePath;
    const checkCustomRuntimePromise =
      customNodePath ?
        runCommand(`"${customNodePath}" -v`).then((output) => {
          const version = output.trim();
          if (!semverValid(version)) {
            logger.warn(
              `Failed to check version of custom Node.js path "${customNodePath}", fallback to auto detection`,
            );
            throw new Error("Custom runtime invalid");
          }
          const runtime = { path: customNodePath, version };
          setCurrentNodeRuntime(runtime);
          logger.info(
            `Using custom Node.js runtime (v${version.replace(/^v/, "")}) at path` +
              `"${customNodePath}" to start language server.`,
          );
          resolve(runtime);
        })
      : Promise.reject(new Error("No custom runtime"));

    void detectAvailableNodeRuntimes({
      onFirstResolved: (runtime) => {
        const timeSpent = Date.now() - start;

        checkCustomRuntimePromise.catch(() => {
          setCurrentNodeRuntime(runtime);
          logger.debug(`Resolved first Node.js runtime in ${timeSpent}ms:`, runtime);
          logger.info(
            "Detected " +
              (runtime.path === "bundled" ? "bundled" : "available") +
              ` Node.js (v${runtime.version.replace(/^v/, "")})` +
              (runtime.path === "bundled" ? "" : ` at path "${runtime.path}"`) +
              ", using it to start language server.",
          );
          resolve(runtime);
        });
      },
    }).then((runtimes) => {
      const timeSpent = Date.now() - start;
      setAllAvailableNodeRuntimes(runtimes);

      checkCustomRuntimePromise.catch(() => {
        if (runtimes.length === 0) {
          logger.error("No available Node.js runtime found");
          if (Files.isMac)
            void waitUntilEditorInitialized().then(() => {
              Files.editor!.EditHelper.showDialog({
                title: `Typora Copilot: ${t("dialog.warn-nodejs-above-20-required-on-macOS.title")}`,
                type: "error",
                html: /* html */ `
                  <div style="text-align: center; margin-top: 8px;">
                    ${t("dialog.warn-nodejs-above-20-required-on-macOS.html")}
                  </div>
                `,
                buttons: [t("button.understand")],
              });
            });
          else if (Files.isNode && semverLt(process.version, "20.0.0"))
            void waitUntilEditorInitialized().then(() => {
              Files.editor!.EditHelper.showDialog({
                title: `Typora Copilot: ${t("dialog.warn-nodejs-above-20-required-for-typora-under-1-9.title")}`,
                type: "error",
                html: /* html */ `
                  <div style="text-align: center; margin-top: 8px;">
                    ${t("dialog.warn-nodejs-above-20-required-for-typora-under-1-9.html").replace(
                      "{{TYPORA_VERSION}}",
                      TYPORA_VERSION,
                    )}
                  </div>
                `,
                buttons: [t("button.understand")],
              });
            });
          else if (Files.isNode && semverGte(TYPORA_VERSION, "1.10.0"))
            void waitUntilEditorInitialized().then(() => {
              Files.editor!.EditHelper.showDialog({
                title: `Typora Copilot: ${t("dialog.warn-nodejs-above-20-required-for-typora-above-1-10.title")}`,
                type: "error",
                html: /* html */ `
                  <div style="text-align: center; margin-top: 8px;">
                    ${t("dialog.warn-nodejs-above-20-required-for-typora-above-1-10.html").replace(
                      "{{TYPORA_VERSION}}",
                      TYPORA_VERSION,
                    )}
                  </div>
                `,
                buttons: [t("button.understand")],
              });
            });

          resolve({ path: "not found", version: "unknown" });
        } else {
          logger.debug(`Resolved all available Node.js runtimes in ${timeSpent}ms:`, runtimes);
        }
      });
    });
  });

  const server =
    runtime.path === "not found" ?
      NodeServer.getMock()
    : await NodeServer.start(
        runtime.path,
        path.join(PLUGIN_DIR, "language-server", "language-server.cjs"),
      );
  if (server.pid !== -1) logger.debug("Copilot LSP server started. PID:", server.pid);

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
   * @param completion Completion options.
   * @returns
   */
  const insertCompletionTextToEditor = (
    caretPosition: Position,
    completion: Completion,
  ): Observable<"accepted" | "rejected"> | void => {
    const { position, range } = completion;
    let { displayText, text } = completion;

    const activeElement = document.activeElement;
    if (!activeElement) return;

    // When in input, do not insert completion text
    if ("INPUT" === activeElement.tagName || activeElement.classList.contains("ty-input")) return;

    // When not in writer, do not insert completion text
    if ("BODY" === activeElement.tagName) return;

    let mode: NonNullable<CodeMirror.EditorConfiguration["mode"]> | null = null;
    let fontSize: string | null = null;
    let backgroundColor: string | null = null;
    // If in a CodeMirror instance, prune completion text to only include text before code block starter
    if ("TEXTAREA" === activeElement.tagName && getCodeMirror(activeElement)) {
      const cm = getCodeMirror(activeElement)!;

      const startPos = { ...caretPosition };
      startPos.line -=
        cm.getValue(Files.useCRLF ? "\r\n" : "\n").split(Files.useCRLF ? "\r\n" : "\n").length - 1;
      startPos.character -= cm.getCursor().ch;
      if (startPos.character < 0) startPos.character = 0;

      // Get starter of CodeMirror to determine whether it is a code block, formula, etc.
      const cmStarter = state.markdown.split(Files.useCRLF ? "\r\n" : "\n")[startPos.line - 1];

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
          const ender = /^(.)\1*/.exec(cmStarter)![0];
          const indexOfEnder = text.indexOf(ender);
          if (indexOfEnder !== -1) {
            displayText = displayText.slice(0, displayText.indexOf(ender));
            text = text.slice(0, indexOfEnder);
            const textAfterEnder = text.slice(indexOfEnder);
            // Reduce `range` to only include text before ender
            const rows = textAfterEnder.split(Files.useCRLF ? "\r\n" : "\n").length - 1;
            range.end.line -= rows;
            range.end.character = textAfterEnder.split(Files.useCRLF ? "\r\n" : "\n").pop()!.length;
          }
        }
        // * Math block *
        else if (cmStarter === "$$") {
          handled = true;
          mode = "stex";

          const match = /(?<!\\)\$\$/.exec(text);
          const indexOfEnder = match ? match.index : -1;
          if (indexOfEnder !== -1) {
            const match = /(?<!\\)\$\$/.exec(displayText);
            if (match) displayText = displayText.slice(0, match.index);
            text = text.slice(0, indexOfEnder);
            const textAfterEnder = text.slice(indexOfEnder);
            // Reduce `range` to only include text before ender
            const rows = textAfterEnder.split(Files.useCRLF ? "\r\n" : "\n").length - 1;
            range.end.line -= rows;
            range.end.character = textAfterEnder.split(Files.useCRLF ? "\r\n" : "\n").pop()!.length;
          }
        }

        if (handled && settings.useInlineCompletionTextInPreviewCodeBlocks) {
          const subCmCompletion = { ...completion };

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

          return insertCompletionTextToCodeMirror(cm, subCmCompletion);
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

    copilot.notification.notifyShown({ uuid: completion.uuid });

    const insertCompletionText = () => {
      // Check whether it is safe to just use `insertText` to insert completion text,
      // as using `reloadContent` uses much more resources and causes a flicker
      const newMarkdown = replaceTextByRange(
        state.markdown,
        range,
        completion.text,
        Files.useCRLF ? "\r\n" : "\n",
      );
      const diffs = diff(state.markdown, newMarkdown).filter((part) => part[0] !== diff.EQUAL);

      if (diffs.length === 1 && diffs[0]![0] === diff.INSERT) {
        editor.insertText(diffs[0]![1]);
      } else {
        // @ts-expect-error - CodeMirror supports 2nd parameter, but not declared in types
        cm.setValue(editor.getMarkdown(), "begin");
        cm.setCursor({ line: position.line, ch: position.character });
        cm.replaceRange(
          text,
          { line: range.start.line, ch: range.start.character },
          { line: range.end.line, ch: range.end.character },
        );
        const newMarkdown = cm.getValue(Files.useCRLF ? "\r\n" : "\n");
        const cursorPos = Object.assign(cm.getCursor(), {
          lineText: cm.getLine(cm.getCursor().line),
        });
        Files.reloadContent(newMarkdown, {
          fromDiskChange: false,
          skipChangeCount: true,
          skipStore: false,
        });
        // Restore text cursor position
        sourceView.gotoLine(cursorPos);
        editor.refocus();
      }
    };

    const cleanup = new Observable<"accepted" | "rejected">();
    cleanup.subscribeOnce(() => {
      unattachSuggestionPanel();
      editor.writingArea.removeEventListener("keydown", keydownHandler, true);
      $(editor.writingArea).off("caretMove", caretMoveHandler);
    });

    /**
     * Intercept `Tab` key once and change it to accept completion.
     * @param event The keyboard event.
     */
    const keydownHandler = (event: KeyboardEvent) => {
      // Prevent tab key to trigger tab once
      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        insertCompletionText();
        cleanup.next("accepted");
      }
    };
    editor.writingArea.addEventListener("keydown", keydownHandler, true);

    const caretMoveHandler = () => {
      cleanup.next("rejected");
    };
    $(editor.writingArea).on("caretMove", caretMoveHandler);

    return cleanup;
  };

  /**
   * Insert completion text to CodeMirror.
   * @param cm The CodeMirror instance.
   * @returns
   */
  const insertCompletionTextToCodeMirror = (
    cm: CodeMirror.Editor,
    { displayText, position, range, text, uuid }: Completion,
  ): Observable<"accepted" | "rejected"> | void => {
    interface CodeMirrorHistory {
      done: readonly object[];
      undone: readonly object[];
    }

    const cloneHistory = (history: CodeMirrorHistory): CodeMirrorHistory => ({
      done: history.done.map((item) =>
        "primIndex" in item ?
          new (item.constructor as any)([...(item as any).ranges], item.primIndex)
        : { ...item, changes: [...(item as any).changes] },
      ),
      undone: history.undone.map((item) =>
        "primIndex" in item ?
          new (item.constructor as any)([...(item as any).ranges], item.primIndex)
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
    // NOTE: The check for `rejectedOrAccepted` is intentionally placed inside each callers instead
    // of in `reject` and `accept` functions, because some callers may not call `reject` or `accept`
    // immediately, but the `rejectedOrAccepted` flag itself should be set immediately.
    let rejectedOrAccepted = false;
    const reject = () => {
      const textMarkerRange = textMarker.find();
      if (!textMarkerRange) {
        cleanup.next("rejected");
        return;
      }
      const { from, to } = textMarkerRange;

      state.suppressMarkdownChange++;
      cm.replaceRange("", from, to);
      cm.setHistory(historyBefore);

      if (!sourceView.inSourceMode) {
        editor.undo.commandStack.length = 0;
        Array.prototype.push.apply(editor.undo.commandStack, commandStackBefore);
      }

      cleanup.next("rejected");
    };
    /**
     * Accept the completion.
     */
    const accept = () => {
      // Clear completion hint
      const textMarkerRange = textMarker.find();
      if (!textMarkerRange) {
        cleanup.next("rejected");
        return;
      }
      const { from, to } = textMarkerRange;

      state.suppressMarkdownChange++;
      cm.replaceRange("", from, to);
      cm.setHistory(historyBefore);

      if (!sourceView.inSourceMode) {
        editor.undo.commandStack.length = 0;
        Array.prototype.push.apply(editor.undo.commandStack, commandStackBefore);
      }

      // Insert completion text
      cm.replaceRange(
        text,
        { line: range.start.line, ch: range.start.character },
        { line: range.end.line, ch: range.end.character },
      );

      cleanup.next("accepted");
    };

    const cleanup = new Observable<"accepted" | "rejected">();
    cleanup.subscribeOnce(() => {
      cm.off("keydown", cmTabFixer);
      cm.off("beforeChange", cmChangeFixer);
      cm.off("cursorActivity", cursorMoveHandler);
    });

    /**
     * Intercept `Tab` key once and change it to accept completion.
     * @param _cm The CodeMirror instance.
     * @param event The keyboard event.
     */
    const cmTabFixer = (_cm: CodeMirror.Editor, event: KeyboardEvent) => {
      if (rejectedOrAccepted) return;

      // Prevent tab key to accept completion
      if (event.key === "Tab") {
        event.preventDefault();
        rejectedOrAccepted = true;
        accept();
      }
    };
    cm.on("keydown", cmTabFixer);

    /**
     * Reject completion before any change applied.
     * @param cm The CodeMirror instance.
     * @param change The change.
     */
    const cmChangeFixer = (cm: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => {
      if (rejectedOrAccepted) return;
      rejectedOrAccepted = true;

      const { from, origin, text, to } = change;

      // Cancel the change temporarily
      change.cancel();
      // Reject completion and redo the change after 1 tick
      // It is to make sure these changes are applied after the `"beforeChange"` event
      // has finished, in order to avoid corrupting the CodeMirror instance
      void Promise.resolve().then(() => {
        reject();
        if (origin === "undo" || origin === "redo") {
          if (sourceView.inSourceMode) cm[origin]();
          else editor.undo[origin]();
        } else {
          cm.replaceRange(text.join(Files.useCRLF ? "\r\n" : "\n"), from, to, origin);
        }
      });
    };
    cm.on("beforeChange", cmChangeFixer);

    /**
     * Reject completion if cursor moved.
     */
    const cursorMoveHandler = () => {
      if (rejectedOrAccepted) return;
      rejectedOrAccepted = true;

      reject();
    };
    cm.on("cursorActivity", cursorMoveHandler);

    return cleanup;
  };

  /**
   * Insert suggestion panel to CodeMirror.
   * @param cm The CodeMirror instance.
   * @returns
   */
  const insertSuggestionPanelToCodeMirror = (
    cm: CodeMirror.Editor,
    { displayText, range, text, uuid }: Completion,
  ): Observable<"accepted" | "rejected"> | void => {
    // Insert a suggestion panel below the cursor
    const unattachSuggestionPanel = attachSuggestionPanel(displayText, null, { cm });

    copilot.notification.notifyShown({ uuid });

    const insertCompletionText = () => {
      // Insert completion text
      cm.replaceRange(
        text,
        { line: range.start.line, ch: range.start.character },
        { line: range.end.line, ch: range.end.character },
      );
    };

    const cleanup = new Observable<"accepted" | "rejected">();
    cleanup.subscribeOnce(() => {
      unattachSuggestionPanel();
      cm.off("keydown", keydownHandler);
      cm.off("cursorActivity", cursorMoveHandler);
    });

    /**
     * Intercept `Tab` key once and change it to accept completion.
     * @param event The keyboard event.
     */
    // eslint-disable-next-line sonarjs/no-identical-functions
    const keydownHandler = (_: CodeMirror.Editor, event: KeyboardEvent) => {
      // Prevent tab key to trigger tab once
      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        insertCompletionText();
        cleanup.next("accepted");
      }
    };
    cm.on("keydown", keydownHandler);

    /**
     * Reject completion if cursor moved.
     */
    const cursorMoveHandler = () => {
      cleanup.next("rejected");
    };
    cm.on("cursorActivity", cursorMoveHandler);

    return cleanup;
  };

  /*******************
   * Change handlers *
   *******************/
  /**
   * Callback to be invoked when workspace folder changed.
   * @param newFolder The new workspace folder.
   * @param oldFolder The old workspace folder.
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
   * @param newPathname The new active file pathname.
   * @param oldPathname The old active file pathname.
   */
  const onChangeActiveFile = (newPathname: string | null, oldPathname: string | null) => {
    if (oldPathname) {
      taskManager.rejectCurrentIfExist();
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
   * Trigger completion.
   */
  const triggerCompletion = debounce({ delay: 500 }, () => {
    logger.debug("Changing markdown", {
      from: state.markdownUsedInLastCompletion,
      to: state.markdown,
    });

    // Update state
    state.markdownUsedInLastCompletion = state.markdown;

    /* Tell Copilot that file has changed */
    const version = ++copilot.version;
    copilot.notification.textDocument.didChange({
      textDocument: { version, uri: pathToFileURL(taskManager.activeFilePathname).href },
      contentChanges: [{ text: state.markdown }],
    });

    /* If caret position is available, fetch completion from Copilot */
    if (state.caretPosition) {
      const caretPosition = state.caretPosition;
      logger.debug("Triggering completion at", caretPosition);
      taskManager.start(caretPosition, {
        onCompletion: (completion) => {
          if (editor.sourceView.inSourceMode)
            if (settings.useInlineCompletionTextInSource)
              return insertCompletionTextToCodeMirror(cm, completion);
            else return insertSuggestionPanelToCodeMirror(cm, completion);
          else return insertCompletionTextToEditor(caretPosition, completion);
        },
      });
    }
  });

  /*********************
   * Initialize states *
   *********************/
  const editor = Files.editor as Typora.EnhancedEditor;
  // Initialize state
  const initialMarkdown = editor.getMarkdown();
  const state = {
    markdownUsedInLastCompletion: initialMarkdown,
    markdown: initialMarkdown,
    caretPosition: { line: 0, character: 0 } as Position | null,
    _actualLatestMarkdown: initialMarkdown,
    suppressMarkdownChange: 0,
  };
  // Initialize CodeMirror
  const sourceView = editor.sourceView as Typora.EnhancedSourceView;
  if (!sourceView.cm) sourceView.prep();
  const cm = sourceView.cm!;

  /***************************
   * Initialize task manager *
   ***************************/
  const taskManager = new CompletionTaskManager(copilot, {
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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
    // Register editor info
    initializationOptions: {
      editorInfo: { name: "Typora", version: TYPORA_VERSION },
      editorPluginInfo: { name: "typora-copilot", version: VERSION },
    },
  });
  copilot.notification.initialized();

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
    if (taskManager.state === "pending") {
      logger.debug(`Refusing completion before toggling source mode ${on ? "on" : "off"}`);
      taskManager.rejectCurrentIfExist();
    }
  });

  /* Watch for markdown change in live preview mode */
  editor.on("change", (_, { newMarkdown }) => {
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

    /* When update not suppressed */
    // Update caret position
    if (
      editor.selection.getRangy()?.collapse && // If not selecting text
      window.getSelection()?.rangeCount // If has cursor
    ) {
      const changes = computeTextChanges(state.markdown, newMarkdown, state.caretPosition);
      if (changes.length === 1) {
        const change = changes[0]!;
        const changeLines = change.text.split(Files.useCRLF ? "\r\n" : "\n").length - 1;
        state.caretPosition = {
          line: change.range.start.line + changeLines,
          character:
            changeLines === 0 ?
              change.range.start.character + change.text.length
            : change.text.lastIndexOf(Files.useCRLF ? "\r\n" : "\n") - 1,
        };

        // Fix code blocks, math blocks and HTML blocks caret position
        // When creating these blocks, Typora place the caret in the middle of the block,
        // instead of at the end of the block
        if (
          // If it is an insert operation
          change.range.start.line === change.range.end.line &&
          change.range.start.character === change.range.end.character &&
          // If not in input
          !document.activeElement?.classList.contains("ty-input")
          // If in a CodeMirror instance
        ) {
          // The line of the starter (```, ~~~, $$, <div>, etc.)
          let starterLine =
            change.range.start.character === 0 ?
              change.range.start.line - 1
            : change.range.start.line;

          const lines = newMarkdown.split(Files.useCRLF ? "\r\n" : "\n");
          if (lines[starterLine] === "") starterLine--;
          const lineText = lines[starterLine];

          let starter: string | undefined = undefined;
          let ender: string | undefined = undefined;

          if (lineText) {
            const unindentedLineText = lineText.replace(/^(\s|>)*/, "");

            // * Code block *
            if (
              // Check if the caret is inside a CodeMirror instance
              document.activeElement?.tagName === "TEXTAREA" &&
              (starter = /^(```([^`]|$)|~~~([^~]|$))/.exec(unindentedLineText)?.[0]?.slice(0, 3))
            ) {
              ender = starter;
            }
            // * Math block *
            // NOTE: Typora renders the CodeMirror instance of a math/HTML block in an async way,
            // so we cannot check if the caret is inside a CodeMirror instance like what we did
            // in code blocks checking
            else if (unindentedLineText === "$$" && change.text.trimEnd().endsWith("$$")) {
              starter = ender = "$$";
            }
            // * HTML block *
            else if (
              (starter = /^<[^>]*>/.exec(unindentedLineText)?.[0]) &&
              change.text.trimEnd().endsWith(`</${starter.slice(1, -1)}>`)
            ) {
              ender = `</${starter.slice(1, -1)}>`;
            }

            if (starter && ender) {
              const caretLine = starterLine + 1;
              const caretLineText = lines[caretLine];
              if (caretLineText !== undefined)
                state.caretPosition = {
                  line: caretLine,
                  character:
                    caretLineText.replace(/^(\s|>)*/, "") === ender ? 0 : caretLineText.length,
                };
            }
          }
        }

        // Set `character` to 0 if it is negative
        if (state.caretPosition.character < 0) state.caretPosition.character = 0;
      } else {
        state.caretPosition = null;
      }
    } else {
      state.caretPosition = null;
    }
    // Update current markdown text
    state.markdown = newMarkdown;
    // Reject last completion if exists
    taskManager.rejectCurrentIfExist();
    // Trigger completion
    triggerCompletion();
  });

  /* Watch for markdown change in source mode */
  cm.on("change", (cm): void => {
    if (settings.disableCompletions) return;
    if (!editor.sourceView.inSourceMode) return;

    const newMarkdown = cm.getValue(Files.useCRLF ? "\r\n" : "\n");
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
    // Update caret position if not selecting text
    if (!cm.getSelection()) {
      state.caretPosition = {
        line: cm.getCursor().line,
        character: cm.getCursor().ch,
      };
    } else {
      state.caretPosition = null;
    }
    // Update current markdown text
    state.markdown = newMarkdown;
    // Reject last completion if exists
    taskManager.rejectCurrentIfExist();
    // Trigger completion
    triggerCompletion();
  });

  /* Cancel current request on caret move */
  $(editor.writingArea).on("caretMove", () => {
    if (settings.disableCompletions) return;
    if (sourceView.inSourceMode) return;

    taskManager.rejectCurrentIfExist();
  });
  cm.on("cursorActivity", () => {
    if (settings.disableCompletions) return;
    if (!editor.sourceView.inSourceMode) return;

    taskManager.rejectCurrentIfExist();
  });
}).catch((err) => {
  throw err;
});
