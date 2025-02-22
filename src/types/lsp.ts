/* eslint-disable @typescript-eslint/no-deprecated */
/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
/* eslint-disable jsdoc/check-tag-names */
/* eslint-disable sonarjs/future-reserved-words */
/* eslint-disable sonarjs/no-globals-shadowing */

/**
 * Defines an integer number in the range of -2^31 to 2^31 - 1.
 */
export type integer = number;

/**
 * Defines an unsigned integer number in the range of 0 to 2^31 - 1.
 */
export type uinteger = number;

/**
 * Defines a decimal number. Since decimal numbers are very rare in the language server
 * specification we denote the exact range with every decimal using the mathematics interval
 * notation (e.g. [0, 1] denotes all decimals d with 0 <= d <= 1.
 */
export type decimal = number;

/**
 * The LSP any type.
 */
export type LSPAny = LSPObject | LSPArray | string | integer | uinteger | decimal | boolean | null;

/**
 * LSP object definition.
 */
export type LSPObject = {
  readonly [K: string]:
    | LSPObject
    | LSPArray
    | string
    | integer
    | uinteger
    | decimal
    | boolean
    | null;
};

/**
 * LSP arrays.
 */
export type LSPArray = readonly LSPAny[];

/*****************
 * Base Protocol *
 *****************/
/**
 * The JSON-RPC version.
 */
export type JSONRPCVersion = typeof JSONRPC_VERSION;
/**
 * The JSON-RPC version.
 */
export const JSONRPC_VERSION = "2.0";

/**
 * A general message as defined by JSON-RPC. The language server protocol always uses `"2.0"` as the
 * `jsonrpc` version.
 */
export type Message = {
  /**
   * The JSON-RPC version. Must be exactly `"2.0"`.
   */
  /* `extends infer U ? U : never` is a technique used here to tell TS to evaluate the type
      immediately, making type information more readable on hover. */
  jsonrpc: JSONRPCVersion extends infer U ? U : never;
};

/**
 * A request message to describe a request between the client and the server. Every processed
 * request must send a response back to the sender of the request.
 */
export interface RequestMessage extends Message {
  /**
   * The request id.
   */
  id: integer | string;

  /**
   * The method to be invoked.
   */
  method: string;

  /**
   * The method's params.
   */
  params?: LSPArray | LSPObject;
}

/**
 * A Response Message sent as a result of a request. If a request doesn’t provide a result value the
 * receiver of a request still needs to return a response message to conform to the JSON-RPC
 * specification. The result property of the ResponseMessage should be set to `null` in this case to
 * signal a successful request.
 */
export type ResponseMessage = SuccessResponseMessage | ErrorResponseMessage;

/**
 * A response message indicating a successful request.
 */
export interface SuccessResponseMessage extends Message {
  /**
   * The request id.
   */
  id: integer | string | null;

  /**
   * The result of a request. This member is REQUIRED on success.
   * This member MUST NOT exist if there was an error invoking the method.
   */
  result: LSPAny;
}
/**
 * A response message indicating a failed request.
 */
export interface ErrorResponseMessage extends Message {
  /**
   * The request id.
   */
  id: integer | string | null;

  /**
   * The error object in case a request fails.
   */
  error: ResponseError;
}

/**
 * An error object returned as a response to a request.
 */
export type ResponseError = {
  /**
   * A number indicating the error type that occurred.
   */
  code: number;

  /**
   * A string providing a short description of the error.
   */
  message: string;

  /**
   * A primitive or structured value that contains additional information about the error. Can be
   * omitted.
   */
  data?: LSPAny;
};

export namespace ErrorCodes {
  // Defined by JSON-RPC
  export const ParseError = -32700;
  export const InvalidRequest = -32600;
  export const MethodNotFound = -32601;
  export const InvalidParams = -32602;
  export const InternalError = -32603;

  /**
   * This is the start range of JSON-RPC reserved error codes. It doesn't denote a real error code.
   * No LSP error codes should be defined between the start and end range. For backwards
   * compatibility the `ServerNotInitialized` and the `UnknownErrorCode` are left in the range.
   *
   * @since 3.16.0
   */
  export const jsonrpcReservedErrorRangeStart = -32099;
  /** @deprecated use jsonrpcReservedErrorRangeStart */
  export const serverErrorStart = jsonrpcReservedErrorRangeStart;

  /**
   * Error code indicating that a server received a notification or request before the server has
   * received the `initialize` request.
   */
  export const ServerNotInitialized = -32002;
  export const UnknownErrorCode = -32001;

  /**
   * This is the end range of JSON-RPC reserved error codes.
   * It doesn't denote a real error code.
   *
   * @since 3.16.0
   */
  export const jsonrpcReservedErrorRangeEnd = -32000;
  /** @deprecated use jsonrpcReservedErrorRangeEnd */
  export const serverErrorEnd = jsonrpcReservedErrorRangeEnd;

  /**
   * This is the start range of LSP reserved error codes.
   * It doesn't denote a real error code.
   *
   * @since 3.16.0
   */
  export const lspReservedErrorRangeStart = -32899;

  /**
   * A request failed but it was syntactically correct, e.g the method name was known and the
   * parameters were valid. The error message should contain human readable information about why
   * the request failed.
   *
   * @since 3.17.0
   */
  export const RequestFailed = -32803;

  /**
   * The server cancelled the request. This error code should only be used for requests that
   * explicitly support being server cancellable.
   *
   * @since 3.17.0
   */
  export const ServerCancelled = -32802;

  /**
   * The server detected that the content of a document got modified outside normal conditions.
   * A server should NOT send this error code if it detects a content change in it unprocessed
   * messages. The result even computed on an older state might still be useful for the client.
   *
   * If a client decides that a result is not of any use anymore the client should cancel the
   * request.
   */
  export const ContentModified = -32801;

  /**
   * The client has canceled a request and a server as detected
   * the cancel.
   */
  export const RequestCancelled = -32800;

  /**
   * This is the end range of LSP reserved error codes.
   * It doesn't denote a real error code.
   *
   * @since 3.16.0
   */
  export const lspReservedErrorRangeEnd = -32800;
}

/**
 * A notification message. A processed notification message must not send a response back.
 * They work like events.
 */
export interface NotificationMessage extends Message {
  /**
   * The method to be invoked.
   */
  method: string;

  /**
   * The notification's params.
   */
  params?: LSPArray | LSPObject;
}

/**
 * Params to be sent with a `$/cancelRequest` notification.
 */
export type CancelParams = {
  /**
   * The request id to cancel.
   */
  id: integer | string;
};

/**
 * A token that represents a work in progress.
 */
export type ProgressToken = integer | string;

/**
 * Params to be sent with a `$/progress` notification.
 */
export type ProgressParams<T extends LSPAny = LSPAny> = {
  /**
   * The progress token provided by the client or server.
   */
  token: ProgressToken;

  /**
   * The progress data.
   */
  value: T;
};

/*************************
 * Basic JSON Structures *
 *************************/
/**
 * URI’s are transferred as strings.
 * The URI’s format is defined in https://tools.ietf.org/html/rfc3986.
 *
 * ```text
 *   foo://example.com:8042/over/there?name=ferret#nose
 *   \_/   \______________/\_________/ \_________/ \__/
 *    |           |            |            |        |
 * scheme     authority       path        query   fragment
 *    |   _____________________|__
 *   / \ /                        \
 *   urn:example:animal:ferret:nose
 * ```
 *
 * We also maintain a node module to parse a string into `scheme`, `authority`, `path`, `query`, and
 * `fragment` URI components. The GitHub repository is https://github.com/Microsoft/vscode-uri the
 * npm module is https://www.npmjs.com/package/vscode-uri.
 *
 * Many of the interfaces contain fields that correspond to the URI of a document. For clarity, the
 * type of such a field is declared as a `DocumentUri`. Over the wire, it will still be transferred
 * as a string, but this guarantees that the contents of that string can be parsed as a valid URI.
 *
 * Care should be taken to handle encoding in URIs. For example, some clients (such as VS Code) may
 * encode colons in drive letters while others do not. The URIs below are both valid, but clients
 * and servers should be consistent with the form they use themselves to ensure the other party
 * doesn’t interpret them as distinct URIs. Clients and servers should not assume that each other
 * are encoding the same way (for example a client encoding colons in drive letters cannot assume
 * server responses will have encoded colons). The same applies to casing of drive letters - one
 * party should not assume the other party will return paths with drive letters cased the same as
 * it.
 *
 * ```text
 * file:///c:/project/readme.md
 * file:///C%3A/project/readme.md
 * ```
 */
export type DocumentUri = string;

/**
 * A tagging interface for normal non document URIs. It maps to a string as well like
 * {@link DocumentUri}.
 */
export type URI = string;

/**
 * Client capabilities specific to regular expressions.
 *
 * Regular expression are a powerful tool and there are actual use cases for them in the language
 * server protocol. However the downside with them is that almost every programming language has its
 * own set of regular expression features so the specification can not simply refer to them as a
 * regular expression. So the LSP uses a two step approach to support regular expressions:
 *
 * - The client will announce which regular expression engine it will use. This will allow server
 * that are written for a very specific client make full use of the regular expression capabilities
 * of the client.
 * - The specification will define a set of regular expression features that should be supported by
 * a client. Instead of writing a new specification LSP will refer to the ECMAScript Regular
 * Expression specification and remove features from it that are not necessary in the context of LSP
 * or hard to implement for other clients.
 *
 * _Client Capability_:
 *
 * The following client capability is used to announce a client’s regular expression engine:
 *
 * - property path (optional): `general.regularExpressions`
 * - property type: {@link RegularExpressionsClientCapabilities} defined as follows.
 *
 * The following table lists the well known engine values. Please note that the table should be
 * driven by the community which integrates LSP into existing clients. It is not the goal of the
 * spec to list all available regular expression engines.
 *
 * | Engine     | Version  | Documentation |
 * | ---------- | -------- | ------------- |
 * | ECMAScript | `ES2020` | [ECMAScript 2020](https://tc39.es/ecma262/2020/) & [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) |
 *
 * _Regular Expression Subset_:
 *
 * The following features from the [ECMAScript 2020](https://tc39.es/ecma262/2020/) regular
 * expression specification are NOT mandatory for a client:
 *
 * - _Assertions_: Lookahead assertion, Negative lookahead assertion, lookbehind assertion, negative
 * lookbehind assertion.
 * - _Character classes_: matching control characters using caret notation (e.g. `\cX`) and matching
 * UTF-16 code units (e.g. `\uhhhh`).
 * - _Group and ranges_: named capturing groups.
 * - _Unicode property escapes_: none of the features needs to be supported.
 *
 * The only regular expression flag that a client needs to support is ‘i’ to specify a case
 * insensitive search.
 */
export type RegularExpressionsClientCapabilities = {
  /**
   * The engine's name.
   */
  engine: string;

  /**
   * The engine's version.
   */
  version?: string;
};

/**
 * To ensure that both client and server split the string into the same line representation the
 * protocol specifies the following end-of-line sequences: ‘\n’, ‘\r\n’ and ‘\r’. Positions are line
 * end character agnostic. So you can not specify a position that denotes `\r|\n` or `\n|` where `|`
 * represents the character offset.
 */
export type EOL = (typeof EOL)[number];
/**
 * To ensure that both client and server split the string into the same line representation the
 * protocol specifies the following end-of-line sequences: ‘\n’, ‘\r\n’ and ‘\r’. Positions are line
 * end character agnostic. So you can not specify a position that denotes `\r|\n` or `\n|` where `|`
 * represents the character offset.
 */
export const EOL = ["\n", "\r\n", "\r"] as const;

/**
 * Position in a text document expressed as zero-based line and zero-based character offset. A
 * position is between two characters like an ‘insert’ cursor in an editor. Special values like for
 * example `-1` to denote the end of a line are not supported.
 */
export type Position = {
  /**
   * Line position in a document (zero-based).
   */
  line: uinteger;

  /**
   * Character offset on a line in a document (zero-based). The meaning of this
   * offset is determined by the negotiated `PositionEncodingKind`.
   *
   * If the character value is greater than the line length it defaults back
   * to the line length.
   */
  character: uinteger;
};

/**
 * A type indicating how positions are encoded, specifically what column offsets mean.
 *
 * @since 3.17.0
 */
export type PositionEncodingKind = (typeof PositionEncodingKind)[keyof typeof PositionEncodingKind];

/**
 * A set of predefined position encoding kinds.
 *
 * @since 3.17.0
 */

export namespace PositionEncodingKind {
  /**
   * Character offsets count UTF-8 code units (e.g bytes).
   */
  export const UTF8 = "utf-8";

  /**
   * Character offsets count UTF-16 code units.
   *
   * This is the default and must always be supported
   * by servers
   */
  export const UTF16 = "utf-16";

  /**
   * Character offsets count UTF-32 code units.
   *
   * Implementation note: these are the same as Unicode code points,
   * so this `PositionEncodingKind` may also be used for an
   * encoding-agnostic representation of character offsets.
   */
  export const UTF32 = "utf-32";
}

/**
 * A range in a text document expressed as (zero-based) start and end positions. A range is
 * comparable to a selection in an editor. Therefore, the end position is exclusive. If you want to
 * specify a range that contains a line including the line ending character(s) then use an end
 * position denoting the start of the next line. For example:
 *
 * @example
 * ```javascript
 * {
 *   start: { line: 5, character: 23 },
 *   end : { line: 6, character: 0 }
 * }
 * ```
 */
export type Range = {
  /**
   * The range's start position.
   */
  start: Position;

  /**
   * The range's end position.
   */
  end: Position;
};

/**
 * Recommended language identifiers to use with the language client.
 */
export type LanguageIdentifier = (typeof LanguageIdentifiers)[number];
/**
 * Recommended language identifiers to use with the language client.
 */
export const LanguageIdentifiers = [
  "abap",
  "bat",
  "bibtex",
  "clojure",
  "coffeescript",
  "c",
  "cpp",
  "csharp",
  "css",
  "diff",
  "dart",
  "dockerfile",
  "elixir",
  "erlang",
  "fsharp",
  "git-commit",
  "git-rebase",
  "go",
  "groovy",
  "handlebars",
  "html",
  "ini",
  "java",
  "javascript",
  "javascriptreact",
  "json",
  "latex",
  "less",
  "lua",
  "makefile",
  "markdown",
  "objective-c",
  "objective-cpp",
  "perl",
  "perl6",
  "php",
  "powershell",
  "jade",
  "python",
  "r",
  "razor",
  "ruby",
  "rust",
  "scss",
  "sass",
  "scala",
  "shaderlab",
  "shellscript",
  "sql",
  "swift",
  "typescript",
  "typescriptreact",
  "tex",
  "vb",
  "xml",
  "xsl",
  "yaml",
] as const;
/**
 * An item to transfer a text document from the client to the server.
 *
 * Text documents have a language identifier to identify a document on the server side when it
 * handles more than one language to avoid re-interpreting the file extension. If a document refers
 * to one of the programming languages listed below it is recommended that clients use those ids.
 *
 * | Language | Identifier |
 * | -------- | ---------- |
 * | ABAP | `abap` |
 * | Windows Bat | `bat` |
 * | BibTeX | `bibtex` |
 * | Clojure | `clojure` |
 * | Coffeescript | `coffeescript` |
 * | C | `c` |
 * | C++ | `cpp` |
 * | C# | `csharp` |
 * | CSS | `css` |
 * | Diff | `diff` |
 * | Dart | `dart` |
 * | Dockerfile | `dockerfile` |
 * | Elixir | `elixir` |
 * | Erlang | `erlang` |
 * | F# | `fsharp` |
 * | Git | `git-commit` and `git-rebase` |
 * | Go | `go` |
 * | Groovy | `groovy` |
 * | Handlebars | `handlebars` |
 * | HTML | `html` |
 * | Ini | `ini` |
 * | Java | `java` |
 * | JavaScript | `javascript` |
 * | JavaScript React | `javascriptreact` |
 * | JSON | `json` |
 * | LaTeX | `latex` |
 * | Less | `less` |
 * | Lua | `lua` |
 * | Makefile | `makefile` |
 * | Markdown | `markdown` |
 * | Objective-C | `objective-c` |
 * | Objective-C++ | `objective-cpp` |
 * | Perl | `perl` |
 * | Perl 6 | `perl6` |
 * | PHP | `php` |
 * | Powershell | `powershell` |
 * | Pug | `jade` |
 * | Python | `python` |
 * | R | `r` |
 * | Razor (cshtml) | `razor` |
 * | Ruby | `ruby` |
 * | Rust | `rust` |
 * | SCSS | `scss` (syntax using curly brackets), `sass` (indented syntax) |
 * | Scala | `scala` |
 * | ShaderLab | `shaderlab` |
 * | Shell Script (Bash) | `shellscript` |
 * | SQL | `sql` |
 * | Swift | `swift` |
 * | TypeScript | `typescript` |
 * | TypeScript React | `typescriptreact` |
 * | TeX | `tex` |
 * | Visual Basic | `vb` |
 * | XML | `xml` |
 * | XSL | `xsl` |
 * | YAML | `yaml` |
 */
export type TextDocumentItem = {
  /**
   * The text document's URI.
   */
  uri: DocumentUri;

  /**
   * The text document's language identifier.
   */
  languageId: LanguageIdentifier | (string & NonNullable<unknown>);

  /**
   * The version number of this document (it will increase after each
   * change, including undo/redo).
   */
  version: integer;

  /**
   * The content of the opened text document.
   */
  text: string;
};

/**
 * Text documents are identified using a URI. On the protocol level, URIs are passed as strings.
 */
export type TextDocumentIdentifier = {
  /**
   * The text document's URI.
   */
  uri: DocumentUri;
};

/**
 * An identifier to denote a specific version of a text document. This information usually flows
 * from the client to the server.
 */
export interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  /**
   * The version number of this document.
   *
   * The version number of a document will increase after each change,
   * including undo/redo. The number doesn't need to be consecutive.
   */
  version: integer;
}

/**
 * An identifier which optionally denotes a specific version of a text document. This information
 * usually flows from the server to the client.
 */
export interface OptionalVersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  /**
   * The version number of this document. If an optional versioned text document
   * identifier is sent from the server to the client and the file is not
   * open in the editor (the server has not received an open notification
   * before) the server can send `null` to indicate that the version is
   * known and the content on disk is the master (as specified with document
   * content ownership).
   *
   * The version number of a document will increase after each change,
   * including undo/redo. The number doesn't need to be consecutive.
   */
  version: integer | null;
}

/**
 * Was `TextDocumentPosition` in 1.0 with inlined parameters.
 *
 * A parameter literal used in requests to pass a text document and a position inside that document.
 * It is up to the client to decide how a selection is converted into a position when issuing a
 * request for a text document. The client can for example honor or ignore the selection direction
 * to make LSP request consistent with features implemented internally.
 */
export type TextDocumentPositionParams = {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The position inside the text document.
   */
  position: Position;
};

/* eslint-disable no-irregular-whitespace */
/**
 * A document filter denotes a document through properties like `language`, `scheme` or `pattern`.
 * An example is a filter that applies to TypeScript files on disk. Another example is a filter that
 * applies to JSON files with name `package.json`:
 *
 * ```javascript
 * { language: 'typescript', scheme: 'file' }
 * { language: 'json', pattern: '**​/package.json' }
 * ```
 *
 * Please note that for a document filter to be valid at least one of the properties for `language`,
 * `scheme`, or `pattern` must be set. To keep the type definition simple all properties are marked
 * as optional.
 */
/* eslint-enable no-irregular-whitespace */
export type DocumentFilter = {
  /**
   * A language id, like `typescript`.
   */
  language?: string;

  /**
   * A Uri [scheme](#Uri.scheme), like `file` or `untitled`.
   */
  scheme?: string;

  /* eslint-disable no-irregular-whitespace */
  /**
   * A glob pattern, like `*.{ts,js}`.
   *
   * Glob patterns can have the following syntax:
   * - `*` to match one or more characters in a path segment
   * - `?` to match on one character in a path segment
   * - `**` to match any number of path segments, including none
   * - `{}` to group sub patterns into an OR expression. (e.g. `**​/*.{ts,js}`
   *   matches all TypeScript and JavaScript files)
   * - `[]` to declare a range of characters to match in a path segment
   *   (e.g., `example.[0-9]` to match on `example.0`, `example.1`, …)
   * - `[!...]` to negate a range of characters to match in a path segment
   *   (e.g., `example.[!0-9]` to match on `example.a`, `example.b`, but
   *   not `example.0`)
   */
  /* eslint-enable no-irregular-whitespace */
  pattern?: string;
};

/**
 * A document selector is the combination of one or more document filters.
 */
export type DocumentSelector = readonly DocumentFilter[];

/**
 * A textual edit applicable to a text document.
 */
export type TextEdit = {
  /**
   * The range of the text document to be manipulated. To insert
   * text into a document create a range where start === end.
   */
  range: Range;

  /**
   * The string to be inserted. For delete operations use an
   * empty string.
   */
  newText: string;
};

/**
 * Additional information that describes document changes.
 *
 * @since 3.16.0
 */
export type ChangeAnnotation = {
  /**
   * A human-readable string describing the actual change. The string
   * is rendered prominent in the user interface.
   */
  label: string;

  /**
   * A flag which indicates that user confirmation is needed
   * before applying the change.
   */
  needsConfirmation?: boolean;

  /**
   * A human-readable string which is rendered less prominent in
   * the user interface.
   */
  description?: string;
};

/**
 * An identifier referring to a change annotation managed by a workspace
 * edit.
 *
 * @since 3.16.0.
 */
export type ChangeAnnotationIdentifier = string;

/**
 * A special text edit with an additional change annotation.
 *
 * @since 3.16.0.
 */
export interface AnnotatedTextEdit extends TextEdit {
  /**
   * The actual annotation identifier.
   */
  annotationId: ChangeAnnotationIdentifier;
}

/**
 * Describes textual changes on a single text document. The text document is referred to as a
 * {@link OptionalVersionedTextDocumentIdentifier} to allow clients to check the text document
 * version before an edit is applied. A {@link TextDocumentEdit} describes all changes on a version
 * Si and after they are applied move the document to version Si+1. So the creator of a
 * {@link TextDocumentEdit} doesn’t need to sort the array of edits or do any kind of ordering.
 * However the edits must be non overlapping.
 */
export type TextDocumentEdit = {
  /**
   * The text document to change.
   */
  textDocument: OptionalVersionedTextDocumentIdentifier;

  /**
   * The edits to be applied.
   *
   * @since 3.16.0 - support for AnnotatedTextEdit. This is guarded by the
   * client capability `workspace.workspaceEdit.changeAnnotationSupport`
   */
  edits: (TextEdit | AnnotatedTextEdit)[];
};

/**
 * Represents a location inside a resource, such as a line inside a text file.
 */
