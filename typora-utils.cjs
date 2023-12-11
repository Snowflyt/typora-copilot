// @ts-check

const { castAny, castNever, castUnknown, nonNullish } = require("./utils.cjs");

/******************
 * Type utilities *
 ******************/
/**
 * @template T
 * @typedef {new (...args: any[]) => T} Constructor Constructor The constructor type (class type) of `T`.
 */

/*************
 * Constants *
 *************/
/**
 * Typora version.
 */
const TYPORA_VERSION = window._options.appVersion;

/****************************
 * Proxies to make TS happy *
 ****************************/
/**
 * Readonly proxy for `File` to tell TS that it is extended.
 */
const Files = new Proxy(/** @type {ExtendedFileConstructor} */ (File), {
  get: (target, prop, receiver) => Reflect.get(target, prop, receiver),
});
/**
 * Readonly proxy for `Node` to tell TS that it is overridden by Typora.
 */
const Nodes = new Proxy(/** @type {typeof Typora.Node} */ (castUnknown(Node)), {
  get: (target, prop, receiver) => Reflect.get(target, prop, receiver),
});

/*********************
 * Prototype patches *
 *********************/
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
  const rawEditor = /** @type {ExtendedFileConstructor} */ (File).editor;

  /** @type {Typora.Editor & Typora.EditorExtensions} */
  const editorPrototype = rawEditor.constructor.prototype;

  /**
   * @type {Map<string, Array<(editor: Typora.Editor & Typora.EditorExtensions, ...args: any[]) => unknown>>}
   */
  const handlersMap = new Map();

  editorPrototype.on = (event, handler) => {
    if (!handlersMap.has(event)) handlersMap.set(event, []);
    const handlers = nonNullish(handlersMap.get(event));
    handlers.push(handler);
    handlersMap.set(event, handlers);
  };
  editorPrototype.off = (event, handler) => {
    if (!handlersMap.has(event)) return;
    const handlers = nonNullish(handlersMap.get(event));
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
  /** @type {?() => void | Promise<void>} */
  let scheduledTriggerChangeTask = null;
  const scheduleTriggerChange = () => {
    scheduledTriggerChangeTask = () => {
      const restoreConsoleError = temporarilySuppressConsoleError();
      /** @type {string} */
      let newMarkdown;
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
        handler(/** @type {Typora.EnhancedEditor} */ (rawEditor), {
          oldMarkdown: tmp,
          newMarkdown,
        });
    };
    void Promise.resolve().then(() => {
      scheduledTriggerChangeTask?.();
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
  nodeMapCollectionPrototype.reset = function (/** @type {any} */ ...args) {
    const result = originalNodeMapCollectionReset.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  const originalRestoreFromJson = nodeMapCollectionPrototype.restoreFromJson;
  nodeMapCollectionPrototype.restoreFromJson = function (/** @type {any} */ ...args) {
    const result = originalRestoreFromJson.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  /* Proxy `nodeMap.allNodes.constructor.prototype` */
  /** @type {Typora.NodeMap} */
  const nodeMapPrototype = rawNodeMap.allNodes.constructor.prototype;

  const originalAdd = nodeMapPrototype.add;
  nodeMapPrototype.add = function (/** @type {any} */ ...args) {
    const result = originalAdd.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  const originalRemove = nodeMapPrototype.remove;
  nodeMapPrototype.remove = function (/** @type {any} */ ...args) {
    const result = originalRemove.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  const originalNodeMapReset = nodeMapPrototype.reset;
  nodeMapPrototype.reset = function (/** @type {any} */ ...args) {
    const result = originalNodeMapReset.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  const originalUpdate = nodeMapPrototype.update;
  nodeMapPrototype.update = function (/** @type {any} */ ...args) {
    const result = originalUpdate.apply(this, args);
    scheduleTriggerChange();
    return result;
  };

  /* Watch for `editor.writingArea` input */
  const writingArea = rawEditor.writingArea;
  writingArea.addEventListener("input", (e) => {
    scheduleTriggerChange();
  });

  /**
   * @template {object} O
   * @param {O} o
   * @param {keyof O} key
   */
  const watchObj = (o, key) => {
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
      o[key] = castNever(
        /**
         * @this {any}
         * @param  {...any} args
         * @returns
         */
        function (...args) {
          const result = value.apply(this, args);
          scheduleTriggerChange();
          return result;
        }
      );
      return;
    }
    if (typeof value === "object") {
      for (const key of Object.getOwnPropertyNames(value))
        watchObj(value, /** @type {keyof typeof value} */ (key));
      return;
    }
  };

  /* Watch for all methods in `editor.UserOp` */
  const userOp = rawEditor.UserOp;
  for (const key of Object.getOwnPropertyNames(userOp))
    watchObj(userOp, /** @type {keyof typeof userOp} */ (key));

  /* Watch for all methods on `editor.undo.constructor.prototype` */
  const historyManagerPrototype = rawEditor.undo.constructor.prototype;
  for (const key of Object.getOwnPropertyNames(historyManagerPrototype))
    watchObj(historyManagerPrototype, /** @type {keyof typeof historyManagerPrototype} */ (key));
};

/**
 * Enhance Typora `SourceView` class (by manipulating its prototype) to provide the following methods:
 *
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
  /** @type {Typora.SourceView & Typora.SourceViewExtensions} */
  const sourceViewPrototype = Files.editor.sourceView.constructor.prototype;

  /**
   * @type {Map<string, Array<(sv: Typora.SourceView, ...args: any[]) => unknown>>}
   */
  const handlersMap = new Map();

  sourceViewPrototype.on = (event, handler) => {
    if (!handlersMap.has(event)) handlersMap.set(event, []);
    const handlers = nonNullish(handlersMap.get(event));
    handlers.push(handler);
    handlersMap.set(event, handlers);
  };
  sourceViewPrototype.off = (event, handler) => {
    if (!handlersMap.has(event)) return;
    const handlers = nonNullish(handlersMap.get(event));
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
 * @returns {Promise<void>}
 */
const waitUntilEditorInitialized = () =>
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

/*******************************************************************************************
 * Extracted functions (Extracted from Typora's bundled code, I don't understand them all) *
 *******************************************************************************************/
/**
 * Get the cursor placement of the current node.
 * @returns {Typora.CursorPlacement | null}
 */
const getCursorPlacement = () =>
  _getCursorPlacement.call(
    /** @type {ExtendedFileConstructor & { get(key: string): string | undefined }} */ (File)
  ) ?? null;
/**
 * @this {ExtendedFileConstructor & { get(key: string): string | undefined }}
 * @param {Typora.CursorPlacement} [placement]
 * @returns {Typora.CursorPlacement | undefined}
 */
function _getCursorPlacement(placement) {
  if (this.editor.focusCid) {
    var activeElements = this.editor.findElemById(this.editor.focusCid),
      activeNode = this.editor.getNode(this.editor.focusCid),
      i = 0,
      r = "",
      o = "",
      rangy = nonNullish(this.editor.selection.getRangy());
    if (activeNode) {
      /**
       * @param {Typora.Node | undefined} node
       * @param {number} [n]
       * @returns {number}
       */
      function e(node, n) {
        return (
          (n = n || 0),
          node
            ? node.get("before")
              ? e(node.get("before"), n + g(nonNullish(node.get("before"))))
              : node.get("parent")
              ? e(node.get("parent"), n + (nonNullish(node.get("parent")).get("ahead") || 0))
              : n
            : n
        );
      }
      i = e(activeNode) + (activeNode.get("ahead") || 0);
      if (Nodes.isType(activeNode, Nodes.TYPE.fences))
        return (
          (s = castAny(!/`|~/.exec(activeNode.get("pattern") || "```"))) || i++,
          ((placement = nonNullish(document.activeElement).classList.contains("ty-cm-lang-input")
            ? { line: -1, before: activeNode.get("pattern") || "```" }
            : /** @type {Typora.CursorPlacement} */ (
                // THIS IS TO FIX A BUG IN TYPORA, THE IMPLEMENTATION IS NOT THE SAME AS THE ORIGINAL
                // Typora originally just mutate the cursor in place and return itself, which can cause bugs.
                // Here I use a immutable way by creating a new one, which is slower but safer.
                new /** @type {new (line: number, ch: number, sticky?: unknown) => Typora.CodeMirrorDocumentPosition} */ (
                  this.editor.fences.getCm(activeNode.cid).doc.getCursor().constructor
                )(
                  this.editor.fences.getCm(activeNode.cid).doc.getCursor().line,
                  this.editor.fences.getCm(activeNode.cid).doc.getCursor().ch,
                  this.editor.fences.getCm(activeNode.cid).doc.getCursor().sticky
                )
              )).before =
            (s ? activeNode.get("pattern") : "") +
            nonNullish(
              this.editor.fences.getCm(activeNode.cid).getLine(nonNullish(placement).line)
            ).substring(0, nonNullish(placement).ch)),
          (nonNullish(placement).line = nonNullish(placement).line + i),
          (nonNullish(placement).ch = /** @type {number} */ (castUnknown(undefined))),
          placement
        );
      if (Nodes.isType(activeNode, Nodes.TYPE.math_block))
        return this.editor.mathBlock.currentCm
          ? (((placement = this.editor.mathBlock.currentCm.doc.getCursor()).line =
              placement.line + i + 1),
            placement)
          : { line: i, ch: -1 };
      if (Nodes.isType(activeNode, Nodes.TYPE.toc)) return { line: i, before: "]" };
      if (Nodes.isType(activeNode, Nodes.TYPE.hr))
        return { line: i, before: this.get("pattern") || "------" };
      if (Nodes.isType(activeNode, Nodes.TYPE.def_link, Nodes.TYPE.def_footnote)) {
        var s = this.editor.getJQueryElem(nonNullish(rangy).startContainer),
          l = s.closest(".md-def-content");
        if (l.length)
          return (
            rangy.setStartBefore(nonNullish(l[0])),
            { line: i, before: (r = "]: " + rangy.toString()) }
          );
        if ((l = s.closest(".md-def-title")).length && s.text().length)
          return (
            rangy.setStartBefore(nonNullish(l[0])),
            { line: i, before: (r = '"' + rangy.toString()) }
          );
      }
      if (Nodes.isType(activeNode, Nodes.TYPE.table, Nodes.TYPE.table_row))
        return { line: i, ch: -1 };
      if (
        (rangy.setStartBefore(nonNullish(activeElements[0])),
        (r = $(rangy.toHtml()).rawText()),
        Nodes.isType(activeNode, Nodes.TYPE.table_cell))
      ) {
        for (o = "", activeNode = nonNullish(activeNode.get("before")); activeNode; )
          (o = "\\|[^|]*" + o), (activeNode = nonNullish(activeNode.get("before")));
        return { line: i, beforeRegExp: (r = o + "\\|\\s*" + escapeRegExp(r)) };
      }
      if (Nodes.isType(activeNode, Nodes.TYPE.meta_block))
        return {
          line: (i =
            ((r = r.replace(/^---/gm, "​---").replace(/\n$/g, "")).match(/\n/g) || []).length + 1),
          before: (r = r.substring(r.lastIndexOf("\\n"))),
        };
      if (Nodes.isType(activeNode, Nodes.TYPE.html_block))
        return this.editor.htmlBlock.currentCm
          ? (((placement = this.editor.htmlBlock.currentCm.doc.getCursor()).line =
              placement.line + i),
            placement)
          : { line: i + 2, ch: -1 };
      if ("" === r && Nodes.isType(activeNode, Nodes.TYPE.paragraph, Nodes.TYPE.heading)) {
        if (Nodes.isType(activeNode, Nodes.TYPE.heading)) {
          s = castAny(activeNode.toMark());
          if (/^\s*#/.exec(castAny(s))) return { line: i, beforeRegExp: "^\\s*#+\\s*" };
        }
        l = castAny(activeNode.getTopBlock());
        if (Nodes.isType(l, Nodes.TYPE.list, Nodes.TYPE.blockquote))
          return { line: i, ch: 0, afterIndent: true };
      }
      (activeElements = castAny(r.split(/\n/) || [r])), (r = castAny(activeElements.last()));
      return {
        line: i + activeElements.length - 1,
        before: r.replace(/(\u200B*):(\u200B*)/g, ":").replace(/\u200B\$/g, "$"),
      };
    }
  }
}
/**
 * @param {string} e
 */
function escapeRegExp(e) {
  return e.replace(/[\-\\\{\}\*\+\?\|\^\$\.\[\]\(\)\#]/g, "\\$&");
}

/**
 * Extracted from Typora's bundled code. I don't know what it does, but it is used by other functions.
 * @param {Typora.Node} node
 * @param {*} [t]
 * @returns {number}
 */
function g(node, t) {
  /**
   * @param {Typora.Node | number} tailOrTailNode
   * @param {*} [t]
   * @returns {number}
   */
  function h(tailOrTailNode, t) {
    var tail = "number" == typeof tailOrTailNode ? tailOrTailNode : tailOrTailNode.get("tail");
    return undefined === tail
      ? undefined === t
        ? /** @type {Typora.Node} */ (tailOrTailNode).get("after")
          ? 1
          : 0
        : t
      : tail;
  }

  /**
   * @param {Typora.Node} node
   * @param {*} [n]
   * @returns {number}
   */
  function n(node, n) {
    return node
      .get("children")
      .toArray()
      .reduce((acc, node) => acc + g(node, n), 0);
  }
  /**
   * @param {Typora.Node} node
   * @returns {boolean | undefined}
   */
  function i(node) {
    return (
      Nodes.isType(node.get("parent"), Nodes.TYPE.list_item) &&
      false !== nonNullish(node.get("parent")).get("tight")
    );
  }
  switch (node.get("type")) {
    case Nodes.TYPE.meta_block:
      return 2 + node.get("text").match(/(\n|$)/g).length + h(node);
    case Nodes.TYPE.heading:
      return (
        (node.get("ahead") || 0) +
        ((
          node.get("pattern") ||
          (!Nodes.isType(node.get("parent"), Nodes.TYPE.list_item) &&
          (1 == Files.option.headingStyle || 3 == Files.option.headingStyle) &&
          node.get("depth") <= 2
            ? "==="
            : "#")
        ).match(/[-=]/)
          ? 2
          : 1) +
        h(node)
      );
    case Nodes.TYPE.paragraph:
      var r = node.get("tail");
      return (
        (t || i(node)) && (r = 0),
        Nodes.isType(node.get("after"), Nodes.TYPE.paragraph) &&
          nonNullish(r) < 1 &&
          (node.unset("tail"), (r = 1)),
        undefined !== r ||
          (!Nodes.isType(node.get("after"), Nodes.TYPE.math_block) && node.get("after")) ||
          (r = 0),
        (node.get("ahead") || 0) +
          (node.get("text").split(/\n/g).length || 1) +
          h(undefined === r ? node : r, r)
      );
    case Nodes.TYPE.blockquote:
      return (node.get("ahead") || 0) + n(node) + h(node);
    case Nodes.TYPE.list:
      r = node.get("ahead") || 0;
      return (
        node.isLoose(true),
        (r += n(node)),
        Nodes.isType(node.get("after"), Nodes.TYPE.list) &&
          /** @type {number} */ (castUnknown(!node.get("tail") || node.get("tail"))) < 2 &&
          node.get("pattern") == nonNullish(node.get("after")).get("pattern") &&
          node.get("style") == nonNullish(node.get("after")).get("style") &&
          (node.unset("tail"), r++, i(node)) &&
          r++,
        t || (r += h(node, i(node) || !node.get("after") ? 0 : 1)),
        r
      );
    case Nodes.TYPE.list_item:
      return node.toMark().split(/\n/).length;
    case Nodes.TYPE.html_block:
      return (node.get("ahead") || 1) + (node.get("text").match(/\n/g) || []).length + h(node);
    case Nodes.TYPE.fences:
      var m = /`|~/.exec(node.get("pattern") || "```"),
        o = (node.get("noCloseTag") ? 1 : 2) + (node.get("empty") ? 0 : 1);
      return (
        (node.get("ahead") || 0) +
        (m ? o : 1) +
        (node.get("text").match(/\n/g) || []).length +
        h(node)
      );
    case Nodes.TYPE.math_block:
      return (
        (node.get("ahead") || 0) +
        3 +
        (node.get("text").match(/\n/g) || []).length +
        h(
          node,
          Nodes.isType(node.get("before"), Nodes.TYPE.paragraph) &&
            Nodes.isType(node.get("after"), Nodes.TYPE.paragraph)
            ? 0
            : 1
        )
      );
    case Nodes.TYPE.hr:
      return (node.get("ahead") || 0) + h(node) + 1;
    case Nodes.TYPE.toc:
      return (node.get("ahead") || 0) + (node.get("pattern") || "").split(/\n/).length + h(node);
    case Nodes.TYPE.def_footnote:
    case Nodes.TYPE.def_link:
      return (
        (node.get("ahead") || 0) +
        1 +
        h(node, !node.get("after") || Nodes.isType(node.get("after"), Nodes.TYPE.def_link) ? 0 : 1)
      );
    case Nodes.TYPE.table:
      return (node.get("ahead") || 0) + node.get("children").length + 1 + h(node);
    case Nodes.TYPE.table_row:
      return node.get("before") ? 1 : 2;
    case Nodes.TYPE.table_cell:
      return 0;
    default:
      return 1;
  }
}

module.exports = {
  TYPORA_VERSION,

  Files,
  Nodes,

  waitUntilEditorInitialized,

  getCursorPlacement,
};
