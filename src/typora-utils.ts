/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import * as path from "@modules/path";
import { fileURLToPath } from "@modules/url";

import { getCaretPlacement } from "./extracted";

import type { Position } from "./types/lsp";

/*************
 * Constants *
 *************/
/**
 * Typora version.
 */
export const TYPORA_VERSION = window._options.appVersion;

/**
 * Typora resource directory.
 */
export const TYPORA_RESOURCE_DIR: string = (() => {
  let result = "";
  if ("dirname" in window && window.dirname) result = window.dirname as string;
  else if ("__dirname" in window && window.__dirname) result = window.__dirname;
  else if ("appPath" in _options && _options.appPath) result = _options.appPath as string;

  if (!result) throw new Error("Cannot determine Typora resource directory.");

  if (result.startsWith("file://")) result = fileURLToPath(result);

  let lastResult = "";
  while (!["resources", "Resources"].includes(path.basename(result))) {
    lastResult = result;
    result = path.dirname(result);
    if (result === lastResult) throw new Error("Cannot determine Typora resource directory.");
  }

  return Files.isMac ? path.join(result, "TypeMark") : result;
})();

/*********************
 * Prototype patches *
 *********************/
let editorEnhanced = false;
/**
 * Enhance Typora `Editor` class (by manipulating its prototype) to provide the following methods:
 *
 * ```typescript
 * type EnhancedEditor = Typora.Editor & Typora.EditorExtensions;
 * interface Typora.EditorExtensions {
 *   on(event: "change", handler: (editor: EnhancedEditor, ev: ChangeEvent) => void | Promise<void>): void;
 *   off(event: "change", handler: (editor: EnhancedEditor, ev: ChangeEvent) => void | Promise<void>): void;
 * }
 * interface ChangeEvent {
 *   oldMarkdown: string;
 *   newMarkdown: string;
 * }
 * ```
 */