export type Location = {
  uri: DocumentUri;
  range: Range;
};

/**
 * Represents a link between a source and a target location.
 */
export type LocationLink = {
  /**
   * Span of the origin of this link.
   *
   * Used as the underlined span for mouse interaction. Defaults to the word
   * range at the mouse position.
   */
  originSelectionRange?: Range;

  /**
   * The target resource identifier of this link.
   */
  targetUri: DocumentUri;

  /**
   * The full target range of this link. If the target for example is a symbol
   * then target range is the range enclosing this symbol not including
   * leading/trailing whitespace but everything else like comments. This
   * information is typically used to highlight the range in the editor.
   */
  targetRange: Range;

  /**
   * The range that should be selected and revealed when this link is being
   * followed, e.g the name of a function. Must be contained by the
   * `targetRange`. See also `DocumentSymbol#range`
   */
  targetSelectionRange: Range;
};

/**
 * Represents a diagnostic, such as a compiler error or warning. Diagnostic objects are only valid
 * in the scope of a resource.
 */
export type Diagnostic = {
  /**
   * The range at which the message applies.
   */
  range: Range;

  /**
   * The diagnostic's severity. Can be omitted. If omitted it is up to the
   * client to interpret diagnostics as error, warning, info or hint.
   */
  severity?: DiagnosticSeverity;

  /**
   * The diagnostic's code, which might appear in the user interface.
   */
  code?: integer | string;

  /**
   * An optional property to describe the error code.
   *
   * @since 3.16.0
   */
  codeDescription?: CodeDescription;

  /**
   * A human-readable string describing the source of this
   * diagnostic, e.g. 'typescript' or 'super lint'.
   */
  source?: string;

  /**
   * The diagnostic's message.
   */
  message: string;

  /**
   * Additional metadata about the diagnostic.
   *
   * @since 3.15.0
   */
  tags?: DiagnosticTag[];

  /**
   * An array of related diagnostic information, e.g. when symbol-names within
   * a scope collide all definitions can be marked via this property.
   */
  relatedInformation?: DiagnosticRelatedInformation[];

  /**
   * A data entry field that is preserved between a
   * `textDocument/publishDiagnostics` notification and
   * `textDocument/codeAction` request.
   *
   * @since 3.16.0
   */
  data?: unknown;
};

/**
 * Diagnostic severities and tags supported by the protocol.
 */
export type DiagnosticSeverity = (typeof DiagnosticSeverity)[keyof typeof DiagnosticSeverity];
/**
 * Diagnostic severities and tags supported by the protocol.
 */

export namespace DiagnosticSeverity {
  /**
   * Reports an error.
   */
  export const Error = 1;

  /**
   * Reports a warning.
   */
  export const Warning = 2;

  /**
   * Reports an information.
   */
  export const Information = 3;

  /**
   * Reports a hint.
   */
  export const Hint = 4;
}

/**
 * The diagnostic tags.
 *
 * @since 3.15.0
 */
export type DiagnosticTag = (typeof DiagnosticTag)[keyof typeof DiagnosticTag];
/**
 * The diagnostic tags.
 *
 * @since 3.15.0
 */

export namespace DiagnosticTag {
  /**
   * Unused or unnecessary code.
   *
   * Clients are allowed to render diagnostics with this tag faded out
   * instead of having an error squiggle.
   */
  export const Unnecessary = 1;

  /**
   * Deprecated or obsolete code.
   *
   * Clients are allowed to rendered diagnostics with this tag strike through.
   */
  export const Deprecated = 2;
}

/**
 * Represents a related message and source code location for a diagnostic.
 * This should be used to point to code locations that cause or are related to
 * a diagnostics, e.g when duplicating a symbol in a scope.
 */
export type DiagnosticRelatedInformation = {
  /**
   * The location of this related diagnostic information.
   */
  location: Location;

  /**
   * The message of this related diagnostic information.
   */
  message: string;
};

/**
 * Structure to capture a description for an error code.
 *
 * @since 3.16.0
 */
export type CodeDescription = {
  /**
   * An URI to open with more information about the diagnostic error.
   */
  href: URI;
};

/**
 * Represents a reference to a command. Provides a title which will be used to represent a command
 * in the UI. Commands are identified by a string identifier. The recommended way to handle Commands
 * is to implement their execution on the server side if the client and server provides the
 * corresponding capabilities. Alternatively the tool extension code could handle the command. The
 * protocol currently doesn’t specify a set of well-known commands.
 */
export type Command = {
  /**
   * Title of the command, like `save`.
   */
  title: string;

  /**
   * The identifier of the actual command handler.
   */
  command: string;

  /**
   * Arguments that the command handler should be
   * invoked with.
   */
  arguments?: LSPAny[];
};

/**
 * Describes the content type that a client supports in various result literals like `Hover`,
 * `ParameterInfo` or `CompletionItem`.
 *
 * Please note that `MarkupKinds` must not start with a `$`. This kinds are reserved for internal
 * usage.
 */
export type MarkupKind = (typeof MarkupKind)[keyof typeof MarkupKind];
/**
 * Describes the content type that a client supports in various result literals like `Hover`,
 * `ParameterInfo` or `CompletionItem`.
 *
 * Please note that `MarkupKinds` must not start with a `$`. This kinds are reserved for internal
 * usage.
 */

export namespace MarkupKind {
  /**
   * Plain text is supported as a content format
   */
  export const PlainText = "plaintext";

  /**
   * Markdown is supported as a content format
   */
  export const Markdown = "markdown";
}

/**
 * A `MarkupContent` literal represents a string value which content is
 * interpreted base on its kind flag. Currently the protocol supports
 * `plaintext` and `markdown` as markup kinds.
 *
 * If the kind is `markdown` then the value can contain fenced code blocks like
 * in GitHub issues.
 *
 * Here is an example how such a string can be constructed using
 * JavaScript / TypeScript:
 *
 * ```typescript
 * let markdown: MarkdownContent = {
 *   kind: MarkupKind.Markdown,
 *   value: [
 *     '# Header',
 *     'Some text',
 *     '```typescript',
 *     'someCode();',
 *     '```'
 *   ].join('\n')
 * };
 * ```
 *
 * _Please Note_ that clients might sanitize the return markdown. A client could
 * decide to remove HTML from the markdown to avoid script execution.
 */
export type MarkupContent = {
  /**
   * The type of the Markup
   */
  kind: MarkupKind;

  /**
   * The content itself
   */
  value: string;
};

/**
 * Client capabilities specific to the used markdown parser.
 *
 * Known markdown parsers used by clients right now are:
 *
 * | Name | Version | Documentation |
 * | ---- | ------- | ------------- |
 * | marked | 1.1.0 | [Marked Documentation](https://marked.js.org) |
 * | Python-Markdown | 3.2.2 | [Python-Markdown Documentation](https://python-markdown.github.io) |
 *
 * @since 3.16.0
 */
export type MarkdownClientCapabilities = {
  /**
   * The name of the parser.
   */
  parser: string;

  /**
   * The version of the parser.
   */
  version?: string;

  /**
   * A list of HTML tags that the client allows / supports in
   * Markdown.
   *
   * @since 3.17.0
   */
  allowedTags?: readonly string[];
};

/**
 * Options to create a file.
 */
export type CreateFileOptions = {
  /**
   * Overwrite existing file. Overwrite wins over `ignoreIfExists`
   */
  overwrite?: boolean;

  /**
   * Ignore if exists.
   */
  ignoreIfExists?: boolean;
};

/**
 * Create file operation
 */
export type CreateFile = {
  /**
   * A create
   */
  kind: "create";

  /**
   * The resource to create.
   */
  uri: DocumentUri;

  /**
   * Additional options
   */
  options?: CreateFileOptions;

  /**
   * An optional annotation identifier describing the operation.
   *
   * @since 3.16.0
   */
  annotationId?: ChangeAnnotationIdentifier;
};

/**
 * Rename file options
 */
export type RenameFileOptions = {
  /**
   * Overwrite target if existing. Overwrite wins over `ignoreIfExists`
   */
  overwrite?: boolean;

  /**
   * Ignores if target exists.
   */
  ignoreIfExists?: boolean;
};

/**
 * Rename file operation
 */
export type RenameFile = {
  /**
   * A rename
   */
  kind: "rename";

  /**
   * The old (existing) location.
   */
  oldUri: DocumentUri;

  /**
   * The new location.
   */
  newUri: DocumentUri;

  /**
   * Rename options.
   */
  options?: RenameFileOptions;

  /**
   * An optional annotation identifier describing the operation.
   *
   * @since 3.16.0
   */
  annotationId?: ChangeAnnotationIdentifier;
};

/**
 * Delete file options
 */
export type DeleteFileOptions = {
  /**
   * Delete the content recursively if a folder is denoted.
   */
  recursive?: boolean;

  /**
   * Ignore the operation if the file doesn't exist.
   */
  ignoreIfNotExists?: boolean;
};

/**
 * Delete file operation
 */
export type DeleteFile = {
  /**
   * A delete
   */
  kind: "delete";

  /**
   * The file to delete.
   */
  uri: DocumentUri;

  /**
   * Delete options.
   */
  options?: DeleteFileOptions;

  /**
   * An optional annotation identifier describing the operation.
   *
   * @since 3.16.0
   */
  annotationId?: ChangeAnnotationIdentifier;
};

/**
 * A workspace edit represents changes to many resources managed in the workspace. The edit should
 * either provide `changes` or `documentChanges`. If the client can handle versioned document edits
 * and if `documentChanges` are present, the latter are preferred over `changes`.
 *
 * Since version 3.13.0 a workspace edit can contain resource operations (create, delete or rename
 * files and folders) as well. If resource operations are present clients need to execute the
 * operations in the order in which they are provided. So a workspace edit for example can consist
 * of the following two changes: (1) create file a.txt and (2) a text document edit which insert
 * text into file a.txt. An invalid sequence (e.g. (1) delete file a.txt and (2) insert text into
 * file a.txt) will cause failure of the operation. How the client recovers from the failure is
 * described by the client capability: `workspace.workspaceEdit.failureHandling`
 */
export type WorkspaceEdit = {
  /**
   * Holds changes to existing resources.
   */
  changes?: { [uri: DocumentUri]: TextEdit[] };

  /**
   * Depending on the client capability
   * `workspace.workspaceEdit.resourceOperations` document changes are either
   * an array of `TextDocumentEdit`s to express changes to n different text
   * documents where each text document edit addresses a specific version of
   * a text document. Or it can contain above `TextDocumentEdit`s mixed with
   * create, rename and delete file / folder operations.
   *
   * Whether a client supports versioned document edits is expressed via
   * `workspace.workspaceEdit.documentChanges` client capability.
   *
   * If a client neither supports `documentChanges` nor
   * `workspace.workspaceEdit.resourceOperations` then only plain `TextEdit`s
   * using the `changes` property are supported.
   */
  documentChanges?:
    | readonly TextDocumentEdit[]
    | readonly (TextDocumentEdit | CreateFile | RenameFile | DeleteFile)[];

  /**
   * A map of change annotations that can be referenced in
   * `AnnotatedTextEdit`s or create, rename and delete file / folder
   * operations.
   *
   * Whether clients honor this property depends on the client capability
   * `workspace.changeAnnotationSupport`.
   *
   * @since 3.16.0
   */
  changeAnnotations?: { [id: ChangeAnnotationIdentifier]: ChangeAnnotation };
};

/**
 * The capabilities of a workspace edit has evolved over the time. Clients can describe their
 * support using the following client capability:
 *
 * _Client Capability_:
 *
 * - property path (optional): `workspace.workspaceEdit`
 * - property type: {@link WorkspaceEditClientCapabilities} defined as follows.
 */
export type WorkspaceEditClientCapabilities = {
  /**
   * The client supports versioned document changes in `WorkspaceEdit`s
   */
  documentChanges?: boolean;

  /**
   * The resource operations the client supports. Clients should at least
   * support 'create', 'rename' and 'delete' files and folders.
   *
   * @since 3.13.0
   */
  resourceOperations?: readonly ResourceOperationKind[];

  /**
   * The failure handling strategy of a client if applying the workspace edit
   * fails.
   *
   * @since 3.13.0
   */
  failureHandling?: FailureHandlingKind;

  /**
   * Whether the client normalizes line endings to the client specific
   * setting.
   * If set to `true` the client will normalize line ending characters
   * in a workspace edit to the client specific new line character(s).
   *
   * @since 3.16.0
   */
  normalizesLineEndings?: boolean;

  /**
   * Whether the client in general supports change annotations on text edits,
   * create file, rename file and delete file changes.
   *
   * @since 3.16.0
   */
  changeAnnotationSupport?: {
    /**
     * Whether the client groups edits with equal labels into tree nodes,
     * for instance all edits labelled with "Changes in Strings" would
     * be a tree node.
     */
    groupsOnLabel?: boolean;
  };
};

/**
 * The kind of resource operations supported by the client.
 */
export type ResourceOperationKind =
  (typeof ResourceOperationKind)[keyof typeof ResourceOperationKind];
/**
 * The kind of resource operations supported by the client.
 */

export namespace ResourceOperationKind {
  /**
   * Supports creating new files and folders.
   */
  export const Create = "create";

  /**
   * Supports renaming existing files and folders.
   */
  export const Rename = "rename";

  /**
   * Supports deleting existing files and folders.
   */
  export const DeleteFileOptions = "delete";
}

/**
 * The failure handling strategy of a client if applying the workspace edit.
 */
export type FailureHandlingKind = (typeof FailureHandlingKind)[keyof typeof FailureHandlingKind];
/**
 * The failure handling strategy of a client if applying the workspace edit.
 */

export namespace FailureHandlingKind {
  /**
   * Applying the workspace change is simply aborted if one of the changes
   * provided fails. All operations executed before the failing operation
   * stay executed.
   */
  export const Abort = "abort";

  /**
   * All operations are executed transactional. That means they either all
   * succeed or no changes at all are applied to the workspace.
   */
  export const Transactional = "transactional";

  /**
   * If the workspace edit contains only textual file changes they are
   * executed transactional. If resource changes (create, rename or delete
   * file) are part of the change the failure handling strategy is abort.
   */
  export const TextOnlyTransactional = "textOnlyTransactional";

  /**
   * The client tries to undo the operations already executed. But there is no
   * guarantee that this is succeeding.
   */
  export const Undo = "undo";
}

/**
 * The payload to be sent in a `$/progress` notification.
 */
export type WorkDoneProgressPayload =
  | WorkDoneProgressBegin
  | WorkDoneProgressReport
  | WorkDoneProgressEnd;

/**
 * The payload to be sent in a `$/progress` notification to start progress reporting.
 */
export type WorkDoneProgressBegin = {
  kind: "begin";

  /**
   * Mandatory title of the progress operation. Used to briefly inform about
   * the kind of operation being performed.
   *
   * Examples: "Indexing" or "Linking dependencies".
   */
  title: string;

  /**
   * Controls if a cancel button should show to allow the user to cancel the
   * long running operation. Clients that don't support cancellation are
   * allowed to ignore the setting.
   */
  cancellable?: boolean;

  /**
   * Optional, more detailed associated progress message. Contains
   * complementary information to the `title`.
   *
   * Examples: "3/25 files", "project/src/module2", "node_modules/some_dep".
   * If unset, the previous progress message (if any) is still valid.
   */
  message?: string;

  /**
   * Optional progress percentage to display (value 100 is considered 100%).
   * If not provided infinite progress is assumed and clients are allowed
   * to ignore the `percentage` value in subsequent in report notifications.
   *
   * The value should be steadily rising. Clients are free to ignore values
   * that are not following this rule. The value range is [0, 100]
   */
  percentage?: uinteger;
};

/**
 * The payload to be sent in a `$/progress` notification to report progress is done.
 */
export type WorkDoneProgressReport = {
  kind: "report";

  /**
   * Controls enablement state of a cancel button. This property is only valid
   * if a cancel button got requested in the `WorkDoneProgressBegin` payload.
   *
   * Clients that don't support cancellation or don't support control the
   * button's enablement state are allowed to ignore the setting.
   */
  cancellable?: boolean;

  /**
   * Optional, more detailed associated progress message. Contains
   * complementary information to the `title`.
   *
   * Examples: "3/25 files", "project/src/module2", "node_modules/some_dep".
   * If unset, the previous progress message (if any) is still valid.
   */
  message?: string;

  /**
   * Optional progress percentage to display (value 100 is considered 100%).
   * If not provided infinite progress is assumed and clients are allowed
   * to ignore the `percentage` value in subsequent in report notifications.
   *
   * The value should be steadily rising. Clients are free to ignore values
   * that are not following this rule. The value range is [0, 100]
   */
  percentage?: uinteger;
};

/**
 * The payload to be sent in a `$/progress` notification to signal the end of a progress.
 */
export type WorkDoneProgressEnd = {
  kind: "end";

  /**
   * Optional, a final message indicating to for example indicate the outcome
   * of the operation.
   */
  message?: string;
};

/**
 * Work done progress params for the client.
 */
export type WorkDoneProgressParams = {
  /**
   * An optional token that a server can use to report work done progress.
   */
  workDoneToken?: ProgressToken;
};

/**
 * Work done progress options.
 */
export type WorkDoneProgressOptions = {
  workDoneProgress?: boolean;
};

/**
 * A parameter literal used to pass a partial result token.
 */
export type PartialResultParams = {
  /**
   * An optional token that a server can use to report partial results (e.g.
   * streaming) to the client.
   */
  partialResultToken?: ProgressToken;
};

/**
 * A TraceValue represents the level of verbosity with which the server systematically reports its
 * execution trace using `$/logTrace` notifications. The initial trace value is set by the client at
 * initialization and can be modified later using the `$/setTrace` notification.
 */
export type TraceValue = "off" | "messages" | "verbose";

/**********************
 * Lifecycle Messages *
 **********************/
/**
 * Params to be sent with an `initialize` request, which is sent as the first request from the
 * client to the server.
 */
export interface InitializeParams extends WorkDoneProgressParams {
  /**
   * The process Id of the parent process that started the server. Is null if
   * the process has not been started by another process. If the parent
   * process is not alive then the server should exit (see exit notification)
   * its process.
   */
  processId: integer | null;

  /**
   * Information about the client
   *
   * @since 3.15.0
   */
  clientInfo?: {
    /**
     * The name of the client as defined by the client.
     */
    name: string;

    /**
     * The client's version as defined by the client.
     */
    version?: string;
  };

  /**
   * The locale the client is currently showing the user interface
   * in. This must not necessarily be the locale of the operating
   * system.
   *
   * Uses IETF language tags as the value's syntax
   * (See https://en.wikipedia.org/wiki/IETF_language_tag)
   *
   * @since 3.16.0
   */
  locale?: string;

  /**
   * The rootPath of the workspace. Is null
   * if no folder is open.
   *
   * @deprecated in favour of `rootUri`.
   */
  rootPath?: string | null;

  /**
   * The rootUri of the workspace. Is null if no
   * folder is open. If both `rootPath` and `rootUri` are set
   * `rootUri` wins.
   *
   * @deprecated in favour of `workspaceFolders`
   */
  rootUri: DocumentUri | null;

  /**
   * User provided initialization options.
   */
  initializationOptions?: LSPAny;

  /**
   * The capabilities provided by the client (editor or tool)
   */
  capabilities: ClientCapabilities;

  /**
   * The initial trace setting. If omitted trace is disabled ('off').
   */
  trace?: TraceValue;

  /**
   * The workspace folders configured in the client when the server starts.
   * This property is only available if the client supports workspace folders.
   * It can be `null` if the client supports workspace folders but none are
   * configured.
   *
   * @since 3.6.0
   */
  workspaceFolders?: readonly WorkspaceFolder[] | null;
}

/**
 * Text document specific client capabilities.
 */
export type TextDocumentClientCapabilities = {
  synchronization?: TextDocumentSyncClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/completion` request.
   */
  completion?: CompletionClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/hover` request.
   */
  hover?: HoverClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/signatureHelp` request.
   */
  signatureHelp?: SignatureHelpClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/declaration` request.
   *
   * @since 3.14.0
   */
  declaration?: DeclarationClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/definition` request.
   */
  definition?: DefinitionClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/typeDefinition` request.
   *
   * @since 3.6.0
   */
  typeDefinition?: TypeDefinitionClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/implementation` request.
   *
   * @since 3.6.0
   */
  implementation?: ImplementationClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/references` request.
   */
  references?: ReferenceClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/documentHighlight` request.
   */
  documentHighlight?: DocumentHighlightClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/documentSymbol` request.
   */
  documentSymbol?: DocumentSymbolClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/codeAction` request.
   */
  codeAction?: CodeActionClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/codeLens` request.
   */
  codeLens?: CodeLensClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/documentLink` request.
   */
  documentLink?: DocumentLinkClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/documentColor` and the
   * `textDocument/colorPresentation` request.
   *
   * @since 3.6.0
   */
  colorProvider?: DocumentColorClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/formatting` request.
   */
  formatting?: DocumentFormattingClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/rangeFormatting` request.
   */
  rangeFormatting?: DocumentRangeFormattingClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/onTypeFormatting` request.
   */
  onTypeFormatting?: DocumentOnTypeFormattingClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/rename` request.
   */
  rename?: RenameClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/publishDiagnostics`
   * notification.
   */
  publishDiagnostics?: PublishDiagnosticsClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/foldingRange` request.
   *
   * @since 3.10.0
   */
  foldingRange?: FoldingRangeClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/selectionRange` request.
   *
   * @since 3.15.0
   */
  selectionRange?: SelectionRangeClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/linkedEditingRange` request.
   *
   * @since 3.16.0
   */
  linkedEditingRange?: LinkedEditingRangeClientCapabilities;

  /**
   * Capabilities specific to the various call hierarchy requests.
   *
   * @since 3.16.0
   */
  callHierarchy?: CallHierarchyClientCapabilities;

  /**
   * Capabilities specific to the various semantic token requests.
   *
   * @since 3.16.0
   */
  semanticTokens?: SemanticTokensClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/moniker` request.
   *
   * @since 3.16.0
   */
  moniker?: MonikerClientCapabilities;

  /**
   * Capabilities specific to the various type hierarchy requests.
   *
   * @since 3.17.0
   */
  typeHierarchy?: TypeHierarchyClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/inlineValue` request.
   *
   * @since 3.17.0
   */
  inlineValue?: InlineValueClientCapabilities;

  /**
   * Capabilities specific to the `textDocument/inlayHint` request.
   *
   * @since 3.17.0
   */
  inlayHint?: InlayHintClientCapabilities;

  /**
   * Capabilities specific to the diagnostic pull model.
   *
   * @since 3.17.0
   */
  diagnostic?: DiagnosticClientCapabilities;
};

