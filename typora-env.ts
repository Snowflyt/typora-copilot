//////////////////////////////////////////////////////////////////////////////////////////////////
/// Typora Environment                                                                         ///
///                                                                                            ///
/// Some types and marked as `any` or `unknown` because they are not used in this project, and ///
/// it's not worth the effort to declare all the types.                                        ///
//////////////////////////////////////////////////////////////////////////////////////////////////

/*********************
 * Global variables. *
 *********************/
/**
 * The jQuery function.
 *
 * It is not a full jQuery instance, but only contains some methods used by this project.
 */
declare var $: {
  (selector: string): JQuery;
  (element: Element): JQuery;
};
interface JQuery<TElement = HTMLElement> {
  [index: number]: TElement;
  length: number;

  closest(selector: string): JQuery<TElement>;
  first(): JQuery<TElement>;
  last(): JQuery<TElement>;
  eq(index: number): JQuery<TElement>;
  each(callback: (index: number, element: TElement) => void): JQuery<TElement>;
  html(htmlString: string): JQuery<TElement>;
  html(): string;
  text(textString: string): JQuery<TElement>;
  text(): string;
  rawText(): string;
  val(value: string): JQuery<TElement>;
  val(): string;
  append(content: JQuery<TElement> | HTMLElement | string): JQuery<TElement>;
  prepend(content: JQuery<TElement> | HTMLElement | string): JQuery<TElement>;
}

/**
 * Options of the Typora application.
 *
 * The actual properties are more than these, but they are not used in this project, so they are not
 * declared here.
 */
declare var _options: {
  appVersion: string;
};

/**
 * The CodeMirror constructor.
 */
declare var CodeMirror: {
  fromTextArea: (textarea: HTMLTextAreaElement, options?: object) => Typora.CodeMirror;
};

/**
 * The actual type of `File` in Typora application.
 */
type ExtendedFileConstructor = typeof globalThis.File & FileConstructorExtensions;
/**
 * File constructor extensions defined by Typora.
 */
interface FileConstructorExtensions {
  /**
   * The typora editor instance.
   *
   * It is usually initialized only once and will not be reinitialized even the active file or
   * folder is changed, so it is safe to cache the value.
   */
  editor: Typora.Editor;

  /**
   * Legacy property, used to store the active file pathname, now use `bundle.filePath` instead.
   */
  filePath?: string;
  /**
   * Properties of the active file.
   */
  bundle?: {
    /**
     * File name with extension. Not present when the file is not saved.
     */
    fileName?: string;
    /**
     * Pathname of the file. Empty string when the file is not saved.
     */
    filePath: string;
    /**
     * Last modified date.
     */
    modifiedDate: Date | number;
    /**
     * Pathname of the file. Exists if file has been modified.
     */
    hasModified?: string;
    unsupported?: boolean;
    lastSnapDate: number;
    savedContent: string;
    untitledId: number;
    fileEncode?: string;
    fileMissingWhenOpen?: boolean;
    unusedAssets: readonly unknown[];
    assetsChanges?: unknown | null;
  };

  /**
   * Whether the file is using CRLF line endings.
   */
  useCRLF?: boolean;

  /**
   * Global options.
   *
   * The actual properties are more than these, but they are not used in this project, so they are
   * not declared here.
   */
  option: {
    headingStyle: number;
  };

  /**
   * Reload the markdown content from `value`.
   * @param value The markdown content.
   * @param options Options for reloading the content.
   * @returns
   */
  reloadContent: (
    value: string,
    options?: {
      skipUndo?: boolean;
      delayRefresh?: boolean;
      fromDiskChange?: boolean;
      skipChangeCount?: boolean;
      onInit?: boolean;
      skipStore?: boolean;
    }
  ) => void;
}

/**********
 * Typora *
 **********/
/**
 * Types related to Typora.
 */
