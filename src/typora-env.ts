//////////////////////////////////////////////////////////////////////////////////////////////////
/// Typora Environment                                                                         ///
///                                                                                            ///
/// Some types and marked as `any` or `unknown` because they are not used in this project, and ///
/// it's not worth the effort to declare all the types.                                        ///
//////////////////////////////////////////////////////////////////////////////////////////////////

/* eslint-disable @typescript-eslint/consistent-type-imports */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-namespace */

/* eslint-disable no-var */

import("codemirror");
import("rangy");

/*********************
 * Global variables. *
 *********************/
/**
 * Options of the Typora application.
 *
 * The actual properties are more than these, but they are not used in this project, so they are not
 * declared here.
 */
declare var _options: {
  userLocale?: string;
  appLocale?: string;
  appVersion: string;
};

/**
 * The CodeMirror constructor.
 */
declare var CodeMirror: typeof CodeMirror;

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
  editor?: Typora.Editor;

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
    },
  ) => void;

  isLinux: boolean;
  isLinuxSnap: boolean;
  isMac: boolean;
  isMacLegacy: boolean;
  isMacNode: boolean;
  isMacOrMacNode: boolean;
  isNode: boolean;
  isNodeHtml: boolean;
  isSafari: boolean;
  isUnixNode: boolean;
  isWin: boolean;
  isWk: boolean;
  isWK: boolean;
}

interface Window {
  /**
   * **⚠️ Warning:** This is **only available on Windows / Linux**.
   * @param moduleName The module name to require.
   * @returns The required module.
   */
  reqnode?: {
    (moduleName: "child_process"): typeof import("node:child_process");
    (moduleName: "util"): typeof import("node:util");
    (moduleName: string): unknown;
  };

  /**
   * **⚠️ Warning:** This is **only available on macOS**.
   */
  bridge?: {
    callHandler(
      type: "controller.runCommand",
      options: { args: string; cwd?: string },
      /**
       * Callback to be invoked when the command is finished.
       * @param results A tuple of `[success, stdout, stderr, command]`.
       */
      cb: (results: [boolean, string, string, string]) => void,
    ): void;
  };

  getCodeMirrorMode: (
    lang: Typora.LanguageId,
  ) => NonNullable<CodeMirror.EditorConfiguration["mode"]>;
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
   * Representing the text cursor position in raw markdown. Can be considered as an enhanced version
   * of {@link CodeMirror.Position}.
   */
  interface CaretPlacement {
    line: number;
    ch?: number;
    before?: string;
    beforeRegExp?: string;
    afterIndent?: boolean;
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
    };
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
      getRangy: () => RangyRange | null;

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
      getCm(cid: string): CodeMirror.Editor;
    };
    /**
     * Math blocks.
     *
     * The actual properties are more than these, but they are not used in this project, so they are
     * not declared here.
     */
    mathBlock: {
      currentCm?: CodeMirror.Editor;
    };
    /**
     * HTML blocks.
     *
     * The actual properties are more than these, but they are not used in this project, so they are
     * not declared here.
     */
    htmlBlock: {
      currentCm?: CodeMirror.Editor;
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
        ev: { oldMarkdown: string; newMarkdown: string },
      ) => void | Promise<void>,
    ): void;

    off(
      event: "change",
      handler: (
        editor: Editor,
        ev: { oldMarkdown: string; newMarkdown: string },
      ) => void | Promise<void>,
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
    cm: CodeMirror.Editor | null;
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
    gotoLine(options: CodeMirror.Position & { lineText: string | null }): void;

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
      handler: (sv: SourceView, on: boolean) => void | Promise<void>,
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

    static parseFrom(text: string, nodeMap: Editor["nodeMap"], options?: object): [string, Node[]];
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