/**
 * Capabilities specific to the notebook document support.
 *
 * @since 3.17.0
 */
export type NotebookDocumentClientCapabilities = {
  /**
   * Capabilities specific to notebook document synchronization
   *
   * @since 3.17.0
   */
  synchronization: NotebookDocumentSyncClientCapabilities;
};

type ClientCapabilities = {
  /**
   * Workspace specific client capabilities.
   */
  workspace?: {
    /**
     * The client supports applying batch edits
     * to the workspace by supporting the request
     * 'workspace/applyEdit'
     */
    applyEdit?: boolean;

    /**
     * Capabilities specific to `WorkspaceEdit`s
     */
    workspaceEdit?: WorkspaceEditClientCapabilities;

    /**
     * Capabilities specific to the `workspace/didChangeConfiguration`
     * notification.
     */
    didChangeConfiguration?: DidChangeConfigurationClientCapabilities;

    /**
     * Capabilities specific to the `workspace/didChangeWatchedFiles`
     * notification.
     */
    didChangeWatchedFiles?: DidChangeWatchedFilesClientCapabilities;

    /**
     * Capabilities specific to the `workspace/symbol` request.
     */
    symbol?: WorkspaceSymbolClientCapabilities;

    /**
     * Capabilities specific to the `workspace/executeCommand` request.
     */
    executeCommand?: ExecuteCommandClientCapabilities;

    /**
     * The client has support for workspace folders.
     *
     * @since 3.6.0
     */
    workspaceFolders?: boolean;

    /**
     * The client supports `workspace/configuration` requests.
     *
     * @since 3.6.0
     */
    configuration?: boolean;

    /**
     * Capabilities specific to the semantic token requests scoped to the
     * workspace.
     *
     * @since 3.16.0
     */
    semanticTokens?: SemanticTokensWorkspaceClientCapabilities;

    /**
     * Capabilities specific to the code lens requests scoped to the
     * workspace.
     *
     * @since 3.16.0
     */
    codeLens?: CodeLensWorkspaceClientCapabilities;

    /**
     * The client has support for file requests/notifications.
     *
     * @since 3.16.0
     */
    fileOperations?: {
      /**
       * Whether the client supports dynamic registration for file
       * requests/notifications.
       */
      dynamicRegistration?: boolean;

      /**
       * The client has support for sending didCreateFiles notifications.
       */
      didCreate?: boolean;

      /**
       * The client has support for sending willCreateFiles requests.
       */
      willCreate?: boolean;

      /**
       * The client has support for sending didRenameFiles notifications.
       */
      didRename?: boolean;

      /**
       * The client has support for sending willRenameFiles requests.
       */
      willRename?: boolean;

      /**
       * The client has support for sending didDeleteFiles notifications.
       */
      didDelete?: boolean;

      /**
       * The client has support for sending willDeleteFiles requests.
       */
      willDelete?: boolean;
    };

    /**
     * Client workspace capabilities specific to inline values.
     *
     * @since 3.17.0
     */
    inlineValue?: InlineValueWorkspaceClientCapabilities;

    /**
     * Client workspace capabilities specific to inlay hints.
     *
     * @since 3.17.0
     */
    inlayHint?: InlayHintWorkspaceClientCapabilities;

    /**
     * Client workspace capabilities specific to diagnostics.
     *
     * @since 3.17.0.
     */
    diagnostics?: DiagnosticWorkspaceClientCapabilities;
  };

  /**
   * Text document specific client capabilities.
   */
  textDocument?: TextDocumentClientCapabilities;

  /**
   * Capabilities specific to the notebook document support.
   *
   * @since 3.17.0
   */
  notebookDocument?: NotebookDocumentClientCapabilities;

  /**
   * Window specific client capabilities.
   */
  window?: {
    /**
     * It indicates whether the client supports server initiated
     * progress using the `window/workDoneProgress/create` request.
     *
     * The capability also controls Whether client supports handling
     * of progress notifications. If set servers are allowed to report a
     * `workDoneProgress` property in the request specific server
     * capabilities.
     *
     * @since 3.15.0
     */
    workDoneProgress?: boolean;

    /**
     * Capabilities specific to the showMessage request
     *
     * @since 3.16.0
     */
    showMessage?: ShowMessageRequestClientCapabilities;

    /**
     * Client capabilities for the show document request.
     *
     * @since 3.16.0
     */
    showDocument?: ShowDocumentClientCapabilities;
  };

  /**
   * General client capabilities.
   *
   * @since 3.16.0
   */
  general?: {
    /**
     * Client capability that signals how the client
     * handles stale requests (e.g. a request
     * for which the client will not process the response
     * anymore since the information is outdated).
     *
     * @since 3.17.0
     */
    staleRequestSupport?: {
      /**
       * The client will actively cancel the request.
       */
      cancel: boolean;

      /**
       * The list of requests for which the client
       * will retry the request if it receives a
       * response with error code `ContentModified``
       */
      retryOnContentModified: string[];
    };

    /**
     * Client capabilities specific to regular expressions.
     *
     * @since 3.16.0
     */
    regularExpressions?: RegularExpressionsClientCapabilities;

    /**
     * Client capabilities specific to the client's markdown parser.
     *
     * @since 3.16.0
     */
    markdown?: MarkdownClientCapabilities;

    /**
     * The position encodings supported by the client. Client and server
     * have to agree on the same position encoding to ensure that offsets
     * (e.g. character position in a line) are interpreted the same on both
     * side.
     *
     * To keep the protocol backwards compatible the following applies: if
     * the value 'utf-16' is missing from the array of position encodings
     * servers can assume that the client supports UTF-16. UTF-16 is
     * therefore a mandatory encoding.
     *
     * If omitted it defaults to ['utf-16'].
     *
     * Implementation considerations: since the conversion from one encoding
     * into another requires the content of the file / line the conversion
     * is best done where the file is read which is usually on the server
     * side.
     *
     * @since 3.17.0
     */
    positionEncodings?: PositionEncodingKind[];
  };

  /**
   * Experimental client capabilities.
   */
  experimental?: LSPAny;
};

/**
 * Result of the `initialize` request.
 */
export type InitializeResult = {
  /**
   * The capabilities the language server provides.
   */
  capabilities: ServerCapabilities;

  /**
   * Information about the server.
   *
   * @since 3.15.0
   */
  serverInfo?: {
    /**
     * The name of the server as defined by the server.
     */
    name: string;

    /**
     * The server's version as defined by the server.
     */
    version?: string;
  };
};

/**
 * Known error codes for an `InitializeErrorCodes`.
 */
export type InitializeErrorCodes = (typeof InitializeErrorCodes)[keyof typeof InitializeErrorCodes];
/**
 * Known error codes for an `InitializeErrorCodes`.
 */

export namespace InitializeErrorCodes {
  /**
   * If the protocol version provided by the client can't be handled by
   * the server.
   *
   * @deprecated This initialize error got replaced by client capabilities.
   * There is no version handshake in version 3.0x
   */
  export const unknownProtocolVersion = 1;
}

/**
 * Error returned if the `initialize` request failed.
 */
export type InitializeError = {
  /**
   * Indicates whether the client execute the following retry logic:
   * (1) show the message provided by the ResponseError to the user
   * (2) user selects retry or cancel
   * (3) if user selected retry the initialize method is sent again.
   */
  retry: boolean;
};

/**
 * Server capabilities.
 */
type ServerCapabilities = {
  /**
   * The position encoding the server picked from the encodings offered
   * by the client via the client capability `general.positionEncodings`.
   *
   * If the client didn't provide any position encodings the only valid
   * value that a server can return is 'utf-16'.
   *
   * If omitted it defaults to 'utf-16'.
   *
   * @since 3.17.0
   */
  positionEncoding?: PositionEncodingKind;

  /**
   * Defines how text documents are synced. Is either a detailed structure
   * defining each notification or for backwards compatibility the
   * TextDocumentSyncKind number. If omitted it defaults to
   * `TextDocumentSyncKind.None`.
   */
  textDocumentSync?: TextDocumentSyncOptions | TextDocumentSyncKind;

  /**
   * Defines how notebook documents are synced.
   *
   * @since 3.17.0
   */
  notebookDocumentSync?: NotebookDocumentSyncOptions | NotebookDocumentSyncRegistrationOptions;

  /**
   * The server provides completion support.
   */
  completionProvider?: CompletionOptions;

  /**
   * The server provides hover support.
   */
  hoverProvider?: boolean | HoverOptions;

  /**
   * The server provides signature help support.
   */
  signatureHelpProvider?: SignatureHelpOptions;

  /**
   * The server provides go to declaration support.
   *
   * @since 3.14.0
   */
  declarationProvider?: boolean | DeclarationOptions | DeclarationRegistrationOptions;

  /**
   * The server provides goto definition support.
   */
  definitionProvider?: boolean | DefinitionOptions;

  /**
   * The server provides goto type definition support.
   *
   * @since 3.6.0
   */
  typeDefinitionProvider?: boolean | TypeDefinitionOptions | TypeDefinitionRegistrationOptions;

  /**
   * The server provides goto implementation support.
   *
   * @since 3.6.0
   */
  implementationProvider?: boolean | ImplementationOptions | ImplementationRegistrationOptions;

  /**
   * The server provides find references support.
   */
  referencesProvider?: boolean | ReferenceOptions;

  /**
   * The server provides document highlight support.
   */
  documentHighlightProvider?: boolean | DocumentHighlightOptions;

  /**
   * The server provides document symbol support.
   */
  documentSymbolProvider?: boolean | DocumentSymbolOptions;

  /**
   * The server provides code actions. The `CodeActionOptions` return type is
   * only valid if the client signals code action literal support via the
   * property `textDocument.codeAction.codeActionLiteralSupport`.
   */
  codeActionProvider?: boolean | CodeActionOptions;

  /**
   * The server provides code lens.
   */
  codeLensProvider?: CodeLensOptions;

  /**
   * The server provides document link support.
   */
  documentLinkProvider?: DocumentLinkOptions;

  /**
   * The server provides color provider support.
   *
   * @since 3.6.0
   */
  colorProvider?: boolean | DocumentColorOptions | DocumentColorRegistrationOptions;

  /**
   * The server provides document formatting.
   */
  documentFormattingProvider?: boolean | DocumentFormattingOptions;

  /**
   * The server provides document range formatting.
   */
  documentRangeFormattingProvider?: boolean | DocumentRangeFormattingOptions;

  /**
   * The server provides document formatting on typing.
   */
  documentOnTypeFormattingProvider?: DocumentOnTypeFormattingOptions;

  /**
   * The server provides rename support. RenameOptions may only be
   * specified if the client states that it supports
   * `prepareSupport` in its initial `initialize` request.
   */
  renameProvider?: boolean | RenameOptions;

  /**
   * The server provides folding provider support.
   *
   * @since 3.10.0
   */
  foldingRangeProvider?: boolean | FoldingRangeOptions | FoldingRangeRegistrationOptions;

  /**
   * The server provides execute command support.
   */
  executeCommandProvider?: ExecuteCommandOptions;

  /**
   * The server provides selection range support.
   *
   * @since 3.15.0
   */
  selectionRangeProvider?: boolean | SelectionRangeOptions | SelectionRangeRegistrationOptions;

  /**
   * The server provides linked editing range support.
   *
   * @since 3.16.0
   */
  linkedEditingRangeProvider?:
    | boolean
    | LinkedEditingRangeOptions
    | LinkedEditingRangeRegistrationOptions;

  /**
   * The server provides call hierarchy support.
   *
   * @since 3.16.0
   */
  callHierarchyProvider?: boolean | CallHierarchyOptions | CallHierarchyRegistrationOptions;

  /**
   * The server provides semantic tokens support.
   *
   * @since 3.16.0
   */
  semanticTokensProvider?: SemanticTokensOptions | SemanticTokensRegistrationOptions;

  /**
   * Whether server provides moniker support.
   *
   * @since 3.16.0
   */
  monikerProvider?: boolean | MonikerOptions | MonikerRegistrationOptions;

  /**
   * The server provides type hierarchy support.
   *
   * @since 3.17.0
   */
  typeHierarchyProvider?: boolean | TypeHierarchyOptions | TypeHierarchyRegistrationOptions;

  /**
   * The server provides inline values.
   *
   * @since 3.17.0
   */
  inlineValueProvider?: boolean | InlineValueOptions | InlineValueRegistrationOptions;

  /**
   * The server provides inlay hints.
   *
   * @since 3.17.0
   */
  inlayHintProvider?: boolean | InlayHintOptions | InlayHintRegistrationOptions;

  /**
   * The server has support for pull model diagnostics.
   *
   * @since 3.17.0
   */
  diagnosticProvider?: DiagnosticOptions | DiagnosticRegistrationOptions;

  /**
   * The server provides workspace symbol support.
   */
  workspaceSymbolProvider?: boolean | WorkspaceSymbolOptions;

  /**
   * Workspace specific server capabilities
   */
  workspace?: {
    /**
     * The server supports workspace folder.
     *
     * @since 3.6.0
     */
    workspaceFolders?: WorkspaceFoldersServerCapabilities;

    /**
     * The server is interested in file notifications/requests.
     *
     * @since 3.16.0
     */
    fileOperations?: {
      /**
       * The server is interested in receiving didCreateFiles
       * notifications.
       */
      didCreate?: FileOperationRegistrationOptions;

      /**
       * The server is interested in receiving willCreateFiles requests.
       */
      willCreate?: FileOperationRegistrationOptions;

      /**
       * The server is interested in receiving didRenameFiles
       * notifications.
       */
      didRename?: FileOperationRegistrationOptions;

      /**
       * The server is interested in receiving willRenameFiles requests.
       */
      willRename?: FileOperationRegistrationOptions;

      /**
       * The server is interested in receiving didDeleteFiles file
       * notifications.
       */
      didDelete?: FileOperationRegistrationOptions;

      /**
       * The server is interested in receiving willDeleteFiles file
       * requests.
       */
      willDelete?: FileOperationRegistrationOptions;
    };
  };

  /**
   * Experimental server capabilities.
   */
  experimental?: LSPAny;
};

/**
 * Params of the `initialized` notification.
 */
export interface InitializedParams {}

/**
 * General parameters to register for a capability.
 */
export type Registration = {
  /**
   * The id used to register the request. The id can be used to deregister
   * the request again.
   */
  id: string;

  /**
   * The method / capability to register for.
   */
  method: string;

  /**
   * Options necessary for the registration.
   */
  registerOptions?: LSPAny;
};

/**
 * Params of the `client/registerCapability` request.
 */
export type RegistrationParams = {
  registrations: readonly Registration[];
};

/**
 * Static registration options to be returned in the initialize request.
 */
export type StaticRegistrationOptions = {
  /**
   * The id used to register the request. The id can be used to deregister
   * the request again. See also Registration#id.
   */
  id?: string;
};

/**
 * General text document registration options.
 */
export type TextDocumentRegistrationOptions = {
  /**
   * A document selector to identify the scope of the registration. If set to
   * null the document selector provided on the client side will be used.
   */
  documentSelector: DocumentSelector | null;
};

/**
 * General parameters to unregister a capability.
 */
export type Unregistration = {
  /**
   * The id used to unregister the request or notification. Usually an id
   * provided during the register request.
   */
  id: string;

  /**
   * The method / capability to unregister for.
   */
  method: string;
};

/**
 * Params of the `client/unregisterCapability` request.
 */
export type UnregistrationParams = {
  // This should correctly be named `unregistrations`. However changing this
  // is a breaking change and needs to wait until we deliver a 4.x version
  // of the specification.
  unregisterations: readonly Unregistration[];
};

/**
 * Params of the `$/setTrace` request.
 */
export type SetTraceParams = {
  /**
   * The new value that should be assigned to the trace setting.
   */
  value: TraceValue;
};

/**
 * Params of the `$/logTrace` request.
 */
export type LogTraceParams = {
  /**
   * The message to be logged.
   */
  message: string;
  /**
   * Additional information that can be computed if the `trace` configuration
   * is set to `'verbose'`
   */
  verbose?: string;
};

/*********************************
 * Text Document Synchronization *
 *********************************/
/**
 * Defines how the host (editor) should sync document changes to the language server.
 */
export type TextDocumentSyncKind = (typeof TextDocumentSyncKind)[keyof typeof TextDocumentSyncKind];
/**
 * Defines how the host (editor) should sync document changes to the language server.
 */

export namespace TextDocumentSyncKind {
  /**
   * Documents should not be synced at all.
   */
  export const None = 0;

  /**
   * Documents are synced by always sending the full content
   * of the document.
   */
  export const Full = 1;

  /**
   * Documents are synced by sending the full content on open.
   * After that only incremental updates to the document are
   * sent.
   */
  export const Incremental = 2;
}

/**
 * Text document sync options.
 */
export type TextDocumentSyncOptions = {
  /**
   * Open and close notifications are sent to the server. If omitted open
   * close notification should not be sent.
   */
  openClose?: boolean;

  /**
   * Change notifications are sent to the server. See
   * TextDocumentSyncKind.None, TextDocumentSyncKind.Full and
   * TextDocumentSyncKind.Incremental. If omitted it defaults to
   * TextDocumentSyncKind.None.
   */
  change?: TextDocumentSyncKind;

  /**
   * If present will save notifications are sent to the server. If omitted
   * the notification should not be sent.
   */
  willSave?: boolean;

  /**
   * If present will save wait until requests are sent to the server. If
   * omitted the request should not be sent.
   */
  willSaveWaitUntil?: boolean;

  /**
   * If present save notifications are sent to the server. If omitted the
   * notification should not be sent.
   */
  save?: boolean | SaveOptions;
};

/**
 * Params of the `textDocument/didOpen` notification.
 */
export type DidOpenTextDocumentParams = {
  /**
   * The document that was opened.
   */
  textDocument: TextDocumentItem;
};

/**
 * Describe options to be used when registering for text document change events.
 */
export interface TextDocumentChangeRegistrationOptions extends TextDocumentRegistrationOptions {
  /**
   * How documents are synced to the server. See TextDocumentSyncKind.Full
   * and TextDocumentSyncKind.Incremental.
   */
  syncKind: TextDocumentSyncKind;
}

/**
 * Params of the `textDocument/didChange` notification.
 */
export type DidChangeTextDocumentParams = {
  /**
   * The document that did change. The version number points
   * to the version after all provided content changes have
   * been applied.
   */
  textDocument: VersionedTextDocumentIdentifier;

  /**
   * The actual content changes. The content changes describe single state
   * changes to the document. So if there are two content changes c1 (at
   * array index 0) and c2 (at array index 1) for a document in state S then
   * c1 moves the document from S to S' and c2 from S' to S''. So c1 is
   * computed on the state S and c2 is computed on the state S'.
   *
   * To mirror the content of a document using change events use the following approach:
   *
   * - start with the same initial content
   * - apply the 'textDocument/didChange' notifications in the order you
   *   receive them.
   * - apply the `TextDocumentContentChangeEvent`s in a single notification
   *   in the order you receive them.
   */
  contentChanges: readonly TextDocumentContentChangeEvent[];
};

/**
 * An event describing a change to a text document. If only a text is provided
 * it is considered to be the full content of the document.
 */
export type TextDocumentContentChangeEvent =
  | {
      /**
       * The range of the document that changed.
       */
      range: Range;

      /**
       * The optional length of the range that got replaced.
       *
       * @deprecated use range instead.
       */
      rangeLength?: uinteger;

      /**
       * The new text for the provided range.
       */
      text: string;
    }
  | {
      /**
       * The new text of the whole document.
       */
      text: string;
    };

/**
 * Params of the `textDocument/willSave` notification and the `textDocument/willSaveWaitUntil`
 * request.
 */
export type WillSaveTextDocumentParams = {
  /**
   * The document that will be saved.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The 'TextDocumentSaveReason'.
   */
  reason: TextDocumentSaveReason;
};

/**
 * Represents reasons why a text document is saved.
 */
export type TextDocumentSaveReason =
  (typeof TextDocumentSaveReason)[keyof typeof TextDocumentSaveReason];
/**
 * Represents reasons why a text document is saved.
 */

export namespace TextDocumentSaveReason {
  /**
   * Manually triggered, e.g. by the user pressing save, by starting debugging, or by an API call.
   */
  export const Manual = 1;

  /**
   * Automatic after a delay.
   */
  export const AfterDelay = 2;

  /**
   * When the editor lost focus.
   */
  export const FocusOut = 3;
}

/**
 * Save options.
 */
export type SaveOptions = {
  /**
   * The client is supposed to include the content on save.
   */
  includeText?: boolean;
};

/**
 * Text document save registration options.
 */
export interface TextDocumentSaveRegistrationOptions extends TextDocumentRegistrationOptions {
  /**
   * The client is supposed to include the content on save.
   */
  includeText?: boolean;
}

/**
 * Params of the `document/didSave` notification.
 */
export type DidSaveTextDocumentParams = {
  /**
   * The document that was saved.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * Optional the content when saved. Depends on the includeText value
   * when the save notification was requested.
   */
  text?: string;
};

/**
 * Params of the `document/didClose` notification.
 */
export type DidCloseTextDocumentParams = {
  /**
   * The document that was closed.
   */
  textDocument: TextDocumentIdentifier;
};

export type TextDocumentSyncClientCapabilities = {
  /**
   * Whether text document synchronization supports dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * The client supports sending will save notifications.
   */
  willSave?: boolean;

  /**
   * The client supports sending a will save request and
   * waits for a response providing text edits which will
   * be applied to the document before it is saved.
   */
  willSaveWaitUntil?: boolean;

  /**
   * The client supports did save notifications.
   */
  didSave?: boolean;
};

/**
 * A notebook document.
 *
 * @since 3.17.0
 */
export type NotebookDocument = {
  /**
   * The notebook document's URI.
   */
  uri: URI;

  /**
   * The type of the notebook.
   */
  notebookType: string;

  /**
   * The version number of this document (it will increase after each
   * change, including undo/redo).
   */
  version: integer;

  /**
   * Additional metadata stored with the notebook
   * document.
   */
  metadata?: LSPObject;

  /**
   * The cells of a notebook.
   */
  cells: readonly NotebookCell[];
};

/**
 * A notebook cell.
 *
 * A cell's document URI must be unique across ALL notebook
 * cells and can therefore be used to uniquely identify a
 * notebook cell or the cell's text document.
 *
 * @since 3.17.0
 */
export type NotebookCell = {
  /**
   * The cell's kind
   */
  kind: NotebookCellKind;

  /**
   * The URI of the cell's text document
   * content.
   */
  document: DocumentUri;

  /**
   * Additional metadata stored with the cell.
   */
  metadata?: LSPObject;

  /**
   * Additional execution summary information
   * if supported by the client.
   */
  executionSummary?: ExecutionSummary;
};

/**
 * A notebook cell kind.
 *
 * @since 3.17.0
 */