const enhanceEditor = () => {
  if (editorEnhanced) return;

  editorEnhanced = true;

  const rawEditor = Files.editor!;

  const editorPrototype: Typora.EnhancedEditor = rawEditor.constructor.prototype;

  const handlersMap: Map<
    string,
    Array<(editor: Typora.EnhancedEditor, ...args: any[]) => unknown>
  > = new Map();

  editorPrototype.on = (event, handler) => {
    if (!handlersMap.has(event)) handlersMap.set(event, []);
    const handlers = handlersMap.get(event)!;
    handlers.push(handler);
    handlersMap.set(event, handlers);
  };
  editorPrototype.off = (event, handler) => {
    if (!handlersMap.has(event)) return;
    const handlers = handlersMap.get(event)!;
    handlers.splice(handlers.indexOf(handler), 1);
    handlersMap.set(event, handlers);
  };

  const temporarilySuppressConsoleError = () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    return () => {
      console.error = originalConsoleError;
    };
  };

  let oldMarkdown = rawEditor.getMarkdown();
  let scheduledTriggerChangeTask: (() => void | Promise<void>) | null = null;
  const scheduleTriggerChange = () => {
    scheduledTriggerChangeTask = () => {
      const restoreConsoleError = temporarilySuppressConsoleError();
      let newMarkdown: string;
      try {
        newMarkdown = rawEditor.getMarkdown();
      } catch (e) {
        restoreConsoleError();
        return;
      }
      restoreConsoleError();
      if (!newMarkdown) return;
      if (oldMarkdown === newMarkdown) return;

      const tmp = oldMarkdown;
      oldMarkdown = newMarkdown;
      scheduledTriggerChangeTask = null;
      const handlers = handlersMap.get("change") ?? [];
      for (const handler of handlers)
        handler(rawEditor as Typora.EnhancedEditor, {
          oldMarkdown: tmp,
          newMarkdown,
        });
    };
    void Promise.resolve().then(() => {
      void scheduledTriggerChangeTask?.();
    });
  };

  /* Proxy set on `editor.nodeMap` */
  let rawNodeMap = rawEditor.nodeMap;
  Object.defineProperty(rawEditor, "nodeMap", {
    get() {
      return rawNodeMap;
    },
    set(value) {
      rawNodeMap = value;
      scheduleTriggerChange();
    },
  });

  /* Proxy `nodeMap.constructor.prototype` */
  const nodeMapCollectionPrototype = rawNodeMap.constructor.prototype;

  const originalNodeMapCollectionReset = nodeMapCollectionPrototype.reset;
  nodeMapCollectionPrototype.reset = function (...args: any) {
    const result = originalNodeMapCollectionReset.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  const originalRestoreFromJson = nodeMapCollectionPrototype.restoreFromJson;
  nodeMapCollectionPrototype.restoreFromJson = function (...args: any) {
    const result = originalRestoreFromJson.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  /* Proxy `nodeMap.allNodes.constructor.prototype` */
  const nodeMapPrototype: Typora.NodeMap = rawNodeMap.allNodes.constructor.prototype;

  const originalAdd = nodeMapPrototype.add;
  nodeMapPrototype.add = function (...args) {
    const result = originalAdd.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  const originalRemove = nodeMapPrototype.remove;
  nodeMapPrototype.remove = function (...args) {
    const result = originalRemove.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  const originalNodeMapReset = nodeMapPrototype.reset;
  nodeMapPrototype.reset = function (...args) {
    const result = originalNodeMapReset.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  const originalUpdate = nodeMapPrototype.update;
  nodeMapPrototype.update = function (...args) {
    const result = originalUpdate.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  /* Watch for `editor.writingArea` input */
  const writingArea = rawEditor.writingArea;
  writingArea.addEventListener("input", () => {
    scheduleTriggerChange();
  });

  /**
   * Watch an object and trigger `scheduleTriggerChange` when any of its methods
   * except those starting with `get`, `copy`, `is`, `has` is called.
   * @param o
   * @param key
   */
  const watchObj = <O>(o: O, key: keyof O) => {
    if (
      typeof key === "string" &&
      (key.startsWith("get") ||
        key.startsWith("copy") ||
        key.startsWith("is") ||
        key.startsWith("has"))
    )
      return;
    const value = o[key];
    if (value === null) return;
    if (typeof value === "function") {
      o[key] = function (this: any, ...args: any[]) {
        const result = value.apply(this, args);
        scheduleTriggerChange();
        return result;
      } as never;
      return;
    }
    if (typeof value === "object") {
      for (const key of Object.getOwnPropertyNames(value))
        watchObj(value, key as keyof typeof value);
    }
  };

  /* Watch for all methods in `editor.UserOp` */
  const userOp = rawEditor.UserOp;
  for (const key of Object.getOwnPropertyNames(userOp))
    watchObj(userOp, key as keyof typeof userOp);

  /* Watch for all methods on `editor.undo.constructor.prototype` */
  const historyManagerPrototype = rawEditor.undo.constructor.prototype;
  for (const key of Object.getOwnPropertyNames(historyManagerPrototype))
    watchObj(historyManagerPrototype, key as keyof typeof historyManagerPrototype);
};

let sourceViewEnhanced = false;
/**
 * Enhance Typora `SourceView` class (by manipulating its prototype) to provide the following methods:
 *
 * @example
 * ```typescript
 * type EnhancedSourceView = Typora.SourceView & Typora.SourceViewExtensions;
 * interface Typora.SourceViewExtensions {
 *   on(event: "beforeToggle", handler: (sv: EnhancedSourceView, on: boolean) => void | Promise<void>): void;
 *   on(event: "toggle", handler: (sv: EnhancedSourceView, on: boolean) => void | Promise<void>): void;
 *   on(event: "beforeShow", handler: (sv: EnhancedSourceView) => void | Promise<void>): void;
 *   on(event: "show", handler: (sv: EnhancedSourceView) => void | Promise<void>): void;
 *   on(event: "beforeHide", handler: (sv: EnhancedSourceView) => void | Promise<void>): void;
 *   on(event: "hide", handler: (sv: EnhancedSourceView) => void | Promise<void>): void;
 *
 *   off(event: "beforeToggle", handler: (sv: EnhancedSourceView, on: boolean) => void | Promise<void>): void;
 *   off(event: "toggle", handler: (sv: EnhancedSourceView, on: boolean) => void | Promise<void>): void;
 *   off(event: "beforeShow", handler: (sv: EnhancedSourceView) => void | Promise<void>): void;
 *   off(event: "show", handler: (sv: EnhancedSourceView) => void | Promise<void>): void;
 *   off(event: "beforeHide", handler: (sv: EnhancedSourceView) => void | Promise<void>): void;
 *   off(event: "hide", handler: (sv: EnhancedSourceView) => void | Promise<void>): void;
 * }
 * ```
 */
const enhanceSourceView = () => {
  if (sourceViewEnhanced) return;

  sourceViewEnhanced = true;

  const sourceViewPrototype: Typora.EnhancedSourceView =
    Files.editor!.sourceView.constructor.prototype;

  const handlersMap: Map<
    string,
    Array<(sv: Typora.SourceView, ...args: any[]) => unknown>
  > = new Map();

  sourceViewPrototype.on = (event, handler) => {
    if (!handlersMap.has(event)) handlersMap.set(event, []);
    const handlers = handlersMap.get(event)!;
    handlers.push(handler);
    handlersMap.set(event, handlers);
  };
  sourceViewPrototype.off = (event, handler) => {
    if (!handlersMap.has(event)) return;
    const handlers = handlersMap.get(event)!;
    handlers.splice(handlers.indexOf(handler), 1);
    handlersMap.set(event, handlers);
  };

  const originalHide = sourceViewPrototype.hide;
  sourceViewPrototype.hide = function () {
    const beforeHideHandlers = handlersMap.get("beforeHide") ?? [];
    for (const handler of beforeHideHandlers) handler(this);
    const beforeToggleHandlers = handlersMap.get("beforeToggle") ?? [];
    for (const handler of beforeToggleHandlers) handler(this, false);
    originalHide.call(this);
    const hideHandlers = handlersMap.get("hide") ?? [];
    for (const handler of hideHandlers) handler(this);
    const toggleHandlers = handlersMap.get("toggle") ?? [];
    for (const handler of toggleHandlers) handler(this, false);
  };

  const originalShow = sourceViewPrototype.show;
  sourceViewPrototype.show = function () {
    const beforeShowHandlers = handlersMap.get("beforeShow") ?? [];
    for (const handler of beforeShowHandlers) handler(this);
    const beforeToggleHandlers = handlersMap.get("beforeToggle") ?? [];
    for (const handler of beforeToggleHandlers) handler(this, true);
    originalShow.call(this);
    const showHandlers = handlersMap.get("show") ?? [];
    for (const handler of showHandlers) handler(this);
    const toggleHandlers = handlersMap.get("toggle") ?? [];
    for (const handler of toggleHandlers) handler(this, true);
  };
};

/*********************
 * Utility functions *
 *********************/
/**
 * Wait until Typora Editor is initialized.
 * @returns
 */
export const waitUntilEditorInitialized = (): Promise<void> =>
  new Promise((resolve) => {
    const interval = setInterval(() => {
      if (Files.editor) {
        clearInterval(interval);

        // Apply patches
        enhanceEditor();
        enhanceSourceView();

        resolve(undefined);
      }
    }, 100);
  });

/**
 * Get workspace folder path.
 *
 * **⚠️ Warning:** This function assumes {@link Files.editor} is initialized, otherwise an error will
 * be thrown. To ensure {@link Files.editor} is initialized, use {@link waitUntilEditorInitialized}
 * before this function.
 * @throws {TypeError} If {@link Files.editor} is not initialized.
 * @returns
 */
export const getWorkspaceFolder = (): string | null => Files.editor!.library?.watchedFolder ?? null;

/**
 * Get active file pathname.
 * @returns
 */
export const getActiveFilePathname = (): string | null =>
  (Files.filePath ?? (Files.bundle && Files.bundle.filePath)) || null;

/**
 * Get current caret position in source markdown text.
 *
 * **⚠️ Warning:** This function assumes {@link Files.editor} is initialized, otherwise an error will
 * be thrown. To ensure {@link Files.editor} is initialized, use {@link waitUntilEditorInitialized}
 * before this function.
 * @throws {TypeError} If {@link Files.editor} is not initialized.
 * @returns
 */
export const getCaretPosition = (): Position | null => {
  const editor = Files.editor!;
  const sourceView = editor.sourceView;
  if (!sourceView.cm) sourceView.prep();
  const cm = sourceView.cm!;

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
    ch = (/^((\s+)|([-+*]\s)|(\[( |x)\])|>|(\d+(\.|\))\s))+/i.exec(lineContent) || [""])[0].length;
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
 * Get closest CodeMirror instance from an element, if any.
 * @param element Element to search.
 * @returns CodeMirror instance if found, otherwise `null`.
 */
export const getCodeMirror = (element: Element): CodeMirror.Editor | null => {
  const cms = $(element).closest(".CodeMirror");
  if (!cms || !cms.length) return null;
  return (cms[0] as unknown as { CodeMirror: CodeMirror.Editor }).CodeMirror;
};

/*******************************************************************************************
 * Extracted functions (Extracted from Typora's bundled code, I don't understand them all) *
 *******************************************************************************************/
export { getCaretPlacement };