declare namespace Typora {
  /**********
   * Common *
   **********/
  /**
   * Content ID. A string that uniquely identifies a node in the document.
   * @example "n41"
   */
  type CID = string;
  /**
   * Language ID. A string that identifies a language. Can be any string, and some specific values
   * are used by Typora.
   * @example "javascript"
   */
  type LanguageId =
    | "ABAP"
    | "apl"
    | "asciiarmor"
    | "ASN.1"
    | "asp"
    | "assembly"
    | "bash"
    | "basic"
    | "bat"
    | "c"
    | "c#"
    | "c++"
    | "cassandra"
    | "ceylon"
    | "clike"
    | "clojure"
    | "cmake"
    | "cmd"
    | "cobol"
    | "coffeescript"
    | "commonlisp"
    | "cpp"
    | "CQL"
    | "crystal"
    | "csharp"
    | "css"
    | "cypher"
    | "cython"
    | "D"
    | "dart"
    | "diff"
    | "django"
    | "dockerfile"
    | "dtd"
    | "dylan"
    | "ejs"
    | "elixir"
    | "elm"
    | "embeddedjs"
    | "erb"
    | "erlang"
    | "F#"
    | "forth"
    | "fortran"
    | "fsharp"
    | "gas"
    | "gfm"
    | "gherkin"
    | "glsl"
    | "go"
    | "groovy"
    | "handlebars"
    | "haskell"
    | "haxe"
    | "hive"
    | "htaccess"
    | "html"
    | "http"
    | "hxml"
    | "idl"
    | "ini"
    | "jade"
    | "java"
    | "javascript"
    | "jinja2"
    | "js"
    | "json"
    | "jsp"
    | "jsx"
    | "julia"
    | "kotlin"
    | "latex"
    | "less"
    | "lisp"
    | "livescript"
    | "lua"
    | "makefile"
    | "mariadb"
    | "markdown"
    | "mathematica"
    | "matlab"
    | "mbox"
    | "modelica"
    | "mssql"
    | "mysql"
    | "nginx"
    | "nim"
    | "nsis"
    | "objc"
    | "objective-c"
    | "ocaml"
    | "octave"
    | "oz"
    | "pascal"
    | "pegjs"
    | "perl"
    | "perl6"
    | "pgp"
    | "php"
    | "php+HTML"
    | "plsql"
    | "postgresql"
    | "powershell"
    | "properties"
    | "protobuf"
    | "pseudocode"
    | "pug"
    | "python"
    | "q"
    | "R"
    | "react"
    | "reStructuredText"
    | "rst"
    | "ruby"
    | "rust"
    | "SAS"
    | "scala"
    | "scheme"
    | "scss"
    | "sh"
    | "shell"
    | "smalltalk"
    | "smarty"
    | "solidity"
    | "SPARQL"
    | "spreadsheet"
    | "sql"
    | "sqlite"
    | "squirrel"
    | "stata"
    | "stylus"
    | "svelte"
    | "swift"
    | "systemverilog"
    | "tcl"
    | "tex"
    | "tiddlywiki"
    | "tiki wiki"
    | "toml"
    | "ts"
    | "tsx"
    | "turtle"
    | "twig"
    | "typescript"
    | "v"
    | "vb"
    | "vbscript"
    | "velocity"
    | "verilog"
    | "vhdl"
    | "visual basic"
    | "vue"
    | "web-idl"
    | "wiki"
    | "xaml"
    | "xml"
    | "xml-dtd"
    | "xquery"
    | "yacas"
    | "yaml"
    | "yara"
    | (string & NonNullable<unknown>);

  /*****************************************
   * Cursor & Selection & Position & Range *
   *****************************************/
  /**
   * A range of text in raw markdown, used by CodeMirror.
   */
  interface CodeMirrorDocumentRange {
    from: CodeMirrorDocumentPosition;
    to: CodeMirrorDocumentPosition;
  }
  /**
   * Representing a text cursor position in raw markdown, used by CodeMirror.
   */
  interface CodeMirrorDocumentPosition {
    line: number;
    ch: number;
    sticky?: unknown;
  }
  /**
   * Representing the text cursor position in raw markdown. Can be considered as an enhanced version
   * of {@link CodeMirrorDocumentPosition}.
   */
  interface CursorPlacement {
    line: number;
    ch?: number;
    before?: string;
    beforeRegExp?: string;
    afterIndent?: boolean;
  }
  /**
   * Rangy range.
   */
  interface Rangy {
    startContainer: HTMLElement;
    collapsed: boolean;
    commonAncestorContainer: HTMLElement;

    setStartBefore(el: HTMLElement): void;
    toHtml(): HTMLElement;
  }
  interface RangyText {
    assignedSlot: unknown | null;
    baseURI: string;
    childNodes: NodeList;
    /**
     * File pathname.
     */
    data: string;
    firstChild: unknown | null;
    isConnected: boolean;
  }

  /**************
   * CodeMirror *
   **************/
  // **Note:** Typora uses a custom version of CodeMirror, so the CodeMirror instance may not work
  // as expected.
  /**
   * CodeMirror instance.
   */
  class CodeMirror {
    doc: {
      lineCount(): number;
      getValue(): string;
      getLine(line: number): string | null;
      getCursor(): CodeMirrorDocumentPosition;
      setCursor(pos: CodeMirrorDocumentPosition): void;
      getSelection(): string;
    };