export type NotebookCellKind = (typeof NotebookCellKind)[keyof typeof NotebookCellKind];
/**
 * A notebook cell kind.
 *
 * @since 3.17.0
 */

export namespace NotebookCellKind {
  /**
   * A markup-cell is formatted source that is used for display.
   */
  export const Markup = 1;

  /**
   * A code-cell is source code.
   */
  export const Code = 2;
}

/**
 * Notebook execution summary.
 */
export type ExecutionSummary = {
  /**
   * A strict monotonically increasing value
   * indicating the execution order of a cell
   * inside a notebook.
   */
  executionOrder: uinteger;

  /**
   * Whether the execution was successful or
   * not if known by the client.
   */
  success?: boolean;
};

/**
 * A notebook cell text document filter denotes a cell text
 * document by different properties.
 *
 * @since 3.17.0
 */
export type NotebookCellTextDocumentFilter = {
  /**
   * A filter that matches against the notebook
   * containing the notebook cell. If a string
   * value is provided it matches against the
   * notebook type. '*' matches every notebook.
   */
  notebook: string | NotebookDocumentFilter;

  /**
   * A language id like `python`.
   *
   * Will be matched against the language id of the
   * notebook cell document. '*' matches every language.
   */
  language?: string;
};

/**
 * A notebook document filter denotes a notebook document by
 * different properties.
 *
 * @since 3.17.0
 */
export type NotebookDocumentFilter =
  | {
      /** The type of the enclosing notebook. */
      notebookType: string;

      /** A Uri [scheme](#Uri.scheme), like `file` or `untitled`. */
      scheme?: string;

      /** A glob pattern. */
      pattern?: string;
    }
  | {
      /** The type of the enclosing notebook. */
      notebookType?: string;

      /** A Uri [scheme](#Uri.scheme), like `file` or `untitled`.*/
      scheme: string;

      /** A glob pattern. */
      pattern?: string;
    }
  | {
      /** The type of the enclosing notebook. */
      notebookType?: string;

      /** A Uri [scheme](#Uri.scheme), like `file` or `untitled`. */
      scheme?: string;

      /** A glob pattern. */
      pattern: string;
    };

/**
 * Notebook specific client capabilities.
 *
 * @since 3.17.0
 */
export type NotebookDocumentSyncClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration. If this is
   * set to `true` the client supports the new
   * `(NotebookDocumentSyncRegistrationOptions & NotebookDocumentSyncOptions)`
   * return value for the corresponding server capability as well.
   */
  dynamicRegistration?: boolean;

  /**
   * The client supports sending execution summary data per cell.
   */
  executionSummarySupport?: boolean;
};

/**
 * Options specific to a notebook plus its cells
 * to be synced to the server.
 *
 * If a selector provides a notebook document
 * filter but no cell selector all cells of a
 * matching notebook document will be synced.
 *
 * If a selector provides no notebook document
 * filter but only a cell selector all notebook
 * documents that contain at least one matching
 * cell will be synced.
 *
 * @since 3.17.0
 */
export type NotebookDocumentSyncOptions = {
  /**
   * The notebooks to be synced
   */
  notebookSelector: (
    | {
        /**
         * The notebook to be synced. If a string
         * value is provided it matches against the
         * notebook type. '*' matches every notebook.
         */
        notebook: string | NotebookDocumentFilter;

        /**
         * The cells of the matching notebook to be synced.
         */
        cells?: { language: string }[];
      }
    | {
        /**
         * The notebook to be synced. If a string
         * value is provided it matches against the
         * notebook type. '*' matches every notebook.
         */
        notebook?: string | NotebookDocumentFilter;

        /**
         * The cells of the matching notebook to be synced.
         */
        cells: { language: string }[];
      }
  )[];

  /**
   * Whether save notification should be forwarded to
   * the server. Will only be honored if mode === `notebook`.
   */
  save?: boolean;
};

/**
 * Registration options specific to a notebook.
 *
 * @since 3.17.0
 */
export interface NotebookDocumentSyncRegistrationOptions
  extends NotebookDocumentSyncOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `notebookDocument/didOpen` notification.
 *
 * @since 3.17.0
 */
export type DidOpenNotebookDocumentParams = {
  /**
   * The notebook document that got opened.
   */
  notebookDocument: NotebookDocument;

  /**
   * The text documents that represent the content
   * of a notebook cell.
   */
  cellTextDocuments: TextDocumentItem[];
};

/**
 * Params of the `notebookDocument/didChange` notification.
 *
 * @since 3.17.0
 */
export type DidChangeNotebookDocumentParams = {
  /**
   * The notebook document that did change. The version number points
   * to the version after all provided changes have been applied.
   */
  notebookDocument: VersionedNotebookDocumentIdentifier;

  /**
   * The actual changes to the notebook document.
   *
   * The change describes single state change to the notebook document.
   * So it moves a notebook document, its cells and its cell text document
   * contents from state S to S'.
   *
   * To mirror the content of a notebook using change events use the
   * following approach:
   * - start with the same initial content
   * - apply the 'notebookDocument/didChange' notifications in the order
   *   you receive them.
   */
  change: NotebookDocumentChangeEvent;
};

/**
 * A versioned notebook document identifier.
 *
 * @since 3.17.0
 */
export type VersionedNotebookDocumentIdentifier = {
  /**
   * The version number of this notebook document.
   */
  version: integer;

  /**
   * The notebook document's URI.
   */
  uri: URI;
};

/**
 * A change event for a notebook document.
 *
 * @since 3.17.0
 */
export type NotebookDocumentChangeEvent = {
  /**
   * The changed meta data if any.
   */
  metadata?: LSPObject;

  /**
   * Changes to cells
   */
  cells?: {
    /**
     * Changes to the cell structure to add or
     * remove cells.
     */
    structure?: {
      /**
       * The change to the cell array.
       */
      array: NotebookCellArrayChange;

      /**
       * Additional opened cell text documents.
       */
      didOpen?: readonly TextDocumentItem[];

      /**
       * Additional closed cell text documents.
       */
      didClose?: readonly TextDocumentIdentifier[];
    };

    /**
     * Changes to notebook cells properties like its
     * kind, execution summary or metadata.
     */
    data?: readonly NotebookCell[];

    /**
     * Changes to the text content of notebook cells.
     */
    textContent?: readonly {
      document: VersionedTextDocumentIdentifier;
      changes: readonly TextDocumentContentChangeEvent[];
    }[];
  };
};

/**
 * A change describing how to move a `NotebookCell`
 * array from state S to S'.
 *
 * @since 3.17.0
 */
export type NotebookCellArrayChange = {
  /**
   * The start offset of the cell that changed.
   */
  start: uinteger;

  /**
   * The deleted cells
   */
  deleteCount: uinteger;

  /**
   * The new cells, if any
   */
  cells?: readonly NotebookCell[];
};

/**
 * Params of the `notebookDocument/didSave` notification.
 *
 * @since 3.17.0
 */
export type DidSaveNotebookDocumentParams = {
  /**
   * The notebook document that got saved.
   */
  notebookDocument: NotebookDocumentIdentifier;
};

/**
 * Params of the `notebookDocument/didClose` notification.
 *
 * @since 3.17.0
 */
export type DidCloseNotebookDocumentParams = {
  /**
   * The notebook document that got closed.
   */
  notebookDocument: NotebookDocumentIdentifier;

  /**
   * The text documents that represent the content
   * of a notebook cell that got closed.
   */
  cellTextDocuments: TextDocumentIdentifier[];
};

/**
 * A literal to identify a notebook document in the client.
 *
 * @since 3.17.0
 */
export type NotebookDocumentIdentifier = {
  /**
   * The notebook document's URI.
   */
  uri: URI;
};

/*********************
 * Language Features *
 *********************/
export type DeclarationClientCapabilities = {
  /**
   * Whether declaration supports dynamic registration. If this is set to
   * `true` the client supports the new `DeclarationRegistrationOptions`
   * return value for the corresponding server capability as well.
   */
  dynamicRegistration?: boolean;

  /**
   * The client supports additional metadata in the form of declaration links.
   */
  linkSupport?: boolean;
};

export interface DeclarationOptions extends WorkDoneProgressOptions {}

export interface DeclarationRegistrationOptions
  extends DeclarationOptions,
    TextDocumentRegistrationOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `textDocument/declaration` request.
 */
export interface DeclarationParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams,
    PartialResultParams {}

export type DefinitionClientCapabilities = {
  /**
   * Whether definition supports dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * The client supports additional metadata in the form of definition links.
   *
   * @since 3.14.0
   */
  linkSupport?: boolean;
};

export interface DefinitionOptions extends WorkDoneProgressOptions {}

export interface DefinitionRegistrationOptions
  extends TextDocumentRegistrationOptions,
    DefinitionOptions {}

/**
 * Params of the `textDocument/definition` request.
 */
export interface DefinitionParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams,
    PartialResultParams {}

export type TypeDefinitionClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration. If this is set to
   * `true` the client supports the new `TypeDefinitionRegistrationOptions`
   * return value for the corresponding server capability as well.
   */
  dynamicRegistration?: boolean;

  /**
   * The client supports additional metadata in the form of definition links.
   *
   * @since 3.14.0
   */
  linkSupport?: boolean;
};

export interface TypeDefinitionOptions extends WorkDoneProgressOptions {}

export interface TypeDefinitionRegistrationOptions
  extends TextDocumentRegistrationOptions,
    TypeDefinitionOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `textDocument/typeDefinition` request.
 */
export interface TypeDefinitionParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams,
    PartialResultParams {}

export type ImplementationClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration. If this is set to
   * `true` the client supports the new `ImplementationRegistrationOptions`
   * return value for the corresponding server capability as well.
   */
  dynamicRegistration?: boolean;

  /**
   * The client supports additional metadata in the form of definition links.
   *
   * @since 3.14.0
   */
  linkSupport?: boolean;
};

export interface ImplementationOptions extends WorkDoneProgressOptions {}

export interface ImplementationRegistrationOptions
  extends TextDocumentRegistrationOptions,
    ImplementationOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `textDocument/implementation` request.
 */
export interface ImplementationParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams,
    PartialResultParams {}

export type ReferenceClientCapabilities = {
  /**
   * Whether references supports dynamic registration.
   */
  dynamicRegistration?: boolean;
};

export interface ReferenceOptions extends WorkDoneProgressOptions {}

export interface ReferenceRegistrationOptions
  extends TextDocumentRegistrationOptions,
    ReferenceOptions {}

/**
 * Params of the `textDocument/references` request.
 */
export interface ReferenceParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams,
    PartialResultParams {
  context: ReferenceContext;
}

export type ReferenceContext = {
  /**
   * Include the declaration of the current symbol.
   */
  includeDeclaration: boolean;
};

export type CallHierarchyClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration. If this is set to
   * `true` the client supports the new `(TextDocumentRegistrationOptions &
   * StaticRegistrationOptions)` return value for the corresponding server
   * capability as well.
   */
  dynamicRegistration?: boolean;
};

export interface CallHierarchyOptions extends WorkDoneProgressOptions {}

export interface CallHierarchyRegistrationOptions
  extends TextDocumentRegistrationOptions,
    CallHierarchyOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `textDocument/prepareCallHierarchy` request.
 */
export interface CallHierarchyPrepareParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams {}

export type CallHierarchyItem = {
  /**
   * The name of this item.
   */
  name: string;

  /**
   * The kind of this item.
   */
  kind: SymbolKind;

  /**
   * Tags for this item.
   */
  tags?: readonly SymbolTag[];

  /**
   * More detail for this item, e.g. the signature of a function.
   */
  detail?: string;

  /**
   * The resource identifier of this item.
   */
  uri: DocumentUri;

  /**
   * The range enclosing this symbol not including leading/trailing whitespace
   * but everything else, e.g. comments and code.
   */
  range: Range;

  /**
   * The range that should be selected and revealed when this symbol is being
   * picked, e.g. the name of a function. Must be contained by the
   * [`range`](#CallHierarchyItem.range).
   */
  selectionRange: Range;

  /**
   * A data entry field that is preserved between a call hierarchy prepare and
   * incoming calls or outgoing calls requests.
   */
  data?: unknown;
};

/**
 * Params of the `callHierarchy/incomingCalls` request.
 */
export interface CallHierarchyIncomingCallsParams
  extends WorkDoneProgressParams,
    PartialResultParams {
  item: CallHierarchyItem;
}

export type CallHierarchyIncomingCall = {
  /**
   * The item that makes the call.
   */
  from: CallHierarchyItem;

  /**
   * The ranges at which the calls appear. This is relative to the caller
   * denoted by [`this.from`](#CallHierarchyIncomingCall.from).
   */
  fromRanges: readonly Range[];
};

/**
 * Params of the `callHierarchy/outgoingCalls` request.
 */
export interface CallHierarchyOutgoingCallsParams
  extends WorkDoneProgressParams,
    PartialResultParams {
  item: CallHierarchyItem;
}

export type CallHierarchyOutgoingCall = {
  /**
   * The item that is called.
   */
  to: CallHierarchyItem;

  /**
   * The range at which this item is called. This is the range relative to
   * the caller, e.g the item passed to `callHierarchy/outgoingCalls` request.
   */
  fromRanges: readonly Range[];
};

export type TypeHierarchyClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration. If this is set to
   * `true` the client supports the new `(TextDocumentRegistrationOptions &
   * StaticRegistrationOptions)` return value for the corresponding server
   * capability as well.
   */
  dynamicRegistration?: boolean;
};

export interface TypeHierarchyOptions extends WorkDoneProgressOptions {}

export interface TypeHierarchyRegistrationOptions
  extends TextDocumentRegistrationOptions,
    TypeHierarchyOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `textDocument/prepareTypeHierarchy` request.
 */
export interface TypeHierarchyPrepareParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams {}

export type TypeHierarchyItem = {
  /**
   * The name of this item.
   */
  name: string;

  /**
   * The kind of this item.
   */
  kind: SymbolKind;

  /**
   * Tags for this item.
   */
  tags?: SymbolTag[];

  /**
   * More detail for this item, e.g. the signature of a function.
   */
  detail?: string;

  /**
   * The resource identifier of this item.
   */
  uri: DocumentUri;

  /**
   * The range enclosing this symbol not including leading/trailing whitespace
   * but everything else, e.g. comments and code.
   */
  range: Range;

  /**
   * The range that should be selected and revealed when this symbol is being
   * picked, e.g. the name of a function. Must be contained by the
   * [`range`](#TypeHierarchyItem.range).
   */
  selectionRange: Range;

  /**
   * A data entry field that is preserved between a type hierarchy prepare and
   * supertypes or subtypes requests. It could also be used to identify the
   * type hierarchy in the server, helping improve the performance on
   * resolving supertypes and subtypes.
   */
  data?: LSPAny;
};

/**
 * Params of the `typeHierarchy/supertypes` request.
 */
export interface TypeHierarchySupertypesParams extends WorkDoneProgressParams, PartialResultParams {
  item: TypeHierarchyItem;
}

/**
 * Params of the `typeHierarchy/subtypes` request.
 */
export interface TypeHierarchySubtypesParams extends WorkDoneProgressParams, PartialResultParams {
  item: TypeHierarchyItem;
}

export type DocumentHighlightClientCapabilities = {
  /**
   * Whether document highlight supports dynamic registration.
   */
  dynamicRegistration?: boolean;
};

export interface DocumentHighlightOptions extends WorkDoneProgressOptions {}

export interface DocumentHighlightRegistrationOptions
  extends TextDocumentRegistrationOptions,
    DocumentHighlightOptions {}

/**
 * Params of the `textDocument/documentHighlight` request.
 */
export interface DocumentHighlightParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams,
    PartialResultParams {}

/**
 * A document highlight is a range inside a text document which deserves
 * special attention. Usually a document highlight is visualized by changing
 * the background color of its range.
 *
 */
export type DocumentHighlight = {
  /**
   * The range this highlight applies to.
   */
  range: Range;

  /**
   * The highlight kind, default is DocumentHighlightKind.Text.
   */
  kind?: DocumentHighlightKind;
};

/**
 * A document highlight kind.
 */
export type DocumentHighlightKind =
  (typeof DocumentHighlightKind)[keyof typeof DocumentHighlightKind];
/**
 * A document highlight kind.
 */

export namespace DocumentHighlightKind {
  /**
   * A textual occurrence.
   */
  export const Text = 1;

  /**
   * Read-access of a symbol, like reading a variable.
   */
  export const Read = 2;

  /**
   * Write-access of a symbol, like writing to a variable.
   */
  export const Write = 3;
}

export type DocumentLinkClientCapabilities = {
  /**
   * Whether document link supports dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * Whether the client supports the `tooltip` property on `DocumentLink`.
   *
   * @since 3.15.0
   */
  tooltipSupport?: boolean;
};

export interface DocumentLinkOptions extends WorkDoneProgressOptions {
  /**
   * Document links have a resolve provider as well.
   */
  resolveProvider?: boolean;
}

export interface DocumentLinkRegistrationOptions
  extends TextDocumentRegistrationOptions,
    DocumentLinkOptions {}

/**
 * Params of the `textDocument/documentLink` request.
 */
export interface DocumentLinkParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The document to provide document links for.
   */
  textDocument: TextDocumentIdentifier;
}

/**
 * A document link is a range in a text document that links to an internal or
 * external resource, like another text document or a web site.
 */
export type DocumentLink = {
  /**
   * The range this link applies to.
   */
  range: Range;

  /**
   * The uri this link points to. If missing a resolve request is sent later.
   */
  target?: URI;

  /**
   * The tooltip text when you hover over this link.
   *
   * If a tooltip is provided, is will be displayed in a string that includes
   * instructions on how to trigger the link, such as `{0} (ctrl + click)`.
   * The specific instructions vary depending on OS, user settings, and
   * localization.
   *
   * @since 3.15.0
   */
  tooltip?: string;

  /**
   * A data entry field that is preserved on a document link between a
   * DocumentLinkRequest and a DocumentLinkResolveRequest.
   */
  data?: LSPAny;
};

export type HoverClientCapabilities = {
  /**
   * Whether hover supports dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * Client supports the follow content formats if the content
   * property refers to a `literal of type MarkupContent`.
   * The order describes the preferred format of the client.
   */
  contentFormat?: MarkupKind[];
};

export interface HoverOptions extends WorkDoneProgressOptions {}

export interface HoverRegistrationOptions extends TextDocumentRegistrationOptions, HoverOptions {}

/**
 * Params of the `textDocument/hover` request.
 */
export interface HoverParams extends TextDocumentPositionParams, WorkDoneProgressParams {}

/**
 * The result of a hover request.
 */
export type Hover = {
  /**
   * The hover's content
   */
  contents: MarkedString | readonly MarkedString[] | MarkupContent;

  /**
   * An optional range is a range inside a text document
   * that is used to visualize a hover, e.g. by changing the background color.
   */
  range?: Range;
};

/**
 * MarkedString can be used to render human readable text. It is either a
 * markdown string or a code-block that provides a language and a code snippet.
 * The language identifier is semantically equal to the optional language
 * identifier in fenced code blocks in GitHub issues.
 *
 * The pair of a language and a value is an equivalent to markdown:
 *
 * ```${language}
 * ${value}
 * ```
 *
 * Note that markdown strings will be sanitized - that means html will be
 * escaped.
 *
 * @deprecated use MarkupContent instead.
 */
type MarkedString = string | { language: string; value: string };

export type CodeLensClientCapabilities = {
  /**
   * Whether code lens supports dynamic registration.
   */
  dynamicRegistration?: boolean;
};

export interface CodeLensOptions extends WorkDoneProgressOptions {
  /**
   * Code lens has a resolve provider as well.
   */
  resolveProvider?: boolean;
}

export interface CodeLensRegistrationOptions
  extends TextDocumentRegistrationOptions,
    CodeLensOptions {}

/**
 * Params of the `textDocument/codeLens` request.
 */
export interface CodeLensParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The document to request code lens for.
   */
  textDocument: TextDocumentIdentifier;
}

/**
 * A code lens represents a command that should be shown along with
 * source text, like the number of references, a way to run tests, etc.
 *
 * A code lens is _unresolved_ when no command is associated to it. For
 * performance reasons the creation of a code lens and resolving should be done
 * in two stages.
 */
export type CodeLens = {
  /**
   * The range in which this code lens is valid. Should only span a single
   * line.
   */
  range: Range;

  /**
   * The command this code lens represents.
   */
  command?: Command;

  /**
   * A data entry field that is preserved on a code lens item between
   * a code lens and a code lens resolve request.
   */
  data?: LSPAny;
};

export type CodeLensWorkspaceClientCapabilities = {
  /**
   * Whether the client implementation supports a refresh request sent from the
   * server to the client.
   *
   * Note that this event is global and will force the client to refresh all
   * code lenses currently shown. It should be used with absolute care and is
   * useful for situation where a server for example detect a project wide
   * change that requires such a calculation.
   */
  refreshSupport?: boolean;
};

export type FoldingRangeClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration for folding range
   * providers. If this is set to `true` the client supports the new
   * `FoldingRangeRegistrationOptions` return value for the corresponding
   * server capability as well.
   */
  dynamicRegistration?: boolean;

  /**
   * The maximum number of folding ranges that the client prefers to receive
   * per document. The value serves as a hint, servers are free to follow the
   * limit.
   */
  rangeLimit?: uinteger;

  /**
   * If set, the client signals that it only supports folding complete lines.
   * If set, client will ignore specified `startCharacter` and `endCharacter`
   * properties in a FoldingRange.
   */
  lineFoldingOnly?: boolean;

  /**
   * Specific options for the folding range kind.
   *
   * @since 3.17.0
   */
  foldingRangeKind?: {
    /**
     * The folding range kind values the client supports. When this
     * property exists the client also guarantees that it will
     * handle values outside its set gracefully and falls back
     * to a default value when unknown.
     */
    valueSet?: readonly FoldingRangeKind[];
  };

  /**
   * Specific options for the folding range.
   * @since 3.17.0
   */
  foldingRange?: {
    /**
     * If set, the client signals that it supports setting collapsedText on
     * folding ranges to display custom labels instead of the default text.
     *
     * @since 3.17.0
     */
    collapsedText?: boolean;
  };
};

export interface FoldingRangeOptions extends WorkDoneProgressOptions {}

export interface FoldingRangeRegistrationOptions
  extends TextDocumentRegistrationOptions,
    FoldingRangeOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `textDocument/foldingRange` request.
 */
export interface FoldingRangeParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;
}

/**
 * A set of predefined range kinds.
 *
 * The type is a string since the value set is extensible
 */
export type FoldingRangeKind =
  | (typeof FoldingRangeKind)[keyof typeof FoldingRangeKind]
  | (string & NonNullable<unknown>);
