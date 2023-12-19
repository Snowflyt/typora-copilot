//////////////////////////////////////////////////////////////////////////////////////////////
/// Extracted contents (Extracted from Typora's bundled code, I don't understand them all) ///
//////////////////////////////////////////////////////////////////////////////////////////////

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/triple-slash-reference */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-inner-declarations */

// @ts-nocheck

/// <reference path="./typora-env.ts" />

/* These two aliases are used to make the code a little more type-safe */
const File = /** @type {ExtendedFileConstructor} */ (window.File);
const Node = /** @type {typeof Typora.Node} */ (/** @type {unknown} */ (window.Node));

/*******************************************************************************************
 * Extracted functions (Extracted from Typora's bundled code, I don't understand them all) *
 *******************************************************************************************/
/**
 * Get the caret placement of the current node.
 * @returns {Typora.CaretPlacement | null}
 */
export const getCaretPlacement = () =>
  _getCursorPlacement.call(
    /** @type {ExtendedFileConstructor & { get(key: string): string | undefined }} */ (File),
  ) ?? null;
/**
 * @this {ExtendedFileConstructor & { get(key: string): string | undefined }}
 * @param {Typora.CaretPlacement} [placement]
 * @returns {Typora.CaretPlacement | undefined}
 */
function _getCursorPlacement(placement) {
  if (this.editor.focusCid) {
    var activeElements = this.editor.findElemById(this.editor.focusCid),
      activeNode = this.editor.getNode(this.editor.focusCid),
      i = 0,
      r = "",
      o = "",
      rangy = this.editor.selection.getRangy();
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
              ? e(node.get("before"), n + g(node.get("before")))
              : node.get("parent")
              ? e(node.get("parent"), n + (node.get("parent").get("ahead") || 0))
              : n
            : n
        );
      }
      i = e(activeNode) + (activeNode.get("ahead") || 0);
      if (Node.isType(activeNode, Node.TYPE.fences))
        return (
          (s = !/`|~/.exec(activeNode.get("pattern") || "```")) || i++,
          ((placement = document.activeElement.classList.contains("ty-cm-lang-input")
            ? { line: -1, before: activeNode.get("pattern") || "```" }
            : /** @type {Typora.CaretPlacement} */ (
                // THIS IS TO FIX A BUG IN TYPORA, THE IMPLEMENTATION IS NOT THE SAME AS THE ORIGINAL
                // Typora originally just mutate the cursor in place and return itself, which can cause bugs.
                // Here I use a immutable way by creating a new one, which is slower but safer.
                new /** @type {new (line: number, ch: number, sticky?: unknown) => CodeMirror.Position} */ (
                  this.editor.fences.getCm(activeNode.cid).doc.getCursor().constructor
                )(
                  this.editor.fences.getCm(activeNode.cid).doc.getCursor().line,
                  this.editor.fences.getCm(activeNode.cid).doc.getCursor().ch,
                  this.editor.fences.getCm(activeNode.cid).doc.getCursor().sticky,
                )
              )).before =
            (s ? activeNode.get("pattern") : "") +
            this.editor.fences
              .getCm(activeNode.cid)
              .getLine(placement.line)
              .substring(0, placement.ch)),
          (placement.line = placement.line + i),
          (placement.ch = /** @type {number} */ (undefined)),
          placement
        );
      if (Node.isType(activeNode, Node.TYPE.math_block))
        return this.editor.mathBlock.currentCm
          ? (((placement = this.editor.mathBlock.currentCm.doc.getCursor()).line =
              placement.line + i + 1),
            placement)
          : { line: i, ch: -1 };
      if (Node.isType(activeNode, Node.TYPE.toc)) return { line: i, before: "]" };
      if (Node.isType(activeNode, Node.TYPE.hr))
        return { line: i, before: this.get("pattern") || "------" };
      if (Node.isType(activeNode, Node.TYPE.def_link, Node.TYPE.def_footnote)) {
        var s = this.editor.getJQueryElem(rangy.startContainer),
          l = s.closest(".md-def-content");
        if (l.length)
          return rangy.setStartBefore(l[0]), { line: i, before: (r = "]: " + rangy.toString()) };
        if ((l = s.closest(".md-def-title")).length && s.text().length)
          return rangy.setStartBefore(l[0]), { line: i, before: (r = '"' + rangy.toString()) };
      }
      if (Node.isType(activeNode, Node.TYPE.table, Node.TYPE.table_row)) return { line: i, ch: -1 };
      if (
        (rangy.setStartBefore(activeElements[0]),
        // @ts-expect-error - `rawText` is added by Typora
        (r = $(rangy.toHtml()).rawText()),
        Node.isType(activeNode, Node.TYPE.table_cell))
      ) {
        for (o = "", activeNode = activeNode.get("before"); activeNode; )
          (o = "\\|[^|]*" + o), (activeNode = activeNode.get("before"));
        return { line: i, beforeRegExp: (r = o + "\\|\\s*" + escapeRegExp(r)) };
      }
      if (Node.isType(activeNode, Node.TYPE.meta_block))
        return {
          line: (i =
            ((r = r.replace(/^---/gm, "​---").replace(/\n$/g, "")).match(/\n/g) || []).length + 1),
          before: (r = r.substring(r.lastIndexOf("\\n"))),
        };
      if (Node.isType(activeNode, Node.TYPE.html_block))
        return this.editor.htmlBlock.currentCm
          ? (((placement = this.editor.htmlBlock.currentCm.doc.getCursor()).line =
              placement.line + i),
            placement)
          : { line: i + 2, ch: -1 };
      if ("" === r && Node.isType(activeNode, Node.TYPE.paragraph, Node.TYPE.heading)) {
        if (Node.isType(activeNode, Node.TYPE.heading)) {
          s = activeNode.toMark();
          if (/^\s*#/.exec(s)) return { line: i, beforeRegExp: "^\\s*#+\\s*" };
        }
        l = activeNode.getTopBlock();
        if (Node.isType(l, Node.TYPE.list, Node.TYPE.blockquote))
          return { line: i, ch: 0, afterIndent: true };
      }
      (activeElements = r.split(/\n/) || [r]), (r = activeElements.last());
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
  return e.replace(/[-\\{}*+?|^$.[\]()#]/g, "\\$&");
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
      Node.isType(node.get("parent"), Node.TYPE.list_item) &&
      false !== node.get("parent").get("tight")
    );
  }
  switch (node.get("type")) {
    case Node.TYPE.meta_block:
      return 2 + node.get("text").match(/(\n|$)/g).length + h(node);
    case Node.TYPE.heading:
      return (
        (node.get("ahead") || 0) +
        ((
          node.get("pattern") ||
          (!Node.isType(node.get("parent"), Node.TYPE.list_item) &&
          (1 == File.option.headingStyle || 3 == File.option.headingStyle) &&
          node.get("depth") <= 2
            ? "==="
            : "#")
        ).match(/[-=]/)
          ? 2
          : 1) +
        h(node)
      );
    case Node.TYPE.paragraph:
      var r = node.get("tail");
      return (
        (t || i(node)) && (r = 0),
        Node.isType(node.get("after"), Node.TYPE.paragraph) &&
          r < 1 &&
          (node.unset("tail"), (r = 1)),
        undefined !== r ||
          (!Node.isType(node.get("after"), Node.TYPE.math_block) && node.get("after")) ||
          (r = 0),
        (node.get("ahead") || 0) +
          (node.get("text").split(/\n/g).length || 1) +
          h(undefined === r ? node : r, r)
      );
    case Node.TYPE.blockquote:
      return (node.get("ahead") || 0) + n(node) + h(node);
    case Node.TYPE.list:
      r = node.get("ahead") || 0;
      return (
        node.isLoose(true),
        (r += n(node)),
        Node.isType(node.get("after"), Node.TYPE.list) &&
          /** @type {number} */ (!node.get("tail") || node.get("tail")) < 2 &&
          node.get("pattern") == node.get("after").get("pattern") &&
          node.get("style") == node.get("after").get("style") &&
          (node.unset("tail"), r++, i(node)) &&
          r++,
        t || (r += h(node, i(node) || !node.get("after") ? 0 : 1)),
        r
      );
    case Node.TYPE.list_item:
      return node.toMark().split(/\n/).length;
    case Node.TYPE.html_block:
      return (node.get("ahead") || 1) + (node.get("text").match(/\n/g) || []).length + h(node);
    case Node.TYPE.fences:
      var m = /`|~/.exec(node.get("pattern") || "```"),
        o = (node.get("noCloseTag") ? 1 : 2) + (node.get("empty") ? 0 : 1);
      return (
        (node.get("ahead") || 0) +
        (m ? o : 1) +
        (node.get("text").match(/\n/g) || []).length +
        h(node)
      );
    case Node.TYPE.math_block:
      return (
        (node.get("ahead") || 0) +
        3 +
        (node.get("text").match(/\n/g) || []).length +
        h(
          node,
          Node.isType(node.get("before"), Node.TYPE.paragraph) &&
            Node.isType(node.get("after"), Node.TYPE.paragraph)
            ? 0
            : 1,
        )
      );
    case Node.TYPE.hr:
      return (node.get("ahead") || 0) + h(node) + 1;
    case Node.TYPE.toc:
      return (node.get("ahead") || 0) + (node.get("pattern") || "").split(/\n/).length + h(node);
    case Node.TYPE.def_footnote:
    case Node.TYPE.def_link:
      return (
        (node.get("ahead") || 0) +
        1 +
        h(node, !node.get("after") || Node.isType(node.get("after"), Node.TYPE.def_link) ? 0 : 1)
      );
    case Node.TYPE.table:
      return (node.get("ahead") || 0) + node.get("children").length + 1 + h(node);
    case Node.TYPE.table_row:
      return node.get("before") ? 1 : 2;
    case Node.TYPE.table_cell:
      return 0;
    default:
      return 1;
  }
}