    getValue(EOL?: string): string;
    setValue: (value: string, type?: string) => void;
    getLine(line: number): string | null;
    getCursor(): CodeMirrorDocumentPosition;
    setCursor(pos: CodeMirrorDocumentPosition): void;

    replaceRange: (
      replacement: string,
      from: CodeMirrorDocumentPosition,
      to?: CodeMirrorDocumentPosition,
      origin?: string
    ) => void;

    addWidget: (pos: CodeMirrorDocumentPosition, node: Element, scrollIntoView: boolean) => void;
    markText: (
      from: CodeMirrorDocumentPosition,
      to: CodeMirrorDocumentPosition,
      options?: { className?: string; inclusiveLeft?: boolean; inclusiveRight?: boolean }
    ) => CodeMirrorTextMarker;

    getHistory(): { done: readonly object[]; undone: readonly object[] };
    setHistory(history: { done: readonly object[]; undone: readonly object[] }): void;
    undo(): void;
    redo(): void;
    getWrapperElement(): HTMLElement;

    on(event: "keydown", handler: (cm: CodeMirror, event: KeyboardEvent) => void): void;
    /**
     * This event is fired before a change is applied, and its handler may choose to modify or
     * cancel the change. The `change` object has `from`, `to`, and `text` properties, as with the
     * `"change"` event. It also has a `cancel()` method, which can be called to cancel the
     * change, and, if the change isn't coming from an undo or redo event, an
     * `update(from, to, text)` method, which may be used to modify the change. Undo or redo
     * changes can't be modified, because they hold some metainformation for restoring old marked
     * ranges that is only valid for that specific change. All three arguments to update are
     * optional, and can be left off to leave the existing value for that field intact.
     *
     * **Note:** you may not do anything from a `"beforeChange"` handler that would cause changes
     * to the document or its visualization. Doing so will, since this handler is called directly
     * from the bowels of the CodeMirror implementation, probably cause the editor to become
     * corrupted.
     */
    on(
      event: "beforeChange",
      handler: (cm: CodeMirror, change: CodeMirrorBeforeChangeEvent) => void
    ): void;
    on(event: "change", handler: (cm: CodeMirror, change: CodeMirrorChangeEvent) => void): void;
    /**
     * Will be fired when the cursor or selection moves, or any change is made to the editor
     * content.
     */
    on(event: "cursorActivity", handler: (cm: CodeMirror) => void): void;

    off(event: "keydown", handler: (cm: CodeMirror, event: KeyboardEvent) => void): void;
    off(
      event: "beforeChange",
      handler: (cm: CodeMirror, change: CodeMirrorBeforeChangeEvent) => void
    ): void;
    off(event: "change", handler: (cm: CodeMirror, change: CodeMirrorChangeEvent) => void): void;
    off(event: "cursorActivity", handler: (cm: CodeMirror) => void): void;
  }

  interface CodeMirrorTextMarker {
    /**
     * Remove the mark.
     */
    clear: () => void;
    /**
     * Returns a `CodeMirrorDocumentRange` object representing the current position of the mark
     * range, or `undefined` if the mark is no longer in the document.
     */
    find: () => CodeMirrorDocumentRange | undefined;
    /**
     * Call it if you've done something that might change the size of the marker (e.g. changing the
     * content of a `replacedWith` node), and want to cheaply update the display.
     */
    changed: () => void;
  }

  interface CodeMirrorBeforeChangeEvent {
    from: CodeMirrorDocumentPosition;
    to: CodeMirrorDocumentPosition;
    text: readonly string[];
    /**
     * Cancel the change.
     */
    cancel: () => void;
    /**
     * Update the change. Only available if the change isn't coming from an undo or redo event.
     * @param from
     * @param to
     * @param text
     */
    update?: (
      from?: CodeMirrorDocumentPosition,
      to?: CodeMirrorDocumentPosition,
      text?: string
    ) => void;
    origin: string | undefined;
  }
  interface CodeMirrorChangeEvent {
    from: CodeMirrorDocumentPosition;
    to: CodeMirrorDocumentPosition;
    text: readonly string[];
    removed: readonly string[];
    origin: string | undefined;
  }