/**
 * A set of predefined range kinds.
 */

export namespace FoldingRangeKind {
  /**
   * Folding range for a comment
   */
  export const Comment = "comment";

  /**
   * Folding range for imports or includes
   */
  export const Imports = "imports";

  /**
   * Folding range for a region (e.g. `#region`)
   */
  export const Region = "region";
}

/**
 * Represents a folding range. To be valid, start and end line must be bigger
 * than zero and smaller than the number of lines in the document. Clients
 * are free to ignore invalid ranges.
 */
export type FoldingRange = {
  /**
   * The zero-based start line of the range to fold. The folded area starts
   * after the line's last character. To be valid, the end must be zero or
   * larger and smaller than the number of lines in the document.
   */
  startLine: uinteger;

  /**
   * The zero-based character offset from where the folded range starts. If
   * not defined, defaults to the length of the start line.
   */
  startCharacter?: uinteger;

  /**
   * The zero-based end line of the range to fold. The folded area ends with
   * the line's last character. To be valid, the end must be zero or larger
   * and smaller than the number of lines in the document.
   */
  endLine: uinteger;

  /**
   * The zero-based character offset before the folded range ends. If not
   * defined, defaults to the length of the end line.
   */
  endCharacter?: uinteger;

  /**
   * Describes the kind of the folding range such as `comment` or `region`.
   * The kind is used to categorize folding ranges and used by commands like
   * 'Fold all comments'. See [FoldingRangeKind](#FoldingRangeKind) for an
   * enumeration of standardized kinds.
   */
  kind?: FoldingRangeKind;

  /**
   * The text that the client should show when the specified range is
   * collapsed. If not defined or not supported by the client, a default
   * will be chosen by the client.
   *
   * @since 3.17.0 - proposed
   */
  collapsedText?: string;
};

export type SelectionRangeClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration for selection range
   * providers. If this is set to `true` the client supports the new
   * `SelectionRangeRegistrationOptions` return value for the corresponding
   * server capability as well.
   */
  dynamicRegistration?: boolean;
};

export interface SelectionRangeOptions extends WorkDoneProgressOptions {}

export interface SelectionRangeRegistrationOptions
  extends SelectionRangeOptions,
    TextDocumentRegistrationOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `textDocument/selectionRange` request.
 */
export interface SelectionRangeParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The positions inside the text document.
   */
  positions: readonly Position[];
}

export type SelectionRange = {
  /**
   * The [range](#Range) of this selection range.
   */
  range: Range;

  /**
   * The parent selection range containing this range. Therefore
   * `parent.range` must contain `this.range`.
   */
  parent?: SelectionRange;
};

export type DocumentSymbolClientCapabilities = {
  /**
   * Whether document symbol supports dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * Specific capabilities for the `SymbolKind` in the
   * `textDocument/documentSymbol` request.
   */
  symbolKind?: {
    /**
     * The symbol kind values the client supports. When this
     * property exists the client also guarantees that it will
     * handle values outside its set gracefully and falls back
     * to a default value when unknown.
     *
     * If this property is not present the client only supports
     * the symbol kinds from `File` to `Array` as defined in
     * the initial version of the protocol.
     */
    valueSet?: readonly SymbolKind[];
  };

  /**
   * The client supports hierarchical document symbols.
   */
  hierarchicalDocumentSymbolSupport?: boolean;

  /**
   * The client supports tags on `SymbolInformation`. Tags are supported on
   * `DocumentSymbol` if `hierarchicalDocumentSymbolSupport` is set to true.
   * Clients supporting tags have to handle unknown tags gracefully.
   *
   * @since 3.16.0
   */
  tagSupport?: {
    /**
     * The tags supported by the client.
     */
    valueSet: readonly SymbolTag[];
  };

  /**
   * The client supports an additional label presented in the UI when
   * registering a document symbol provider.
   *
   * @since 3.16.0
   */
  labelSupport?: boolean;
};

export interface DocumentSymbolOptions extends WorkDoneProgressOptions {
  /**
   * A human-readable string that is shown when multiple outlines trees
   * are shown for the same document.
   *
   * @since 3.16.0
   */
  label?: string;
}

export interface DocumentSymbolRegistrationOptions
  extends TextDocumentRegistrationOptions,
    DocumentSymbolOptions {}

/**
 * Params of the `textDocument/documentSymbol` request.
 */
export interface DocumentSymbolParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;
}

/**
 * A symbol kind.
 */
export type SymbolKind = (typeof SymbolKind)[keyof typeof SymbolKind];
/**
 * Symbol kinds.
 */

export namespace SymbolKind {
  export const File = 1;
  export const Module = 2;
  export const Namespace = 3;
  export const Package = 4;
  export const Class = 5;
  export const Method = 6;
  export const Property = 7;
  export const Field = 8;
  export const Constructor = 9;
  export const Enum = 10;
  export const Interface = 11;
  export const Function = 12;
  export const Variable = 13;
  export const Constant = 14;
  export const String = 15;
  export const Number = 16;
  export const Boolean = 17;
  export const Array = 18;
  export const Object = 19;
  export const Key = 20;
  export const Null = 21;
  export const EnumMember = 22;
  export const Struct = 23;
  export const Event = 24;
  export const Operator = 25;
  export const TypeParameter = 26;
}

/**
 * A symbol tag.
 */
export type SymbolTag = (typeof SymbolTag)[keyof typeof SymbolTag];
/**
 * Symbol tags are extra annotations that tweak the rendering of a symbol.
 *
 * @since 3.16
 */

export namespace SymbolTag {
  /**
   * Render a symbol as obsolete, usually using a strike-out.
   */
  export const Deprecated = 1;
}

/**
 * Represents programming constructs like variables, classes, interfaces etc.
 * that appear in a document. Document symbols can be hierarchical and they
 * have two ranges: one that encloses its definition and one that points to its
 * most interesting range, e.g. the range of an identifier.
 */
export type DocumentSymbol = {
  /**
   * The name of this symbol. Will be displayed in the user interface and
   * therefore must not be an empty string or a string only consisting of
   * white spaces.
   */
  name: string;

  /**
   * More detail for this symbol, e.g the signature of a function.
   */
  detail?: string;

  /**
   * The kind of this symbol.
   */
  kind: SymbolKind;

  /**
   * Tags for this document symbol.
   *
   * @since 3.16.0
   */
  tags?: readonly SymbolTag[];

  /**
   * Indicates if this symbol is deprecated.
   *
   * @deprecated Use tags instead
   */
  deprecated?: boolean;

  /**
   * The range enclosing this symbol not including leading/trailing whitespace
   * but everything else like comments. This information is typically used to
   * determine if the clients cursor is inside the symbol to reveal in the
   * symbol in the UI.
   */
  range: Range;

  /**
   * The range that should be selected and revealed when this symbol is being
   * picked, e.g. the name of a function. Must be contained by the `range`.
   */
  selectionRange: Range;

  /**
   * Children of this symbol, e.g. properties of a class.
   */
  children?: readonly DocumentSymbol[];
};

/**
 * Represents information about programming constructs like variables, classes,
 * interfaces etc.
 *
 * @deprecated use DocumentSymbol or WorkspaceSymbol instead.
 */
export type SymbolInformation = {
  /**
   * The name of this symbol.
   */
  name: string;

  /**
   * The kind of this symbol.
   */
  kind: SymbolKind;

  /**
   * Tags for this symbol.
   *
   * @since 3.16.0
   */
  tags?: readonly SymbolTag[];

  /**
   * Indicates if this symbol is deprecated.
   *
   * @deprecated Use tags instead
   */
  deprecated?: boolean;

  /**
   * The location of this symbol. The location's range is used by a tool
   * to reveal the location in the editor. If the symbol is selected in the
   * tool the range's start information is used to position the cursor. So
   * the range usually spans more then the actual symbol's name and does
   * normally include things like visibility modifiers.
   *
   * The range doesn't have to denote a node range in the sense of an abstract
   * syntax tree. It can therefore not be used to re-construct a hierarchy of
   * the symbols.
   */
  location: Location;

  /**
   * The name of the symbol containing this symbol. This information is for
   * user interface purposes (e.g. to render a qualifier in the user interface
   * if necessary). It can't be used to re-infer a hierarchy for the document
   * symbols.
   */
  containerName?: string;
};

export enum SemanticTokenTypes {
  namespace = "namespace",
  /**
   * Represents a generic type. Acts as a fallback for types which
   * can't be mapped to a specific type like class or enum.
   */
  type = "type",
  class = "class",
  enum = "enum",
  interface = "interface",
  struct = "struct",
  typeParameter = "typeParameter",
  parameter = "parameter",
  variable = "variable",
  property = "property",
  enumMember = "enumMember",
  event = "event",
  function = "function",
  method = "method",
  macro = "macro",
  keyword = "keyword",
  modifier = "modifier",
  comment = "comment",
  string = "string",
  number = "number",
  regexp = "regexp",
  operator = "operator",
  /**
   * @since 3.17.0
   */
  decorator = "decorator",
}

export enum SemanticTokenModifiers {
  declaration = "declaration",
  definition = "definition",
  readonly = "readonly",
  static = "static",
  deprecated = "deprecated",
  abstract = "abstract",
  async = "async",
  modification = "modification",
  documentation = "documentation",
  defaultLibrary = "defaultLibrary",
}

export type TokenFormat = (typeof TokenFormat)[keyof typeof TokenFormat];

export namespace TokenFormat {
  export const Relative = "relative";
}

export type SemanticTokensLegend = {
  /**
   * The token types a server uses.
   */
  tokenTypes: readonly string[];

  /**
   * The token modifiers a server uses.
   */
  tokenModifiers: readonly string[];
};

type SemanticTokensClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration. If this is set to
   * `true` the client supports the new `(TextDocumentRegistrationOptions &
   * StaticRegistrationOptions)` return value for the corresponding server
   * capability as well.
   */
  dynamicRegistration?: boolean;

  /**
   * Which requests the client supports and might send to the server
   * depending on the server's capability. Please note that clients might not
   * show semantic tokens or degrade some of the user experience if a range
   * or full request is advertised by the client but not provided by the
   * server. If for example the client capability `requests.full` and
   * `request.range` are both set to true but the server only provides a
   * range provider the client might not render a minimap correctly or might
   * even decide to not show any semantic tokens at all.
   */
  requests: {
    /**
     * The client will send the `textDocument/semanticTokens/range` request
     * if the server provides a corresponding handler.
     */
    range?: boolean | NonNullable<unknown>;

    /**
     * The client will send the `textDocument/semanticTokens/full` request
     * if the server provides a corresponding handler.
     */
    full?:
      | boolean
      | {
          /**
           * The client will send the `textDocument/semanticTokens/full/delta`
           * request if the server provides a corresponding handler.
           */
          delta?: boolean;
        };
  };

  /**
   * The token types that the client supports.
   */
  tokenTypes: readonly string[];

  /**
   * The token modifiers that the client supports.
   */
  tokenModifiers: readonly string[];

  /**
   * The formats the clients supports.
   */
  formats: readonly TokenFormat[];

  /**
   * Whether the client supports tokens that can overlap each other.
   */
  overlappingTokenSupport?: boolean;

  /**
   * Whether the client supports tokens that can span multiple lines.
   */
  multilineTokenSupport?: boolean;

  /**
   * Whether the client allows the server to actively cancel a
   * semantic token request, e.g. supports returning
   * ErrorCodes.ServerCancelled. If a server does the client
   * needs to retrigger the request.
   *
   * @since 3.17.0
   */
  serverCancelSupport?: boolean;

  /**
   * Whether the client uses semantic tokens to augment existing
   * syntax tokens. If set to `true` client side created syntax
   * tokens and semantic tokens are both used for colorization. If
   * set to `false` the client only uses the returned semantic tokens
   * for colorization.
   *
   * If the value is `undefined` then the client behavior is not
   * specified.
   *
   * @since 3.17.0
   */
  augmentsSyntaxTokens?: boolean;
};

export interface SemanticTokensOptions extends WorkDoneProgressOptions {
  /**
   * The legend used by the server
   */
  legend: SemanticTokensLegend;

  /**
   * Server supports providing semantic tokens for a specific range
   * of a document.
   */
  range?: boolean | NonNullable<unknown>;

  /**
   * Server supports providing semantic tokens for a full document.
   */
  full?:
    | boolean
    | {
        /**
         * The server supports deltas for full documents.
         */
        delta?: boolean;
      };
}

export interface SemanticTokensRegistrationOptions
  extends TextDocumentRegistrationOptions,
    SemanticTokensOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `textDocument/semanticTokens/full` request.
 */
export interface SemanticTokensParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;
}

export type SemanticTokens = {
  /**
   * An optional result id. If provided and clients support delta updating
   * the client will include the result id in the next semantic token request.
   * A server can then instead of computing all semantic tokens again simply
   * send a delta.
   */
  resultId?: string;

  /**
   * The actual tokens.
   */
  data: readonly uinteger[];
};

export type SemanticTokensPartialResult = {
  data: readonly uinteger[];
};

/**
 * Params of the `textDocument/semanticTokens/full/delta` request.
 */
export interface SemanticTokensDeltaParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The result id of a previous response. The result Id can either point to
   * a full response or a delta response depending on what was received last.
   */
  previousResultId: string;
}

export type SemanticTokensDelta = {
  readonly resultId?: string;
  /**
   * The semantic token edits to transform a previous result into a new
   * result.
   */
  edits: readonly SemanticTokensEdit[];
};

export type SemanticTokensEdit = {
  /**
   * The start offset of the edit.
   */
  start: uinteger;

  /**
   * The count of elements to remove.
   */
  deleteCount: uinteger;

  /**
   * The elements to insert.
   */
  data?: readonly uinteger[];
};

export type SemanticTokensDeltaPartialResult = {
  edits: readonly SemanticTokensEdit[];
};

/**
 * Params of the `textDocument/semanticTokens/range` request.
 */
export interface SemanticTokensRangeParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The range the semantic tokens are requested for.
   */
  range: Range;
}

export type SemanticTokensWorkspaceClientCapabilities = {
  /**
   * Whether the client implementation supports a refresh request sent from
   * the server to the client.
   *
   * Note that this event is global and will force the client to refresh all
   * semantic tokens currently shown. It should be used with absolute care
   * and is useful for situation where a server for example detect a project
   * wide change that requires such a calculation.
   */
  refreshSupport?: boolean;
};

/**
 * Inlay hint client capabilities.
 *
 * @since 3.17.0
 */
export type InlayHintClientCapabilities = {
  /**
   * Whether inlay hints support dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * Indicates which properties a client can resolve lazily on an inlay
   * hint.
   */
  resolveSupport?: {
    /**
     * The properties that a client can resolve lazily.
     */
    properties: readonly string[];
  };
};

/**
 * Inlay hint options used during static registration.
 *
 * @since 3.17.0
 */
export interface InlayHintOptions extends WorkDoneProgressOptions {
  /**
   * The server provides support to resolve additional
   * information for an inlay hint item.
   */
  resolveProvider?: boolean;
}

/**
 * Inlay hint options used during static or dynamic registration.
 *
 * @since 3.17.0
 */
export interface InlayHintRegistrationOptions
  extends InlayHintOptions,
    TextDocumentRegistrationOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `textDocument/inlayHint` request.
 *
 * @since 3.17.0
 */
export interface InlayHintParams extends WorkDoneProgressParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The visible document range for which inlay hints should be computed.
   */
  range: Range;
}

/**
 * Inlay hint information.
 *
 * @since 3.17.0
 */
export type InlayHint = {
  /**
   * The position of this hint.
   *
   * If multiple hints have the same position, they will be shown in the order
   * they appear in the response.
   */
  position: Position;

  /**
   * The label of this hint. A human readable string or an array of
   * InlayHintLabelPart label parts.
   *
   * _Note_ that neither the string nor the label part can be empty.
   */
  label: string | readonly InlayHintLabelPart[];

  /**
   * The kind of this hint. Can be omitted in which case the client
   * should fall back to a reasonable default.
   */
  kind?: InlayHintKind;

  /**
   * Optional text edits that are performed when accepting this inlay hint.
   *
   * _Note_ that edits are expected to change the document so that the inlay
   * hint (or its nearest variant) is now part of the document and the inlay
   * hint itself is now obsolete.
   *
   * Depending on the client capability `inlayHint.resolveSupport` clients
   * might resolve this property late using the resolve request.
   */
  textEdits?: readonly TextEdit[];

  /**
   * The tooltip text when you hover over this item.
   *
   * Depending on the client capability `inlayHint.resolveSupport` clients
   * might resolve this property late using the resolve request.
   */
  tooltip?: string | MarkupContent;

  /**
   * Render padding before the hint.
   *
   * Note: Padding should use the editor's background color, not the
   * background color of the hint itself. That means padding can be used
   * to visually align/separate an inlay hint.
   */
  paddingLeft?: boolean;

  /**
   * Render padding after the hint.
   *
   * Note: Padding should use the editor's background color, not the
   * background color of the hint itself. That means padding can be used
   * to visually align/separate an inlay hint.
   */
  paddingRight?: boolean;

  /**
   * A data entry field that is preserved on an inlay hint between
   * a `textDocument/inlayHint` and a `inlayHint/resolve` request.
   */
  data?: LSPAny;
};

/**
 * An inlay hint label part allows for interactive and composite labels of inlay hints.
 *
 * @since 3.17.0
 */
export type InlayHintLabelPart = {
  /**
   * The value of this label part.
   */
  value: string;

  /**
   * The tooltip text when you hover over this label part. Depending on
   * the client capability `inlayHint.resolveSupport` clients might resolve
   * this property late using the resolve request.
   */
  tooltip?: string | MarkupContent;

  /**
   * An optional source code location that represents this
   * label part.
   *
   * The editor will use this location for the hover and for code navigation
   * features: This part will become a clickable link that resolves to the
   * definition of the symbol at the given location (not necessarily the
   * location itself), it shows the hover that shows at the given location,
   * and it shows a context menu with further code navigation commands.
   *
   * Depending on the client capability `inlayHint.resolveSupport` clients
   * might resolve this property late using the resolve request.
   */
  location?: Location;

  /**
   * An optional command for this label part.
   *
   * Depending on the client capability `inlayHint.resolveSupport` clients
   * might resolve this property late using the resolve request.
   */
  command?: Command;
};

/**
 * Inlay hint kind.
 *
 * @since 3.17.0
 */
export type InlayHintKind = (typeof InlayHintKind)[keyof typeof InlayHintKind];
/**
 * Inlay hint kinds.
 *
 * @since 3.17.0
 */

export namespace InlayHintKind {
  /**
   * An inlay hint that for a type annotation.
   */
  export const Type = 1;

  /**
   * An inlay hint that is for a parameter.
   */
  export const Parameter = 2;
}

/**
 * Client workspace capabilities specific to inlay hints.
 *
 * @since 3.17.0
 */
export type InlayHintWorkspaceClientCapabilities = {
  /**
   * Whether the client implementation supports a refresh request sent from
   * the server to the client.
   *
   * Note that this event is global and will force the client to refresh all
   * inlay hints currently shown. It should be used with absolute care and
   * is useful for situation where a server for example detects a project wide
   * change that requires such a calculation.
   */
  refreshSupport?: boolean;
};

/**
 * Client capabilities specific to inline values.
 *
 * @since 3.17.0
 */
export type InlineValueClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration for inline
   * value providers.
   */
  dynamicRegistration?: boolean;
};

/**
 * Inline value options used during static registration.
 *
 * @since 3.17.0
 */
export interface InlineValueOptions extends WorkDoneProgressOptions {}

/**
 * Inline value options used during static or dynamic registration.
 *
 * @since 3.17.0
 */
export interface InlineValueRegistrationOptions
  extends InlineValueOptions,
    TextDocumentRegistrationOptions,
    StaticRegistrationOptions {}

/**
 * A parameter literal used in inline value requests.
 *
 * @since 3.17.0
 */
export interface InlineValueParams extends WorkDoneProgressParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The document range for which inline values should be computed.
   */
  range: Range;

  /**
   * Additional information about the context in which inline values were
   * requested.
   */
  context: InlineValueContext;
}

/**
 * @since 3.17.0
 */
export type InlineValueContext = {
  /**
   * The stack frame (as a DAP Id) where the execution has stopped.
   */
  frameId: integer;

  /**
   * The document range where execution has stopped.
   * Typically the end position of the range denotes the line where the
   * inline values are shown.
   */
  stoppedLocation: Range;
};

/**
 * Provide inline value as text.
 *
 * @since 3.17.0
 */
export type InlineValueText = {
  /**
   * The document range for which the inline value applies.
   */
  range: Range;

  /**
   * The text of the inline value.
   */
  text: string;
};

/**
 * Provide inline value through a variable lookup.
 *
 * If only a range is specified, the variable name will be extracted from
 * the underlying document.
 *
 * An optional variable name can be used to override the extracted name.
 *
 * @since 3.17.0
 */
export type InlineValueVariableLookup = {
  /**
   * The document range for which the inline value applies.
   * The range is used to extract the variable name from the underlying
   * document.
   */
  range: Range;

  /**
   * If specified the name of the variable to look up.
   */
  variableName?: string;

  /**
   * How to perform the lookup.
   */
  caseSensitiveLookup: boolean;
};

/**
 * Provide an inline value through an expression evaluation.
 *
 * If only a range is specified, the expression will be extracted from the
 * underlying document.
 *
 * An optional expression can be used to override the extracted expression.
 *
 * @since 3.17.0
 */
export type InlineValueEvaluatableExpression = {
  /**
   * The document range for which the inline value applies.
   * The range is used to extract the evaluatable expression from the
   * underlying document.
   */
  range: Range;

  /**
   * If specified the expression overrides the extracted expression.
   */
  expression?: string;
};

/**
 * Inline value information can be provided by different means:
 * - directly as a text value (class InlineValueText).
 * - as a name to use for a variable lookup (class InlineValueVariableLookup)
 * - as an evaluatable expression (class InlineValueEvaluatableExpression)
 * The InlineValue types combines all inline value types into one type.
 *
 * @since 3.17.0
 */
export type InlineValue =
  | InlineValueText
  | InlineValueVariableLookup
  | InlineValueEvaluatableExpression;

/**
 * Client workspace capabilities specific to inline values.
 *
 * @since 3.17.0
 */
export type InlineValueWorkspaceClientCapabilities = {
  /**
   * Whether the client implementation supports a refresh request sent from
   * the server to the client.
   *
   * Note that this event is global and will force the client to refresh all
   * inline values currently shown. It should be used with absolute care and
   * is useful for situation where a server for example detect a project wide
   * change that requires such a calculation.
   */
  refreshSupport?: boolean;
};

type MonikerClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration. If this is set to
   * `true` the client supports the new `(TextDocumentRegistrationOptions &
   * StaticRegistrationOptions)` return value for the corresponding server
   * capability as well.
   */
  dynamicRegistration?: boolean;
};