  /**********
   * Editor *
   **********/
  /**
   * Enhanced Typora editor instance provided by this project.
   */
  type EnhancedEditor = Editor & EditorExtensions;
  /**
   * Typora editor instance.
   */
  class Editor {
    /**
     * Functions related to editing operations.
     * 
     * The actual properties are more than these, but they are not used in this project, so they are
     * not declared here.
     */
    EditHelper: {
      showDialog: (options: {
        title: string;
        message?: string;
        html?: string;
        buttons: readonly string[];
        type?: "info" | "warning" | "error";
        callback?: (index: number) => void;
      }) => void;
    }
    /**
     * Functions related to user operations.
     *
     * The actual properties are more than these, but they are not used in this project, so they are
     * not declared here.
     */
    UserOp: {
      backspaceHandler: (editor: Editor, event: KeyboardEvent | null, keyName: string) => void;
    };

    /**
     * The current focused content ID.
     */
    focusCid: string;

    /**
     * Last text cursor position.
     */
    lastCursor:
      | {
          type: "cursor";
          /**
           * CID.
           */
          id: string;
          start: number;
          end: number;
        }
      | {
          type: "cursor";
          inSourceMode: true;
          pos: { line: number; ch: number; sticky: unknown };
        }
      | null;
    /**
     * Selection range.
     *
     * The actual properties are more than these, but they are not used in this project, so they are
     * not declared here.
     */
    selection: {
      getRangy: () => Rangy | null;

      jumpIntoElemBegin: (elem: JQuery) => void;
      jumpIntoElemEnd: (elem: JQuery) => void;
    };

    /**
     * Library manager.
     *
     * The actual properties are more than these, but they are not used in this project, so they are
     * not declared here.
     */
    library?: {
      /**
       * Current folder root.
       */
      root?: FileEntity;
      /**
       * Current folder path.
       */
      watchedFolder?: string;
    };

    /**
     * Auto complete state. e.g. providing suggestions when typing "```" in fenced code block.
     */
    autoComplete?: {
      state: {
        type: string;
        token: string;
        match: readonly string[];
        all: readonly string[];
        index: number;
        rowHeight: number;
        anchor: { start: number; end: number; containerNode: HTMLElement };
        beforeApply: unknown | undefined;
      };
    };

    /**
     * History manager for undo and redo.
     */
    undo: HistoryManager;

    refocus(): void;

    /**
     * Node map used by Typora to represent the markdown document.
     */
    nodeMap: {
      allNodes: NodeMap;
      blocks: NodeMap;
      foot_list: NodeMap;
      link_list: NodeMap;
      toc: NodeMap;

      reset(): void;
      /**
       * Get the markdown content of the document.
       */
      toMark(): string;
    };

    /**
     * The source view instance.
     */
    sourceView: SourceView;

    /**
     * The root DOM element of the editor (`#write`).
     */
    writingArea: HTMLDivElement;

    /**
     * Fences.
     *
     * The actual properties are more than these, but they are not used in this project, so they are
     * not declared here.
     */
    fences: {
      getCm(cid: string): CodeMirror;
    };
    /**
     * Math blocks.
     *
     * The actual properties are more than these, but they are not used in this project, so they are
     * not declared here.
     */
    mathBlock: {
      currentCm?: CodeMirror;
    };
    /**
     * HTML blocks.
     *
     * The actual properties are more than these, but they are not used in this project, so they are
     * not declared here.
     */
    htmlBlock: {
      currentCm?: CodeMirror;
    };

    /**
     * Restore the last text cursor position.
     */
    restoreLastCursor: () => void;

    /**
     * Get the markdown content of the document.
     */
    getMarkdown: () => string;

    /**
     * Get node by CID.
     */
    getNode: (cid: string) => Node;
    /**
     * Get jQuery element of the given element.
     */
    getJQueryElem: (el: Element) => JQuery;
    /**
     * Get elements by CID.
     */
    findElemById: (cid: string) => JQuery;

    /**
     * Insert text at the current text cursor position.
     */
    insertText: (text: string) => void;
  }
  /**
   * Extensions of the `Editor` class provided by this project.
   */
  interface EditorExtensions {
    /**
     * Invoked after the markdown content is changed.
     * @param event The event object.
     * @param handler The event handler.
     */
    on(
      event: "change",
      handler: (
        editor: Editor,
        ev: { oldMarkdown: string; newMarkdown: string }
      ) => void | Promise<void>
    ): void;

    off(
      event: "change",
      handler: (
        editor: Editor,
        ev: { oldMarkdown: string; newMarkdown: string }
      ) => void | Promise<void>
    ): void;
  }

  /**
   * History manager for undo and redo.
   */
  class HistoryManager {
    commandStack: Array<{
      date: unknown | undefined;
      incomplete: unknown | null;
      source: unknown | null;
      undo: object[];
      redo: object[];
    }>;

    undo(): void;
    redo(): void;

    removeLastRegisteredOperationCommand(): void;
  }

  /***************
   * Source view *
   ***************/
  /**
   * Enhanced Typora source view instance provided by this project.
   */
  type EnhancedSourceView = SourceView & SourceViewExtensions;
  /**
   * Typora source view instance.
   */
  class SourceView {
    /**
     * The CodeMirror instance.
     */
    cm: CodeMirror | null;
    /**
     * Whether source mode is enabled.
     */
    inSourceMode: boolean;

    /**
     * Prepare the CodeMirror instance.
     */
    prep(): void;

    /**
     * Change text cursor position in **live preview mode**.
     *
     * It is *strange* that this method is not declared on `Editor` but in `SourceView`, it actually
     * does not to move a line in source mode, but move to a specific line and character in live
     * preview mode (which is not immediately apparent from the name).
     * @param options The options.
     */
    gotoLine(options: CodeMirrorDocumentPosition & { lineText: string | null }): void;

    enableTypeWriterMode(enable?: boolean): void;
    normalScrollAdjust(): void;
    onSave(): void;
    scrollAdjust(): void;
    setValue(value: string, valueChanged?: boolean, type?: string): void;

    hide(): void;
    show(): void;
  }
  /**
   * Extensions of the `SourceView` class provided by this project.
   */
  interface SourceViewExtensions {
    /**
     * Invoked before the source view is toggled.
     * @param sv The source view instance.
     * @param on `true` if the source view is being toggled on, otherwise `false`.
     */
    on(event: "beforeToggle", handler: (sv: SourceView, on: boolean) => void | Promise<void>): void;
    /**
     * Invoked after the source view is toggled.
     * @param sv The source view instance.
     * @param on `true` if the source view is being toggled on, otherwise `false`.
     */
    on(event: "toggle", handler: (sv: SourceView, on: boolean) => void | Promise<void>): void;
    /**
     * Invoked before the source view is shown.
     * @param sv The source view instance.
     */
    on(event: "beforeShow", handler: (sv: SourceView) => void | Promise<void>): void;
    /**
     * Invoked after the source view is shown.
     * @param sv The source view instance.
     */
    on(event: "show", handler: (sv: SourceView) => void | Promise<void>): void;
    /**
     * Invoked before the source view is hidden.
     * @param sv The source view instance.
     */
    on(event: "beforeHide", handler: (sv: SourceView) => void | Promise<void>): void;
    /**
     * Invoked after the source view is hidden.
     * @param sv The source view instance.
     */
    on(event: "hide", handler: (sv: SourceView) => void | Promise<void>): void;

    off(
      event: "beforeToggle",
      handler: (sv: SourceView, on: boolean) => void | Promise<void>
    ): void;
    off(event: "toggle", handler: (sv: SourceView, on: boolean) => void | Promise<void>): void;
    off(event: "beforeShow", handler: (sv: SourceView) => void | Promise<void>): void;
    off(event: "show", handler: (sv: SourceView) => void | Promise<void>): void;
    off(event: "beforeHide", handler: (sv: SourceView) => void | Promise<void>): void;
    off(event: "hide", handler: (sv: SourceView) => void | Promise<void>): void;
  }

  /********
   * Node *
   ********/
  /**
   * Typora Node. Used in `Editor.nodeMap` to represent a markdown node to be rendered.
   */
  class Node {
    cid: string;
    id: string;
    attributes: NodeAttributes;
    cursorDiff: readonly unknown[];

    get(name: "ahead"): number | undefined;
    get(name: "before"): Node | undefined;
    get(name: "after"): Node | undefined;
    get(name: "tail"): number | undefined;
    get(name: "parent"): Node | undefined;
    get(name: "children"): NodeMap;
    get<T>(name: string): T | undefined;

    getVeryFirst(flag?: boolean): Node | undefined;
    getFirstChild(): Node | undefined;

    getTopBlock(): Node | undefined;

    unset(name: string): void;

    isLoose(loose?: boolean): boolean;

    /**
     * Get the markdown content of the node.
     */
    toMark(): string;