export interface MonikerOptions extends WorkDoneProgressOptions {}

export interface MonikerRegistrationOptions
  extends TextDocumentRegistrationOptions,
    MonikerOptions {}

export interface MonikerParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams,
    PartialResultParams {}

/**
 * Moniker uniqueness level to define scope of the moniker.
 */
export enum UniquenessLevel {
  /**
   * The moniker is only unique inside a document
   */
  document = "document",

  /**
   * The moniker is unique inside a project for which a dump got created
   */
  project = "project",

  /**
   * The moniker is unique inside the group to which a project belongs
   */
  group = "group",

  /**
   * The moniker is unique inside the moniker scheme.
   */
  scheme = "scheme",

  /**
   * The moniker is globally unique
   */
  global = "global",
}

/**
 * The moniker kind.
 */
export enum MonikerKind {
  /**
   * The moniker represent a symbol that is imported into a project
   */
  import = "import",

  /**
   * The moniker represents a symbol that is exported from a project
   */
  export = "export",

  /**
   * The moniker represents a symbol that is local to a project (e.g. a local
   * variable of a function, a class not visible outside the project, ...)
   */
  local = "local",
}

/**
 * Moniker definition to match LSIF 0.5 moniker definition.
 */
export type Moniker = {
  /**
   * The scheme of the moniker. For example tsc or .Net
   */
  scheme: string;

  /**
   * The identifier of the moniker. The value is opaque in LSIF however
   * schema owners are allowed to define the structure if they want.
   */
  identifier: string;

  /**
   * The scope in which the moniker is unique
   */
  unique: UniquenessLevel;

  /**
   * The moniker kind if known.
   */
  kind?: MonikerKind;
};

export type CompletionClientCapabilities = {
  /**
   * Whether completion supports dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * The client supports the following `CompletionItem` specific
   * capabilities.
   */
  completionItem?: {
    /**
     * Client supports snippets as insert text.
     *
     * A snippet can define tab stops and placeholders with `$1`, `$2`
     * and `${3:foo}`. `$0` defines the final tab stop, it defaults to
     * the end of the snippet. Placeholders with equal identifiers are
     * linked, that is typing in one will update others too.
     */
    snippetSupport?: boolean;

    /**
     * Client supports commit characters on a completion item.
     */
    commitCharactersSupport?: boolean;

    /**
     * Client supports the follow content formats for the documentation
     * property. The order describes the preferred format of the client.
     */
    documentationFormat?: readonly MarkupKind[];

    /**
     * Client supports the deprecated property on a completion item.
     */
    deprecatedSupport?: boolean;

    /**
     * Client supports the preselect property on a completion item.
     */
    preselectSupport?: boolean;

    /**
     * Client supports the tag property on a completion item. Clients
     * supporting tags have to handle unknown tags gracefully. Clients
     * especially need to preserve unknown tags when sending a completion
     * item back to the server in a resolve call.
     *
     * @since 3.15.0
     */
    tagSupport?: {
      /**
       * The tags supported by the client.
       */
      valueSet: readonly CompletionItemTag[];
    };

    /**
     * Client supports insert replace edit to control different behavior if
     * a completion item is inserted in the text or should replace text.
     *
     * @since 3.16.0
     */
    insertReplaceSupport?: boolean;

    /**
     * Indicates which properties a client can resolve lazily on a
     * completion item. Before version 3.16.0 only the predefined properties
     * `documentation` and `detail` could be resolved lazily.
     *
     * @since 3.16.0
     */
    resolveSupport?: {
      /**
       * The properties that a client can resolve lazily.
       */
      properties: readonly string[];
    };

    /**
     * The client supports the `insertTextMode` property on
     * a completion item to override the whitespace handling mode
     * as defined by the client (see `insertTextMode`).
     *
     * @since 3.16.0
     */
    insertTextModeSupport?: {
      valueSet: readonly InsertTextMode[];
    };

    /**
     * The client has support for completion item label
     * details (see also `CompletionItemLabelDetails`).
     *
     * @since 3.17.0
     */
    labelDetailsSupport?: boolean;
  };

  completionItemKind?: {
    /**
     * The completion item kind values the client supports. When this
     * property exists the client also guarantees that it will
     * handle values outside its set gracefully and falls back
     * to a default value when unknown.
     *
     * If this property is not present the client only supports
     * the completion items kinds from `Text` to `Reference` as defined in
     * the initial version of the protocol.
     */
    valueSet?: readonly CompletionItemKind[];
  };

  /**
   * The client supports to send additional context information for a
   * `textDocument/completion` request.
   */
  contextSupport?: boolean;

  /**
   * The client's default when the completion item doesn't provide a
   * `insertTextMode` property.
   *
   * @since 3.17.0
   */
  insertTextMode?: InsertTextMode;

  /**
   * The client supports the following `CompletionList` specific
   * capabilities.
   *
   * @since 3.17.0
   */
  completionList?: {
    /**
     * The client supports the following itemDefaults on
     * a completion list.
     *
     * The value lists the supported property names of the
     * `CompletionList.itemDefaults` object. If omitted
     * no properties are supported.
     *
     * @since 3.17.0
     */
    itemDefaults?: readonly string[];
  };
};

/**
 * Completion options.
 */
export interface CompletionOptions extends WorkDoneProgressOptions {
  /**
   * The additional characters, beyond the defaults provided by the client (typically
   * [a-zA-Z]), that should automatically trigger a completion request. For example
   * `.` in JavaScript represents the beginning of an object property or method and is
   * thus a good candidate for triggering a completion request.
   *
   * Most tools trigger a completion request automatically without explicitly
   * requesting it using a keyboard shortcut (e.g. Ctrl+Space). Typically they
   * do so when the user starts to type an identifier. For example if the user
   * types `c` in a JavaScript file code complete will automatically pop up
   * present `console` besides others as a completion item. Characters that
   * make up identifiers don't need to be listed here.
   */
  triggerCharacters?: readonly string[];

  /**
   * The list of all possible characters that commit a completion. This field
   * can be used if clients don't support individual commit characters per
   * completion item. See client capability
   * `completion.completionItem.commitCharactersSupport`.
   *
   * If a server provides both `allCommitCharacters` and commit characters on
   * an individual completion item the ones on the completion item win.
   *
   * @since 3.2.0
   */
  allCommitCharacters?: readonly string[];

  /**
   * The server provides support to resolve additional
   * information for a completion item.
   */
  resolveProvider?: boolean;

  /**
   * The server supports the following `CompletionItem` specific
   * capabilities.
   *
   * @since 3.17.0
   */
  completionItem?: {
    /**
     * The server has support for completion item label
     * details (see also `CompletionItemLabelDetails`) when receiving
     * a completion item in a resolve call.
     *
     * @since 3.17.0
     */
    labelDetailsSupport?: boolean;
  };
}

export interface CompletionRegistrationOptions
  extends TextDocumentRegistrationOptions,
    CompletionOptions {}

/**
 * Params of the `textDocument/completion` request.
 */
export interface CompletionParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams,
    PartialResultParams {
  /**
   * The completion context. This is only available if the client specifies
   * to send this using the client capability
   * `completion.contextSupport === true`
   */
  context?: CompletionContext;
}

/**
 * How a completion was triggered.
 */
export type CompletionTriggerKind =
  (typeof CompletionTriggerKind)[keyof typeof CompletionTriggerKind];
/**
 * How a completion was triggered.
 */

export namespace CompletionTriggerKind {
  /**
   * Completion was triggered by typing an identifier (24x7 code
   * complete), manual invocation (e.g Ctrl+Space) or via API.
   */
  export const Invoked = 1;

  /**
   * Completion was triggered by a trigger character specified by
   * the `triggerCharacters` properties of the
   * `CompletionRegistrationOptions`.
   */
  export const TriggerCharacter = 2;

  /**
   * Completion was re-triggered as the current completion list is incomplete.
   */
  export const TriggerForIncompleteCompletions = 3;
}

/**
 * Contains additional information about the context in which a completion
 * request is triggered.
 */
export type CompletionContext = {
  /**
   * How the completion was triggered.
   */
  triggerKind: CompletionTriggerKind;

  /**
   * The trigger character (a single character) that has trigger code
   * complete. Is undefined if
   * `triggerKind !== CompletionTriggerKind.TriggerCharacter`
   */
  triggerCharacter?: string;
};

/**
 * Represents a collection of [completion items](#CompletionItem) to be
 * presented in the editor.
 */
export type CompletionList = {
  /**
   * This list is not complete. Further typing should result in recomputing
   * this list.
   *
   * Recomputed lists have all their items replaced (not appended) in the
   * incomplete completion sessions.
   */
  isIncomplete: boolean;

  /**
   * In many cases the items of an actual completion result share the same
   * value for properties like `commitCharacters` or the range of a text
   * edit. A completion list can therefore define item defaults which will
   * be used if a completion item itself doesn't specify the value.
   *
   * If a completion list specifies a default value and a completion item
   * also specifies a corresponding value the one from the item is used.
   *
   * Servers are only allowed to return default values if the client
   * signals support for this via the `completionList.itemDefaults`
   * capability.
   *
   * @since 3.17.0
   */
  itemDefaults?: {
    /**
     * A default commit character set.
     *
     * @since 3.17.0
     */
    commitCharacters?: readonly string[];

    /**
     * A default edit range
     *
     * @since 3.17.0
     */
    editRange?:
      | Range
      | {
          insert: Range;
          replace: Range;
        };

    /**
     * A default insert text format
     *
     * @since 3.17.0
     */
    insertTextFormat?: InsertTextFormat;

    /**
     * A default insert text mode
     *
     * @since 3.17.0
     */
    insertTextMode?: InsertTextMode;

    /**
     * A default data value.
     *
     * @since 3.17.0
     */
    data?: LSPAny;
  };

  /**
   * The completion items.
   */
  items: readonly CompletionItem[];
};

/**
 * Defines whether the insert text in a completion item should be interpreted as
 * plain text or a snippet.
 */
export type InsertTextFormat = (typeof InsertTextFormat)[keyof typeof InsertTextFormat];
/**
 * Defines whether the insert text in a completion item should be interpreted as
 * plain text or a snippet.
 */

export namespace InsertTextFormat {
  /**
   * The primary text to be inserted is treated as a plain string.
   */
  export const PlainText = 1;

  /**
   * The primary text to be inserted is treated as a snippet.
   *
   * A snippet can define tab stops and placeholders with `$1`, `$2`
   * and `${3:foo}`. `$0` defines the final tab stop, it defaults to
   * the end of the snippet. Placeholders with equal identifiers are linked,
   * that is typing in one will update others too.
   */
  export const Snippet = 2;
}

/**
 * Completion item tags are extra annotations that tweak the rendering of a
 * completion item.
 *
 * @since 3.15.0
 */
export type CompletionItemTag = (typeof CompletionItemTag)[keyof typeof CompletionItemTag];
/**
 * Completion item tags are extra annotations that tweak the rendering of a
 * completion item.
 *
 * @since 3.15.0
 */

export namespace CompletionItemTag {
  /**
   * Render a completion as obsolete, usually using a strike-out.
   */
  export const Deprecated = 1;
}

/**
 * A special text edit to provide an insert and a replace operation.
 *
 * @since 3.16.0
 */
export type InsertReplaceEdit = {
  /**
   * The string to be inserted.
   */
  newText: string;

  /**
   * The range if the insert is requested
   */
  insert: Range;

  /**
   * The range if the replace is requested.
   */
  replace: Range;
};

/**
 * How whitespace and indentation is handled during completion item insertion.
 *
 * @since 3.16.0
 */
export type InsertTextMode = (typeof InsertTextMode)[keyof typeof InsertTextMode];
/**
 * How whitespace and indentation is handled during completion item insertion.
 *
 * @since 3.16.0
 */

export namespace InsertTextMode {
  /**
   * The insertion or replace strings is taken as it is. If the
   * value is multi line the lines below the cursor will be
   * inserted using the indentation defined in the string value.
   * The client will not apply any kind of adjustments to the
   * string.
   */
  export const asIs = 1;

  /**
   * The editor adjusts leading whitespace of new lines so that
   * they match the indentation up to the cursor of the line for
   * which the item is accepted.
   *
   * Consider a line like this: <2tabs><cursor><3tabs>foo. Accepting a
   * multi line completion item is indented using 2 tabs and all
   * following lines inserted will be indented using 2 tabs as well.
   */
  export const adjustIndentation = 2;
}

/**
 * Additional details for a completion item label.
 *
 * @since 3.17.0
 */
export type CompletionItemLabelDetails = {
  /**
   * An optional string which is rendered less prominently directly after
   * {@link CompletionItem.label label}, without any spacing. Should be
   * used for function signatures or type annotations.
   */
  detail?: string;

  /**
   * An optional string which is rendered less prominently after
   * {@link CompletionItemLabelDetails.detail}. Should be used for fully qualified
   * names or file path.
   */
  description?: string;
};

export type CompletionItem = {
  /**
   * The label of this completion item.
   *
   * The label property is also by default the text that
   * is inserted when selecting this completion.
   *
   * If label details are provided the label itself should
   * be an unqualified name of the completion item.
   */
  label: string;

  /**
   * Additional details for the label
   *
   * @since 3.17.0
   */
  labelDetails?: CompletionItemLabelDetails;

  /**
   * The kind of this completion item. Based of the kind
   * an icon is chosen by the editor. The standardized set
   * of available values is defined in `CompletionItemKind`.
   */
  kind?: CompletionItemKind;

  /**
   * Tags for this completion item.
   *
   * @since 3.15.0
   */
  tags?: readonly CompletionItemTag[];

  /**
   * A human-readable string with additional information
   * about this item, like type or symbol information.
   */
  detail?: string;

  /**
   * A human-readable string that represents a doc-comment.
   */
  documentation?: string | MarkupContent;

  /**
   * Indicates if this item is deprecated.
   *
   * @deprecated Use `tags` instead if supported.
   */
  deprecated?: boolean;

  /**
   * Select this item when showing.
   *
   * _Note_ that only one completion item can be selected and that the
   * tool / client decides which item that is. The rule is that the *first*
   * item of those that match best is selected.
   */
  preselect?: boolean;

  /**
   * A string that should be used when comparing this item
   * with other items. When omitted the label is used
   * as the sort text for this item.
   */
  sortText?: string;

  /**
   * A string that should be used when filtering a set of
   * completion items. When omitted the label is used as the
   * filter text for this item.
   */
  filterText?: string;

  /**
   * A string that should be inserted into a document when selecting
   * this completion. When omitted the label is used as the insert text
   * for this item.
   *
   * The `insertText` is subject to interpretation by the client side.
   * Some tools might not take the string literally. For example
   * VS Code when code complete is requested in this example
   * `con<cursor position>` and a completion item with an `insertText` of
   * `console` is provided it will only insert `sole`. Therefore it is
   * recommended to use `textEdit` instead since it avoids additional client
   * side interpretation.
   */
  insertText?: string;

  /**
   * The format of the insert text. The format applies to both the
   * `insertText` property and the `newText` property of a provided
   * `textEdit`. If omitted defaults to `InsertTextFormat.PlainText`.
   *
   * Please note that the insertTextFormat doesn't apply to
   * `additionalTextEdits`.
   */
  insertTextFormat?: InsertTextFormat;

  /**
   * How whitespace and indentation is handled during completion
   * item insertion. If not provided the client's default value depends on
   * the `textDocument.completion.insertTextMode` client capability.
   *
   * @since 3.16.0
   * @since 3.17.0 - support for `textDocument.completion.insertTextMode`
   */
  insertTextMode?: InsertTextMode;

  /**
   * An edit which is applied to a document when selecting this completion.
   * When an edit is provided the value of `insertText` is ignored.
   *
   * _Note:_ The range of the edit must be a single line range and it must
   * contain the position at which completion has been requested.
   *
   * Most editors support two different operations when accepting a completion
   * item. One is to insert a completion text and the other is to replace an
   * existing text with a completion text. Since this can usually not be
   * predetermined by a server it can report both ranges. Clients need to
   * signal support for `InsertReplaceEdit`s via the
   * `textDocument.completion.completionItem.insertReplaceSupport` client
   * capability property.
   *
   * _Note 1:_ The text edit's range as well as both ranges from an insert
   * replace edit must be a [single line] and they must contain the position
   * at which completion has been requested.
   * _Note 2:_ If an `InsertReplaceEdit` is returned the edit's insert range
   * must be a prefix of the edit's replace range, that means it must be
   * contained and starting at the same position.
   *
   * @since 3.16.0 additional type `InsertReplaceEdit`
   */
  textEdit?: TextEdit | InsertReplaceEdit;

  /**
   * The edit text used if the completion item is part of a CompletionList and
   * CompletionList defines an item default for the text edit range.
   *
   * Clients will only honor this property if they opt into completion list
   * item defaults using the capability `completionList.itemDefaults`.
   *
   * If not provided and a list's default range is provided the label
   * property is used as a text.
   *
   * @since 3.17.0
   */
  textEditText?: string;

  /**
   * An optional array of additional text edits that are applied when
   * selecting this completion. Edits must not overlap (including the same
   * insert position) with the main edit nor with themselves.
   *
   * Additional text edits should be used to change text unrelated to the
   * current cursor position (for example adding an import statement at the
   * top of the file if the completion item will insert an unqualified type).
   */
  additionalTextEdits?: readonly TextEdit[];

  /**
   * An optional set of characters that when pressed while this completion is
   * active will accept it first and then type that character. *Note* that all
   * commit characters should have `length=1` and that superfluous characters
   * will be ignored.
   */
  commitCharacters?: readonly string[];

  /**
   * An optional command that is executed *after* inserting this completion.
   * _Note_ that additional modifications to the current document should be
   * described with the additionalTextEdits-property.
   */
  command?: Command;

  /**
   * A data entry field that is preserved on a completion item between
   * a completion and a completion resolve request.
   */
  data?: LSPAny;
};

/**
 * The kind of a completion entry.
 */
export type CompletionItemKind = (typeof CompletionItemKind)[keyof typeof CompletionItemKind];
/**
 * The kind of a completion entry.
 */

export namespace CompletionItemKind {
  export const Text = 1;
  export const Method = 2;
  export const Function = 3;
  export const Constructor = 4;
  export const Field = 5;
  export const Variable = 6;
  export const Class = 7;
  export const Interface = 8;
  export const Module = 9;
  export const Property = 10;
  export const Unit = 11;
  export const Value = 12;
  export const Enum = 13;
  export const Keyword = 14;
  export const Snippet = 15;
  export const Color = 16;
  export const File = 17;
  export const Reference = 18;
  export const Folder = 19;
  export const EnumMember = 20;
  export const Constant = 21;
  export const Struct = 22;
  export const Event = 23;
  export const Operator = 24;
  export const TypeParameter = 25;
}

export type PublishDiagnosticsClientCapabilities = {
  /**
   * Whether the clients accepts diagnostics with related information.
   */
  relatedInformation?: boolean;

  /**
   * Client supports the tag property to provide meta data about a diagnostic.
   * Clients supporting tags have to handle unknown tags gracefully.
   *
   * @since 3.15.0
   */
  tagSupport?: {
    /**
     * The tags supported by the client.
     */
    valueSet: readonly DiagnosticTag[];
  };

  /**
   * Whether the client interprets the version property of the
   * `textDocument/publishDiagnostics` notification's parameter.
   *
   * @since 3.15.0
   */
  versionSupport?: boolean;

  /**
   * Client supports a codeDescription property
   *
   * @since 3.16.0
   */
  codeDescriptionSupport?: boolean;

  /**
   * Whether code action supports the `data` property which is
   * preserved between a `textDocument/publishDiagnostics` and
   * `textDocument/codeAction` request.
   *
   * @since 3.16.0
   */
  dataSupport?: boolean;
};

/**
 * Params of the `textDocument/publishDiagnostics` notification.
 */
export type PublishDiagnosticsParams = {
  /**
   * The URI for which diagnostic information is reported.
   */
  uri: DocumentUri;

  /**
   * Optional the version number of the document the diagnostics are published
   * for.
   *
   * @since 3.15.0
   */
  version?: integer;

  /**
   * An array of diagnostic information items.
   */
  diagnostics: Diagnostic[];
};

/**
 * Client capabilities specific to diagnostic pull requests.
 *
 * @since 3.17.0
 */
export type DiagnosticClientCapabilities = {
  /**
   * Whether implementation supports dynamic registration. If this is set to
   * `true` the client supports the new
   * `(TextDocumentRegistrationOptions & StaticRegistrationOptions)`
   * return value for the corresponding server capability as well.
   */
  dynamicRegistration?: boolean;

  /**
   * Whether the clients supports related documents for document diagnostic
   * pulls.
   */
  relatedDocumentSupport?: boolean;
};

/**
 * Diagnostic options.
 *
 * @since 3.17.0
 */
export interface DiagnosticOptions extends WorkDoneProgressOptions {
  /**
   * An optional identifier under which the diagnostics are
   * managed by the client.
   */
  identifier?: string;

  /**
   * Whether the language has inter file dependencies meaning that
   * editing code in one file can result in a different diagnostic
   * set in another file. Inter file dependencies are common for
   * most programming languages and typically uncommon for linters.
   */
  interFileDependencies: boolean;

  /**
   * The server provides support for workspace diagnostics as well.
   */
  workspaceDiagnostics: boolean;
}

/**
 * Diagnostic registration options.
 *
 * @since 3.17.0
 */
export interface DiagnosticRegistrationOptions
  extends TextDocumentRegistrationOptions,
    DiagnosticOptions,
    StaticRegistrationOptions {}

/**
 * Params of the `textDocument/diagnostic` request.
 *
 * @since 3.17.0
 */
export interface DocumentDiagnosticParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The additional identifier  provided during registration.
   */
  identifier?: string;

  /**
   * The result id of a previous response if provided.
   */
  previousResultId?: string;
}

/**
 * The result of a document diagnostic pull request. A report can
 * either be a full report containing all diagnostics for the
 * requested document or a unchanged report indicating that nothing
 * has changed in terms of diagnostics in comparison to the last
 * pull request.
 *
 * @since 3.17.0
 */
export type DocumentDiagnosticReport =
  | RelatedFullDocumentDiagnosticReport
  | RelatedUnchangedDocumentDiagnosticReport;

/**
 * The document diagnostic report kind.
 *
 * @since 3.17.0
 */
export type DocumentDiagnosticReportKind =
  (typeof DocumentDiagnosticReportKind)[keyof typeof DocumentDiagnosticReportKind];
/**
 * The document diagnostic report kinds.
 *
 * @since 3.17.0
 */

export namespace DocumentDiagnosticReportKind {
  /**
   * A diagnostic report with a full
   * set of problems.
   */
  export const Full = "full";

  /**
   * A report indicating that the last
   * returned report is still accurate.
   */
  export const Unchanged = "unchanged";
}

/**
 * A diagnostic report with a full set of problems.
 *
 * @since 3.17.0
 */
export type FullDocumentDiagnosticReport = {
  /**
   * A full document diagnostic report.
   */
  kind: typeof DocumentDiagnosticReportKind.Full;

  /**
   * An optional result id. If provided it will
   * be sent on the next diagnostic request for the
   * same document.
   */
  resultId?: string;

  /**
   * The actual items.
   */
  items: readonly Diagnostic[];
};

/**
 * A diagnostic report indicating that the last returned
 * report is still accurate.
 *
 * @since 3.17.0
 */
export type UnchangedDocumentDiagnosticReport = {
  /**
   * A document diagnostic report indicating
   * no changes to the last result. A server can
   * only return `unchanged` if result ids are
   * provided.
   */
  kind: typeof DocumentDiagnosticReportKind.Unchanged;

  /**
   * A result id which will be sent on the next
   * diagnostic request for the same document.
   */
  resultId: string;
};

/**
 * A full diagnostic report with a set of related documents.
 *
 * @since 3.17.0
 */
export interface RelatedFullDocumentDiagnosticReport extends FullDocumentDiagnosticReport {
  /**
   * Diagnostics of related documents. This information is useful
   * in programming languages where code in a file A can generate
   * diagnostics in a file B which A depends on. An example of
   * such a language is C/C++ where marco definitions in a file
   * a.cpp and result in errors in a header file b.hpp.
   *
   * @since 3.17.0
   */
  relatedDocuments?: {
    [uri: DocumentUri]: FullDocumentDiagnosticReport | UnchangedDocumentDiagnosticReport;
  };
}

/**
 * An unchanged diagnostic report with a set of related documents.
 *
 * @since 3.17.0
 */
export interface RelatedUnchangedDocumentDiagnosticReport
  extends UnchangedDocumentDiagnosticReport {
  /**
   * Diagnostics of related documents. This information is useful
   * in programming languages where code in a file A can generate
   * diagnostics in a file B which A depends on. An example of
   * such a language is C/C++ where marco definitions in a file
   * a.cpp and result in errors in a header file b.hpp.
   *
   * @since 3.17.0
   */
  relatedDocuments?: {
    [uri: DocumentUri]: FullDocumentDiagnosticReport | UnchangedDocumentDiagnosticReport;
  };
}

/**
 * A partial result for a document diagnostic report.
 *
 * @since 3.17.0
 */
export type DocumentDiagnosticReportPartialResult = {
  relatedDocuments: {
    [uri: DocumentUri]: FullDocumentDiagnosticReport | UnchangedDocumentDiagnosticReport;
  };
};

/**
 * Cancellation data returned from a diagnostic request.
 *
 * @since 3.17.0
 */
export type DiagnosticServerCancellationData = {
  retriggerRequest: boolean;
};

/**
 * Params of the `workspace/diagnostic` request.
 *
 * @since 3.17.0
 */
export interface WorkspaceDiagnosticParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The additional identifier provided during registration.
   */
  identifier?: string;

  /**
   * The currently known diagnostic reports with their
   * previous result ids.
   */
  previousResultIds: readonly PreviousResultId[];
}

/**
 * A previous result id in a workspace pull request.
 *
 * @since 3.17.0
 */
export type PreviousResultId = {
  /**
   * The URI for which the client knows a
   * result id.
   */
  uri: DocumentUri;

  /**
   * The value of the previous result id.
   */
  value: string;
};

/**
 * A workspace diagnostic report.
 *
 * @since 3.17.0
 */
export type WorkspaceDiagnosticReport = {
  items: readonly WorkspaceDocumentDiagnosticReport[];
};

/**
 * A full document diagnostic report for a workspace diagnostic result.
 *
 * @since 3.17.0
 */
export interface WorkspaceFullDocumentDiagnosticReport extends FullDocumentDiagnosticReport {
  /**
   * The URI for which diagnostic information is reported.
   */
  uri: DocumentUri;

  /**
   * The version number for which the diagnostics are reported.
   * If the document is not marked as open `null` can be provided.
   */
  version: integer | null;
}

/**
 * An unchanged document diagnostic report for a workspace diagnostic result.
 *
 * @since 3.17.0
 */
export interface WorkspaceUnchangedDocumentDiagnosticReport
  extends UnchangedDocumentDiagnosticReport {
  /**
   * The URI for which diagnostic information is reported.
   */
  uri: DocumentUri;

  /**
   * The version number for which the diagnostics are reported.
   * If the document is not marked as open `null` can be provided.
   */
  version: integer | null;
}

/**
 * A workspace diagnostic document report.
 *
 * @since 3.17.0
 */
export type WorkspaceDocumentDiagnosticReport =
  | WorkspaceFullDocumentDiagnosticReport
  | WorkspaceUnchangedDocumentDiagnosticReport;

/**
 * A partial result for a workspace diagnostic report.
 *
 * @since 3.17.0
 */
export type WorkspaceDiagnosticReportPartialResult = {
  items: readonly WorkspaceDocumentDiagnosticReport[];
};

/**
 * Workspace client capabilities specific to diagnostic pull requests.
 *
 * @since 3.17.0
 */
export type DiagnosticWorkspaceClientCapabilities = {
  /**
   * Whether the client implementation supports a refresh request sent from
   * the server to the client.
   *
   * Note that this event is global and will force the client to refresh all
   * pulled diagnostics currently shown. It should be used with absolute care
   * and is useful for situation where a server for example detects a project
   * wide change that requires such a calculation.
   */
  refreshSupport?: boolean;
};

export type SignatureHelpClientCapabilities = {
  /**
   * Whether signature help supports dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * The client supports the following `SignatureInformation`
   * specific properties.
   */
  signatureInformation?: {
    /**
     * Client supports the follow content formats for the documentation
     * property. The order describes the preferred format of the client.
     */
    documentationFormat?: MarkupKind[];

    /**
     * Client capabilities specific to parameter information.
     */
    parameterInformation?: {
      /**
       * The client supports processing label offsets instead of a
       * simple label string.
       *
       * @since 3.14.0
       */
      labelOffsetSupport?: boolean;
    };

    /**
     * The client supports the `activeParameter` property on
     * `SignatureInformation` literal.
     *
     * @since 3.16.0
     */
    activeParameterSupport?: boolean;
  };

  /**
   * The client supports to send additional context information for a
   * `textDocument/signatureHelp` request. A client that opts into
   * contextSupport will also support the `retriggerCharacters` on
   * `SignatureHelpOptions`.
   *
   * @since 3.15.0
   */
  contextSupport?: boolean;
};

export interface SignatureHelpOptions extends WorkDoneProgressOptions {
  /**
   * The characters that trigger signature help
   * automatically.
   */
  triggerCharacters?: readonly string[];

  /**
   * List of characters that re-trigger signature help.
   *
   * These trigger characters are only active when signature help is already
   * showing. All trigger characters are also counted as re-trigger
   * characters.
   *
   * @since 3.15.0
   */
  retriggerCharacters?: readonly string[];
}

export interface SignatureHelpRegistrationOptions
  extends TextDocumentRegistrationOptions,
    SignatureHelpOptions {}

export interface SignatureHelpParams extends TextDocumentPositionParams, WorkDoneProgressParams {
  /**
   * The signature help context. This is only available if the client
   * specifies to send this using the client capability
   * `textDocument.signatureHelp.contextSupport === true`
   *
   * @since 3.15.0
   */
  context?: SignatureHelpContext;
}

/**
 * How a signature help was triggered.
 *
 * @since 3.15.0
 */
export type SignatureHelpTriggerKind =
  (typeof SignatureHelpTriggerKind)[keyof typeof SignatureHelpTriggerKind];
/**
 * How a signature help was triggered.
 *
 * @since 3.15.0
 */

export namespace SignatureHelpTriggerKind {
  /**
   * Signature help was invoked manually by the user or by a command.
   */
  export const Invoked = 1;
  /**
   * Signature help was triggered by a trigger character.
   */
  export const TriggerCharacter = 2;
  /**
   * Signature help was triggered by the cursor moving or by the document
   * content changing.
   */
  export const ContentChange = 3;
}

/**
 * Additional information about the context in which a signature help request
 * was triggered.
 *
 * @since 3.15.0
 */
export type SignatureHelpContext = {
  /**
   * Action that caused signature help to be triggered.
   */
  triggerKind: SignatureHelpTriggerKind;

  /**
   * Character that caused signature help to be triggered.
   *
   * This is undefined when triggerKind !==
   * SignatureHelpTriggerKind.TriggerCharacter
   */
  triggerCharacter?: string;

  /**
   * `true` if signature help was already showing when it was triggered.
   *
   * Retriggers occur when the signature help is already active and can be
   * caused by actions such as typing a trigger character, a cursor move, or
   * document content changes.
   */
  isRetrigger: boolean;

  /**
   * The currently active `SignatureHelp`.
   *
   * The `activeSignatureHelp` has its `SignatureHelp.activeSignature` field
   * updated based on the user navigating through available signatures.
   */
  activeSignatureHelp?: SignatureHelp;
};

/**
 * Signature help represents the signature of something callable. There can be multiple signature
 * but only one active and only one active parameter.
 */
export type SignatureHelp = {
  /**
   * One or more signatures. If no signatures are available the signature help
   * request should return `null`.
   */
  signatures: readonly SignatureInformation[];

  /**
   * The active signature. If omitted or the value lies outside the
   * range of `signatures` the value defaults to zero or is ignore if
   * the `SignatureHelp` as no signatures.
   *
   * Whenever possible implementors should make an active decision about
   * the active signature and shouldn't rely on a default value.
   *
   * In future version of the protocol this property might become
   * mandatory to better express this.
   */
  activeSignature?: uinteger;

  /**
   * The active parameter of the active signature. If omitted or the value
   * lies outside the range of `signatures[activeSignature].parameters`
   * defaults to 0 if the active signature has parameters. If
   * the active signature has no parameters it is ignored.
   * In future version of the protocol this property might become
   * mandatory to better express the active parameter if the
   * active signature does have any.
   */
  activeParameter?: uinteger;
};

/**
 * Represents the signature of something callable. A signature
 * can have a label, like a function-name, a doc-comment, and
 * a set of parameters.
 */
export type SignatureInformation = {
  /**
   * The label of this signature. Will be shown in
   * the UI.
   */
  label: string;

  /**
   * The human-readable doc-comment of this signature. Will be shown
   * in the UI but can be omitted.
   */
  documentation?: string | MarkupContent;

  /**
   * The parameters of this signature.
   */
  parameters?: readonly ParameterInformation[];

  /**
   * The index of the active parameter.
   *
   * If provided, this is used in place of `SignatureHelp.activeParameter`.
   *
   * @since 3.16.0
   */
  activeParameter?: uinteger;
};

/**
 * Represents a parameter of a callable-signature. A parameter can
 * have a label and a doc-comment.
 */
export type ParameterInformation = {
  /**
   * The label of this parameter information.
   *
   * Either a string or an inclusive start and exclusive end offsets within
   * its containing signature label. (see SignatureInformation.label). The
   * offsets are based on a UTF-16 string representation as `Position` and
   * `Range` does.
   *
   * _Note_: a label of type string should be a substring of its containing
   * signature label. Its intended use case is to highlight the parameter
   * label part in the `SignatureInformation.label`.
   */
  label: string | readonly [uinteger, uinteger];

  /**
   * The human-readable doc-comment of this parameter. Will be shown
   * in the UI but can be omitted.
   */
  documentation?: string | MarkupContent;
};

export type CodeActionClientCapabilities = {
  /**
   * Whether code action supports dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * The client supports code action literals as a valid
   * response of the `textDocument/codeAction` request.
   *
   * @since 3.8.0
   */
  codeActionLiteralSupport?: {
    /**
     * The code action kind is supported with the following value
     * set.
     */
    codeActionKind: {
      /**
       * The code action kind values the client supports. When this
       * property exists the client also guarantees that it will
       * handle values outside its set gracefully and falls back
       * to a default value when unknown.
       */
      valueSet: readonly CodeActionKind[];
    };
  };

  /**
   * Whether code action supports the `isPreferred` property.
   *
   * @since 3.15.0
   */
  isPreferredSupport?: boolean;

  /**
   * Whether code action supports the `disabled` property.
   *
   * @since 3.16.0
   */
  disabledSupport?: boolean;

  /**
   * Whether code action supports the `data` property which is
   * preserved between a `textDocument/codeAction` and a
   * `codeAction/resolve` request.
   *
   * @since 3.16.0
   */
  dataSupport?: boolean;

  /**
   * Whether the client supports resolving additional code action
   * properties via a separate `codeAction/resolve` request.
   *
   * @since 3.16.0
   */
  resolveSupport?: {
    /**
     * The properties that a client can resolve lazily.
     */
    properties: readonly string[];
  };

  /**
   * Whether the client honors the change annotations in
   * text edits and resource operations returned via the
   * `CodeAction#edit` property by for example presenting
   * the workspace edit in the user interface and asking
   * for confirmation.
   *
   * @since 3.16.0
   */
  honorsChangeAnnotations?: boolean;
};

export interface CodeActionOptions extends WorkDoneProgressOptions {
  /**
   * CodeActionKinds that this server may return.
   *
   * The list of kinds may be generic, such as `CodeActionKind.Refactor`,
   * or the server may list out every specific kind they provide.
   */
  codeActionKinds?: readonly CodeActionKind[];

  /**
   * The server provides support to resolve additional
   * information for a code action.
   *
   * @since 3.16.0
   */
  resolveProvider?: boolean;
}

export interface CodeActionRegistrationOptions
  extends TextDocumentRegistrationOptions,
    CodeActionOptions {}

/**
 * Params for the CodeActionRequest
 */
export interface CodeActionParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The document in which the command was invoked.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The range for which the command was invoked.
   */
  range: Range;

  /**
   * Context carrying additional information.
   */
  context: CodeActionContext;
}

/**
 * The kind of a code action.
 *
 * Kinds are a hierarchical list of identifiers separated by `.`,
 * e.g. `"refactor.extract.function"`.
 *
 * The set of kinds is open and client needs to announce the kinds it supports
 * to the server during initialization.
 */
export type CodeActionKind = string;
/**
 * A set of predefined code action kinds.
 */

export namespace CodeActionKind {
  /**
   * Empty kind.
   */
  export const Empty = "";

  /**
   * Base kind for quickfix actions: 'quickfix'.
   */
  export const QuickFix = "quickfix";

  /**
   * Base kind for refactoring actions: 'refactor'.
   */
  export const Refactor = "refactor";

  /**
   * Base kind for refactoring extraction actions: 'refactor.extract'.
   *
   * Example extract actions:
   *
   * - Extract method
   * - Extract function
   * - Extract variable
   * - Extract interface from class
   * - ...
   */
  export const RefactorExtract = "refactor.extract";

  /**
   * Base kind for refactoring inline actions: 'refactor.inline'.
   *
   * Example inline actions:
   *
   * - Inline function
   * - Inline variable
   * - Inline constant
   * - ...
   */
  export const RefactorInline = "refactor.inline";

  /**
   * Base kind for refactoring rewrite actions: 'refactor.rewrite'.
   *
   * Example rewrite actions:
   *
   * - Convert JavaScript function to class
   * - Add or remove parameter
   * - Encapsulate field
   * - Make method static
   * - Move method to base class
   * - ...
   */
  export const RefactorRewrite = "refactor.rewrite";

  /**
   * Base kind for source actions: `source`.
   *
   * Source code actions apply to the entire file.
   */
  export const Source = "source";

  /**
   * Base kind for an organize imports source action:
   * `source.organizeImports`.
   */
  export const SourceOrganizeImports = "source.organizeImports";

  /**
   * Base kind for a 'fix all' source action: `source.fixAll`.
   *
   * 'Fix all' actions automatically fix errors that have a clear fix that
   * do not require user input. They should not suppress errors or perform
   * unsafe fixes such as generating new types or classes.
   *
   * @since 3.17.0
   */
  export const SourceFixAll = "source.fixAll";
}

/**
 * Contains additional diagnostic information about the context in which
 * a code action is run.
 */
export type CodeActionContext = {
  /**
   * An array of diagnostics known on the client side overlapping the range
   * provided to the `textDocument/codeAction` request. They are provided so
   * that the server knows which errors are currently presented to the user
   * for the given range. There is no guarantee that these accurately reflect
   * the error state of the resource. The primary parameter
   * to compute code actions is the provided range.
   */
  diagnostics: readonly Diagnostic[];

  /**
   * Requested kind of actions to return.
   *
   * Actions not of this kind are filtered out by the client before being
   * shown. So servers can omit computing them.
   */
  only?: readonly CodeActionKind[];

  /**
   * The reason why code actions were requested.
   *
   * @since 3.17.0
   */
  triggerKind?: CodeActionTriggerKind;
};

/**
 * The reason why code actions were requested.
 *
 * @since 3.17.0
 */
export type CodeActionTriggerKind =
  (typeof CodeActionTriggerKind)[keyof typeof CodeActionTriggerKind];
/**
 * The reason why code actions were requested.
 *
 * @since 3.17.0
 */

export namespace CodeActionTriggerKind {
  /**
   * Code actions were explicitly requested by the user or by an extension.
   */
  export const Invoked = 1;

  /**
   * Code actions were requested automatically.
   *
   * This typically happens when current selection in a file changes, but can
   * also be triggered when file content changes.
   */
  export const Automatic = 2;
}

/**
 * A code action represents a change that can be performed in code, e.g. to fix
 * a problem or to refactor code.
 *
 * A CodeAction must set either `edit` and/or a `command`. If both are supplied,
 * the `edit` is applied first, then the `command` is executed.
 */
export type CodeAction = {
  /**
   * A short, human-readable, title for this code action.
   */
  title: string;

  /**
   * The kind of the code action.
   *
   * Used to filter code actions.
   */
  kind?: CodeActionKind;

  /**
   * The diagnostics that this code action resolves.
   */
  diagnostics?: readonly Diagnostic[];

  /**
   * Marks this as a preferred action. Preferred actions are used by the
   * `auto fix` command and can be targeted by keybindings.
   *
   * A quick fix should be marked preferred if it properly addresses the
   * underlying error. A refactoring should be marked preferred if it is the
   * most reasonable choice of actions to take.
   *
   * @since 3.15.0
   */
  isPreferred?: boolean;

  /**
   * Marks that the code action cannot currently be applied.
   *
   * Clients should follow the following guidelines regarding disabled code
   * actions:
   *
   * - Disabled code actions are not shown in automatic lightbulbs code
   *   action menus.
   *
   * - Disabled actions are shown as faded out in the code action menu when
   *   the user request a more specific type of code action, such as
   *   refactorings.
   *
   * - If the user has a keybinding that auto applies a code action and only
   *   a disabled code actions are returned, the client should show the user
   *   an error message with `reason` in the editor.
   *
   * @since 3.16.0
   */
  disabled?: {
    /**
     * Human readable description of why the code action is currently
     * disabled.
     *
     * This is displayed in the code actions UI.
     */
    reason: string;
  };

  /**
   * The workspace edit this code action performs.
   */
  edit?: WorkspaceEdit;

  /**
   * A command this code action executes. If a code action
   * provides an edit and a command, first the edit is
   * executed and then the command.
   */
  command?: Command;

  /**
   * A data entry field that is preserved on a code action between
   * a `textDocument/codeAction` and a `codeAction/resolve` request.
   *
   * @since 3.16.0
   */
  data?: LSPAny;
};

export type DocumentColorClientCapabilities = {
  /**
   * Whether document color supports dynamic registration.
   */
  dynamicRegistration?: boolean;
};

export interface DocumentColorOptions extends WorkDoneProgressOptions {}

export interface DocumentColorRegistrationOptions
  extends TextDocumentRegistrationOptions,
    StaticRegistrationOptions,
    DocumentColorOptions {}

/**
 * Params of the `textDocument/documentColor` request.
 */
export interface DocumentColorParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;
}

export type ColorInformation = {
  /**
   * The range in the document where this color appears.
   */
  range: Range;

  /**
   * The actual color value for this color range.
   */
  color: Color;
};

/**
 * Represents a color in RGBA space.
 */
export type Color = {
  /**
   * The red component of this color in the range [0-1].
   */
  readonly red: decimal;

  /**
   * The green component of this color in the range [0-1].
   */
  readonly green: decimal;

  /**
   * The blue component of this color in the range [0-1].
   */
  readonly blue: decimal;

  /**
   * The alpha component of this color in the range [0-1].
   */
  readonly alpha: decimal;
};

/**
 * Params of the `textDocument/colorPresentation` request.
 */
export interface ColorPresentationParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The color information to request presentations for.
   */
  color: Color;

  /**
   * The range where the color would be inserted. Serves as a context.
   */
  range: Range;
}

export type ColorPresentation = {
  /**
   * The label of this color presentation. It will be shown on the color
   * picker header. By default this is also the text that is inserted when
   * selecting this color presentation.
   */
  label: string;
  /**
   * An [edit](#TextEdit) which is applied to a document when selecting
   * this presentation for the color. When omitted the
   * [label](#ColorPresentation.label) is used.
   */
  textEdit?: TextEdit;
  /**
   * An optional array of additional [text edits](#TextEdit) that are applied
   * when selecting this color presentation. Edits must not overlap with the
   * main [edit](#ColorPresentation.textEdit) nor with themselves.
   */
  additionalTextEdits?: readonly TextEdit[];
};

export type DocumentFormattingClientCapabilities = {
  /**
   * Whether formatting supports dynamic registration.
   */
  dynamicRegistration?: boolean;
};

export interface DocumentFormattingOptions extends WorkDoneProgressOptions {}

export interface DocumentFormattingRegistrationOptions
  extends TextDocumentRegistrationOptions,
    DocumentFormattingOptions {}

/**
 * Params of the `textDocument/formatting` request.
 */
export interface DocumentFormattingParams extends WorkDoneProgressParams {
  /**
   * The document to format.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The format options.
   */
  options: FormattingOptions;
}

/**
 * Value-object describing what options formatting should use.
 */
export type FormattingOptions = {
  /**
   * Size of a tab in spaces.
   */
  tabSize: uinteger;

  /**
   * Prefer spaces over tabs.
   */
  insertSpaces: boolean;

  /**
   * Trim trailing whitespace on a line.
   *
   * @since 3.15.0
   */
  // @ts-expect-error - Index type overridden
  trimTrailingWhitespace?: boolean;

  /**
   * Insert a newline character at the end of the file if one does not exist.
   *
   * @since 3.15.0
   */
  // @ts-expect-error - Index type overridden
  insertFinalNewline?: boolean;

  /**
   * Trim all newlines after the final newline at the end of the file.
   *
   * @since 3.15.0
   */
  // @ts-expect-error - Index type overridden
  trimFinalNewlines?: boolean;

  /**
   * Signature for further properties.
   */
  [key: string]: boolean | integer | string;
};