    /*********************************
     * Static properties and methods *
     *********************************/
    /**
     * Node types.
     */
    static TYPE: {
      atag: "atag";
      attr: "attr";
      autolink: "autolink";
      blockquote: "blockquote";
      br: "br";
      code: "code";
      comment: "comment";
      def_footnote: "def_footnote";
      def_link: "def_link";
      del: "del";
      em: "em";
      emoji: "emoji";
      emptyline: "emptyline";
      escape: "escape";
      fences: "fences";
      footnote: "footnote";
      heading: "heading";
      highlight: "highlight";
      hr: "hr";
      html_block: "html_block";
      html_entity: "html_entity";
      html_inline: "html_inline";
      iframe: "iframe";
      image: "image";
      imgtag: "imgtag";
      inline_math: "inline_math";
      linebreak: "linebreak";
      link: "link";
      list: "list";
      list_item: "list_item";
      math_block: "math_block";
      meta_block: "meta_block";
      pants: "pants";
      paragraph: "paragraph";
      plain_text: "plain_text";
      raw_edit: "raw_edit";
      refimg: "refimg";
      reflink: "reflink";
      ruby: "ruby";
      softbreak: "softbreak";
      strong: "strong";
      subscript: "subscript";
      superscript: "superscript";
      tab: "tab";
      table: "table";
      table_cell: "table_cell";
      table_row: "table_row";
      tag: "tag";
      toc: "toc";
      underline: "underline";
      url: "url";
    };

    /**
     * Check if a value equals one of the following arguments.
     */
    static isType(node: unknown, types: readonly unknown[]): boolean | undefined;
    static isType(node: unknown, ...types: unknown[]): boolean | undefined;

    static parseFrom(
      text: string,
      nodeMap: Editor["nodeMap"],
      options?: object
    ): [string, readonly Node[]];
  }

  class NodeMap {
    _map: Map<CID, Node>;
    _set: readonly Node[];
    length: number;

    add(node: Node): void;
    at(index: number): Node | undefined;
    first(): Node | undefined;
    forEach: (callback: (node: Node, index: number) => void) => void;
    get(cid: CID): Node | undefined;
    indexOf(node: Node): number;
    map<R>(callback: (node: Node, index: number) => R): R[];
    remove(node: Node): void;
    reset(): void;
    sortedFirst(): Node | undefined;
    sortedForEach: (callback: (node: Node, index: number) => void) => void;
    toArray(): readonly Node[];
    /**
     * Put a node in the map using its `cid` as the key.
     * @param node
     */
    update(node: Node): void;
  }

  interface NodeAttributes {
    after: Node | undefined;
    ahead: number | undefined;
    align: unknown;
    alignText: unknown;
    alt: unknown;
    attachTo: Editor["nodeMap"];
    attr: unknown;
    before: Node | undefined;
    checked: unknown;
    children?: NodeMap;
    depth: number | undefined;
    displayStyle: unknown;
    empty: unknown;
    header?: unknown;
    height?: unknown;
    href?: unknown;
    id: string;
    in: Editor["nodeMap"];
    isFixed: unknown;
    lang: LanguageId | undefined;
    marginLeft: unknown;
    marginRight: unknown;
    markindent: unknown;
    mathEqLabel: unknown;
    mathLabel: unknown;
    noCloseTag: unknown;
    parent: Node | undefined;
    pattern: string | undefined;
    patternEnd: unknown;
    prespace: unknown;
    style: string | undefined;
    subindent: unknown;
    tagAfter: unknown;
    tagBefore: unknown;
    tail: number | undefined;
    /**
     * Markdown text to render.
     */
    text: string | undefined;
    title?: unknown;
    tight?: boolean;
    type:
      | "heading"
      | "paragraph"
      | "blockquote"
      | "fences"
      | "list"
      | "list_item"
      | (string & NonNullable<unknown>);
    userIndent: readonly string[] | undefined;
    userText: unknown;
  }

  /********
   * File *
   ********/
  /**
   * File entity. Used in `Editor.library.root` to represent a file or directory.
   */
  interface FileEntity {
    createDate: Date;
    lastModified: Date;
    fetched: boolean;
    isDirectory: boolean;
    isFile: boolean;
    /**
     * Directory name or file name.
     */
    name: string;
    /**
     * Directory path or file pathname.
     */
    path: string;
    /**
     * Files in the directory (if `isDirectory` is `true`, otherwise empty array).
     */
    content: readonly FileEntity[];
    /**
     * Subdirectories (if `isDirectory` is `true`, otherwise empty array).
     */
    subdir: readonly FileEntity[];
  }
}