export type DocumentRangeFormattingClientCapabilities = {
  /**
   * Whether formatting supports dynamic registration.
   */
  dynamicRegistration?: boolean;
};

export interface DocumentRangeFormattingOptions extends WorkDoneProgressOptions {}

export interface DocumentRangeFormattingRegistrationOptions
  extends TextDocumentRegistrationOptions,
    DocumentRangeFormattingOptions {}

/**
 * Params of the `textDocument/rangeFormatting` request.
 */
export interface DocumentRangeFormattingParams extends WorkDoneProgressParams {
  /**
   * The document to format.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The range to format
   */
  range: Range;

  /**
   * The format options
   */
  options: FormattingOptions;
}

export type DocumentOnTypeFormattingClientCapabilities = {
  /**
   * Whether on type formatting supports dynamic registration.
   */
  dynamicRegistration?: boolean;
};

export type DocumentOnTypeFormattingOptions = {
  /**
   * A character on which formatting should be triggered, like `{`.
   */
  firstTriggerCharacter: string;

  /**
   * More trigger characters.
   */
  moreTriggerCharacter?: readonly string[];
};

export interface DocumentOnTypeFormattingRegistrationOptions
  extends TextDocumentRegistrationOptions,
    DocumentOnTypeFormattingOptions {}

/**
 * Params of the `textDocument/onTypeFormatting` request.
 */
export type DocumentOnTypeFormattingParams = {
  /**
   * The document to format.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The position around which the on type formatting should happen.
   * This is not necessarily the exact position where the character denoted
   * by the property `ch` got typed.
   */
  position: Position;

  /**
   * The character that has been typed that triggered the formatting
   * on type request. That is not necessarily the last character that
   * got inserted into the document since the client could auto insert
   * characters as well (e.g. like automatic brace completion).
   */
  ch: string;

  /**
   * The formatting options.
   */
  options: FormattingOptions;
};

export type PrepareSupportDefaultBehavior =
  (typeof PrepareSupportDefaultBehavior)[keyof typeof PrepareSupportDefaultBehavior];

export namespace PrepareSupportDefaultBehavior {
  /**
   * The client's default behavior is to select the identifier
   * according to the language's syntax rule.
   */
  export const Identifier = 1;
}

export type RenameClientCapabilities = {
  /**
   * Whether rename supports dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * Client supports testing for validity of rename operations
   * before execution.
   *
   * @since version 3.12.0
   */
  prepareSupport?: boolean;

  /**
   * Client supports the default behavior result
   * (`{ defaultBehavior: boolean }`).
   *
   * The value indicates the default behavior used by the
   * client.
   *
   * @since version 3.16.0
   */
  prepareSupportDefaultBehavior?: PrepareSupportDefaultBehavior;

  /**
   * Whether the client honors the change annotations in
   * text edits and resource operations returned via the
   * rename request's workspace edit by for example presenting
   * the workspace edit in the user interface and asking
   * for confirmation.
   *
   * @since 3.16.0
   */
  honorsChangeAnnotations?: boolean;
};

export interface RenameOptions extends WorkDoneProgressOptions {
  /**
   * Renames should be checked and tested before being executed.
   */
  prepareProvider?: boolean;
}

export interface RenameRegistrationOptions extends TextDocumentRegistrationOptions, RenameOptions {}

/**
 * Params of the `textDocument/rename` request.
 */
export interface RenameParams extends TextDocumentPositionParams, WorkDoneProgressParams {
  /**
   * The new name of the symbol. If the given name is not valid the
   * request must return a [ResponseError](#ResponseError) with an
   * appropriate message set.
   */
  newName: string;
}

/**
 * Params of the `textDocument/prepareRename` request.
 */
export interface PrepareRenameParams extends TextDocumentPositionParams, WorkDoneProgressParams {}

export interface LinkedEditingRangeOptions extends WorkDoneProgressOptions {}

export interface LinkedEditingRangeRegistrationOptions
  extends TextDocumentRegistrationOptions,
    LinkedEditingRangeOptions,
    StaticRegistrationOptions {}

export type LinkedEditingRangeClientCapabilities = {
  /**
   * Whether the implementation supports dynamic registration.
   * If this is set to `true` the client supports the new
   * `(TextDocumentRegistrationOptions & StaticRegistrationOptions)`
   * return value for the corresponding server capability as well.
   */
  dynamicRegistration?: boolean;
};

/**
 * Params of the `textDocument/linkedEditingRange` request.
 */
export interface LinkedEditingRangeParams
  extends TextDocumentPositionParams,
    WorkDoneProgressParams {}

export type LinkedEditingRanges = {
  /**
   * A list of ranges that can be renamed together. The ranges must have
   * identical length and contain identical text content. The ranges cannot
   * overlap.
   */
  ranges: readonly Range[];

  /**
   * An optional word pattern (regular expression) that describes valid
   * contents for the given ranges. If no pattern is provided, the client
   * configuration's word pattern will be used.
   */
  wordPattern?: string;
};

/**********************
 * Workspace Features *
 **********************/
/**
 * Workspace symbol client capabilities.
 */
export type WorkspaceSymbolClientCapabilities = {
  /**
   * Symbol request supports dynamic registration.
   */
  dynamicRegistration?: boolean;

  /**
   * Specific capabilities for the `SymbolKind` in the `workspace/symbol`
   * request.
   */
  symbolKind?: {
    /**
     * The symbol kind values the client supports. When this
     * property exists the client also guarantees that it will
     * handle values outside its set gracefully and falls back
     * to a default value when unknown.
     *
     * If this property is not present the client only supports
     * the symbol kinds from `File` to `Array` as defined in
     * the initial version of the protocol.
     */
    valueSet?: readonly SymbolKind[];
  };

  /**
   * The client supports tags on `SymbolInformation` and `WorkspaceSymbol`.
   * Clients supporting tags have to handle unknown tags gracefully.
   *
   * @since 3.16.0
   */
  tagSupport?: {
    /**
     * The tags supported by the client.
     */
    valueSet: readonly SymbolTag[];
  };

  /**
   * The client support partial workspace symbols. The client will send the
   * request `workspaceSymbol/resolve` to the server to resolve additional
   * properties.
   *
   * @since 3.17.0 - proposedState
   */
  resolveSupport?: {
    /**
     * The properties that a client can resolve lazily. Usually
     * `location.range`
     */
    properties: readonly string[];
  };
};

export interface WorkspaceSymbolOptions extends WorkDoneProgressOptions {
  /**
   * The server provides support to resolve additional
   * information for a workspace symbol.
   *
   * @since 3.17.0
   */
  resolveProvider?: boolean;
}

export interface WorkspaceSymbolRegistrationOptions extends WorkspaceSymbolOptions {}

/**
 * Params of the `workspace/symbol` request.
 */
export interface WorkspaceSymbolParams extends WorkDoneProgressParams, PartialResultParams {
  /**
   * A query string to filter symbols by. Clients may send an empty
   * string here to request all symbols.
   */
  query: string;
}

/**
 * A special workspace symbol that supports locations without a range
 *
 * @since 3.17.0
 */
export type WorkspaceSymbol = {
  /**
   * The name of this symbol.
   */
  name: string;

  /**
   * The kind of this symbol.
   */
  kind: SymbolKind;

  /**
   * Tags for this completion item.
   */
  tags?: readonly SymbolTag[];

  /**
   * The name of the symbol containing this symbol. This information is for
   * user interface purposes (e.g. to render a qualifier in the user interface
   * if necessary). It can't be used to re-infer a hierarchy for the document
   * symbols.
   */
  containerName?: string;

  /**
   * The location of this symbol. Whether a server is allowed to
   * return a location without a range depends on the client
   * capability `workspace.symbol.resolveSupport`.
   *
   * See also `SymbolInformation.location`.
   */
  location: Location | { uri: DocumentUri };

  /**
   * A data entry field that is preserved on a workspace symbol between a
   * workspace symbol request and a workspace symbol resolve request.
   */
  data?: LSPAny;
};

/**
 * Params of the `workspace/configuration` request.
 */
export type ConfigurationParams = {
  items: readonly ConfigurationItem[];
};

export type ConfigurationItem = {
  /**
   * The scope to get the configuration section for.
   */
  scopeUri?: URI;

  /**
   * The configuration section asked for.
   */
  section?: string;
};

export type DidChangeConfigurationClientCapabilities = {
  /**
   * Did change configuration notification supports dynamic registration.
   */
  dynamicRegistration?: boolean;
};

/**
 * Params of the `workspace/didChangeConfiguration` notification.
 */
export type DidChangeConfigurationParams = {
  /**
   * The actual changed settings
   */
  settings: LSPAny;
};

export type WorkspaceFoldersServerCapabilities = {
  /**
   * The server has support for workspace folders
   */
  supported?: boolean;

  /**
   * Whether the server wants to receive workspace folder
   * change notifications.
   *
   * If a string is provided, the string is treated as an ID
   * under which the notification is registered on the client
   * side. The ID can be used to unregister for these events
   * using the `client/unregisterCapability` request.
   */
  changeNotifications?: string | boolean;
};

export type WorkspaceFolder = {
  /**
   * The associated URI for this workspace folder.
   */
  uri: URI;

  /**
   * The name of the workspace folder. Used to refer to this
   * workspace folder in the user interface.
   */
  name: string;
};

/**
 * Params of the `workspace/didChangeWorkspaceFolders` notification.
 */
export type DidChangeWorkspaceFoldersParams = {
  /**
   * The actual workspace folder change event.
   */
  event: WorkspaceFoldersChangeEvent;
};

/**
 * The workspace folder change event.
 */
export type WorkspaceFoldersChangeEvent = {
  /**
   * The array of added workspace folders
   */
  added: readonly WorkspaceFolder[];

  /**
   * The array of the removed workspace folders
   */
  removed: readonly WorkspaceFolder[];
};

/**
 * The options to register for file operations.
 *
 * @since 3.16.0
 */
export type FileOperationRegistrationOptions = {
  /**
   * The actual filters.
   */
  filters: readonly FileOperationFilter[];
};

/**
 * A pattern kind describing if a glob pattern matches a file a folder or both.
 *
 * @since 3.16.0
 */
export type FileOperationPatternKind =
  (typeof FileOperationPatternKind)[keyof typeof FileOperationPatternKind];
/**
 * A pattern kind describing if a glob pattern matches a file a folder or both.
 *
 * @since 3.16.0
 */

export namespace FileOperationPatternKind {
  /**
   * The pattern matches a file only.
   */
  export const file = "file";

  /**
   * The pattern matches a folder only.
   */
  export const folder = "folder";
}

/**
 * Matching options for the file operation pattern.
 *
 * @since 3.16.0
 */
export type FileOperationPatternOptions = {
  /**
   * The pattern should be matched ignoring casing.
   */
  ignoreCase?: boolean;
};

/**
 * A pattern to describe in which file operation requests or notifications
 * the server is interested in.
 *
 * @since 3.16.0
 */
export type FileOperationPattern = {
  /* eslint-disable no-irregular-whitespace */
  /**
   * The glob pattern to match. Glob patterns can have the following syntax:
   * - `*` to match one or more characters in a path segment
   * - `?` to match on one character in a path segment
   * - `**` to match any number of path segments, including none
   * - `{}` to group sub patterns into an OR expression. (e.g. `**​/*.{ts,js}`
   *   matches all TypeScript and JavaScript files)
   * - `[]` to declare a range of characters to match in a path segment
   *   (e.g., `example.[0-9]` to match on `example.0`, `example.1`, …)
   * - `[!...]` to negate a range of characters to match in a path segment
   *   (e.g., `example.[!0-9]` to match on `example.a`, `example.b`, but
   *   not `example.0`)
   */
  /* eslint-enable no-irregular-whitespace */
  glob: string;

  /**
   * Whether to match files or folders with this pattern.
   *
   * Matches both if undefined.
   */
  matches?: FileOperationPatternKind;

  /**
   * Additional options used during matching.
   */
  options?: FileOperationPatternOptions;
};

/**
 * A filter to describe in which file operation requests or notifications
 * the server is interested in.
 *
 * @since 3.16.0
 */
export type FileOperationFilter = {
  /**
   * A Uri like `file` or `untitled`.
   */
  scheme?: string;

  /**
   * The actual file operation pattern.
   */
  pattern: FileOperationPattern;
};

/**
 * The parameters sent in notifications/requests for user-initiated creation of files.
 *
 * @since 3.16.0
 */
export type CreateFilesParams = {
  /**
   * An array of all files/folders created in this operation.
   */
  files: readonly FileCreate[];
};

/**
 * Represents information on a file/folder create.
 *
 * @since 3.16.0
 */
export type FileCreate = {
  /**
   * A file:// URI for the location of the file/folder being created.
   */
  uri: string;
};

/**
 * The parameters sent in notifications/requests for user-initiated renames of files.
 *
 * @since 3.16.0
 */
export type RenameFilesParams = {
  /**
   * An array of all files/folders renamed in this operation. When a folder
   * is renamed, only the folder will be included, and not its children.
   */
  files: readonly FileRename[];
};

/**
 * Represents information on a file/folder rename.
 *
 * @since 3.16.0
 */
export type FileRename = {
  /**
   * A file:// URI for the original location of the file/folder being renamed.
   */
  oldUri: string;

  /**
   * A file:// URI for the new location of the file/folder being renamed.
   */
  newUri: string;
};

/**
 * The parameters sent in notifications/requests for user-initiated deletes of files.
 *
 * @since 3.16.0
 */
export type DeleteFilesParams = {
  /**
   * An array of all files/folders deleted in this operation.
   */
  files: readonly FileDelete[];
};

/**
 * Represents information on a file/folder delete.
 *
 * @since 3.16.0
 */
export type FileDelete = {
  /**
   * A file:// URI for the location of the file/folder being deleted.
   */
  uri: string;
};

export type DidChangeWatchedFilesClientCapabilities = {
  /**
   * Did change watched files notification supports dynamic registration.
   * Please note that the current protocol doesn't support static
   * configuration for file changes from the server side.
   */
  dynamicRegistration?: boolean;

  /**
   * Whether the client has support for relative patterns
   * or not.
   *
   * @since 3.17.0
   */
  relativePatternSupport?: boolean;
};

/**
 * Describe options to be used when registering for file system change events.
 */
export type DidChangeWatchedFilesRegistrationOptions = {
  /**
   * The watchers to register.
   */
  watchers: readonly FileSystemWatcher[];
};

/* eslint-disable no-irregular-whitespace */
/**
 * The glob pattern to watch relative to the base path. Glob patterns can have
 * the following syntax:
 * - `*` to match one or more characters in a path segment
 * - `?` to match on one character in a path segment
 * - `**` to match any number of path segments, including none
 * - `{}` to group conditions (e.g. `**​/*.{ts,js}` matches all TypeScript
 *   and JavaScript files)
 * - `[]` to declare a range of characters to match in a path segment
 *   (e.g., `example.[0-9]` to match on `example.0`, `example.1`, …)
 * - `[!...]` to negate a range of characters to match in a path segment
 *   (e.g., `example.[!0-9]` to match on `example.a`, `example.b`,
 *   but not `example.0`)
 *
 * @since 3.17.0
 */
/* eslint-enable no-irregular-whitespace */
export type Pattern = string;

/**
 * A relative pattern is a helper to construct glob patterns that are matched
 * relatively to a base URI. The common value for a `baseUri` is a workspace
 * folder root, but it can be another absolute URI as well.
 *
 * @since 3.17.0
 */
export type RelativePattern = {
  /**
   * A workspace folder or a base URI to which this pattern will be matched
   * against relatively.
   */
  baseUri: WorkspaceFolder | URI;

  /**
   * The actual glob pattern;
   */
  pattern: Pattern;
};

/**
 * The glob pattern. Either a string pattern or a relative pattern.
 *
 * @since 3.17.0
 */
export type GlobPattern = Pattern | RelativePattern;

export type FileSystemWatcher = {
  /**
   * The glob pattern to watch. See {@link GlobPattern glob pattern}
   * for more detail.
   *
   * @since 3.17.0 support for relative patterns.
   */
  globPattern: GlobPattern;

  /**
   * The kind of events of interest. If omitted it defaults
   * to WatchKind.Create | WatchKind.Change | WatchKind.Delete
   * which is 7.
   */
  kind?: WatchKind;
};

export type WatchKind = (typeof WatchKind)[keyof typeof WatchKind];

export namespace WatchKind {
  /**
   * Interested in create events.
   */
  export const Create = 1;

  /**
   * Interested in change events
   */
  export const Change = 2;

  /**
   * Interested in delete events
   */
  export const Delete = 4;
}

/**
 * Params of the `workspace/didChangeWatchedFiles` notification.
 */
export type DidChangeWatchedFilesParams = {
  /**
   * The actual file events.
   */
  changes: readonly FileEvent[];
};

/**
 * An event describing a file change.
 */
type FileEvent = {
  /**
   * The file's URI.
   */
  uri: DocumentUri;
  /**
   * The change type.
   */
  type: FileChangeType;
};

/**
 * The file event type.
 */
export type FileChangeType = (typeof FileChangeType)[keyof typeof FileChangeType];
/**
 * The file event type.
 */

export namespace FileChangeType {
  /**
   * The file got created.
   */
  export const Created = 1;
  /**
   * The file got changed.
   */
  export const Changed = 2;
  /**
   * The file got deleted.
   */
  export const Deleted = 3;
}

export type ExecuteCommandClientCapabilities = {
  /**
   * Execute command supports dynamic registration.
   */
  dynamicRegistration?: boolean;
};
export interface ExecuteCommandOptions extends WorkDoneProgressOptions {
  /**
   * The commands to be executed on the server
   */
  commands: readonly string[];
}

/**
 * Execute command registration options.
 */
export interface ExecuteCommandRegistrationOptions extends ExecuteCommandOptions {}

/**
 * Params of the `workspace/executeCommand` request.
 */
export interface ExecuteCommandParams extends WorkDoneProgressParams {
  /**
   * The identifier of the actual command handler.
   */
  command: string;
  /**
   * Arguments that the command should be invoked with.
   */
  arguments?: readonly LSPAny[];
}

/**
 * Params of the `workspace/applyEdit` request.
 */
export type ApplyWorkspaceEditParams = {
  /**
   * An optional label of the workspace edit. This label is
   * presented in the user interface for example on an undo
   * stack to undo the workspace edit.
   */
  label?: string;

  /**
   * The edits to apply.
   */
  edit: WorkspaceEdit;
};

/**
 * Result of the `workspace/applyEdit` request.
 */
export type ApplyWorkspaceEditResult = {
  /**
   * Indicates whether the edit was applied or not.
   */
  applied: boolean;

  /**
   * An optional textual description for why the edit was not applied.
   * This may be used by the server for diagnostic logging or to provide
   * a suitable error for a request that triggered the edit.
   */
  failureReason?: string;

  /**
   * Depending on the client's failure handling strategy `failedChange`
   * might contain the index of the change that failed. This property is
   * only available if the client signals a `failureHandling` strategy
   * in its client capabilities.
   */
  failedChange?: uinteger;
};

/*******************
 * Window Features *
 *******************/
/**
 * Params of the `window/showMessage` notification.
 */
export type ShowMessageParams = {
  /**
   * The message type. See {@link MessageType}.
   */
  type: MessageType;

  /**
   * The actual message.
   */
  message: string;
};

/**
 * Message type of the `window/showMessage`, `window/showMessageRequest` and `window/logMessage`
 * request.
 */
export type MessageType = (typeof MessageType)[keyof typeof MessageType];
/**
 * Message type of the `window/showMessage`, `window/showMessageRequest` and `window/logMessage`
 * request.
 */

export namespace MessageType {
  /**
   * An error message.
   */
  export const Error = 1;
  /**
   * A warning message.
   */
  export const Warning = 2;
  /**
   * An information message.
   */
  export const Info = 3;
  /**
   * A log message.
   */
  export const Log = 4;
  /**
   * A debug message.
   *
   * @since 3.18.0
   * @proposed
   */
  export const Debug = 5;
}

/**
 * Show message request client capabilities
 */
export type ShowMessageRequestClientCapabilities = {
  /**
   * Capabilities specific to the `MessageActionItem` type.
   */
  messageActionItem?: {
    /**
     * Whether the client supports additional attributes which
     * are preserved and sent back to the server in the
     * request's response.
     */
    additionalPropertiesSupport?: boolean;
  };
};

/**
 * Params of the `window/showMessageRequest` request.
 */
export type ShowMessageRequestParams = {
  /**
   * The message type. See {@link MessageType}.
   */
  type: MessageType;

  /**
   * The actual message
   */
  message: string;

  /**
   * The message action items to present.
   */
  actions?: readonly MessageActionItem[];
};

type MessageActionItem = {
  /**
   * A short title like 'Retry', 'Open Log' etc.
   */
  title: string;
};

/**
 * Client capabilities for the show document request.
 *
 * @since 3.16.0
 */
export type ShowDocumentClientCapabilities = {
  /**
   * The client has support for the show document
   * request.
   */
  support: boolean;
};

/**
 * Params of the `window/showDocument` request.
 *
 * @since 3.16.0
 */
export type ShowDocumentParams = {
  /**
   * The uri to show.
   */
  uri: URI;

  /**
   * Indicates to show the resource in an external program.
   * To show, for example, `https://code.visualstudio.com/`
   * in the default WEB browser set `external` to `true`.
   */
  external?: boolean;

  /**
   * An optional property to indicate whether the editor
   * showing the document should take focus or not.
   * Clients might ignore this property if an external
   * program is started.
   */
  takeFocus?: boolean;

  /**
   * An optional selection range if the document is a text
   * document. Clients might ignore the property if an
   * external program is started or the file is not a text
   * file.
   */
  selection?: Range;
};

/**
 * Result of the `window/showDocument` request.
 *
 * @since 3.16.0
 */
export type ShowDocumentResult = {
  /**
   * A boolean indicating if the show was successful.
   */
  success: boolean;
};

/**
 * Params of the `window/logMessage` notification.
 */
export type LogMessageParams = {
  /**
   * The message type. See {@link MessageType}.
   */
  type: MessageType;

  /**
   * The actual message
   */
  message: string;
};

/**
 * Params of the `window/workDoneProgress/create` request.
 */
export type WorkDoneProgressCreateParams = {
  /**
   * The token to be used to report progress.
   */
  token: ProgressToken;
};

/**
 * Params of the `window/workDoneProgress/cancel` notification.
 */
export type WorkDoneProgressCancelParams = {
  /**
   * The token to be used to report progress.
   */
  token: ProgressToken;
};
