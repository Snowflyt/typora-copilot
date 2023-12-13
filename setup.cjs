// @ts-check

const path = require("node:path");
const { fork } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const { VERSION } = require("./constants.cjs");
const {
  castAny,
  castNever,
  castUnknown,
  nonNullish,
  pin,
  getGlobalVar,
  setGlobalVar,
  css,
  registerCSS,
  debounce,
  sliceTextByRange,
} = require("./utils.cjs");
const {
  TYPORA_VERSION,
  Files,
  Nodes,
  waitUntilEditorInitialized,
  getCursorPlacement,
} = require("./typora-utils.cjs");

/*****************
 * Utility types *
 *****************/
/**
 * @exports
 * @template L
 * @template R
 * @typedef {_Id<Pick<L, Exclude<keyof L, keyof R>> & Pick<R, Exclude<keyof R, _OptionalPropertyNames<R>>> & Pick<R, Exclude<_OptionalPropertyNames<R>, keyof L>> & _SpreadProperties<L, R, _OptionalPropertyNames<R> & keyof L>>} Merge
 * Merge two object types, preferring the second type when keys overlap.
 * ```typescript
 * type A = { a: number; b: number; c?: number; d?: number; e?: number; }
 * type B = { b: string; c: string; d?: string; f: string; g?: string; }
 * type R = Merge<A, B>;
 * //   ^ { a: number; b: string; c: string; d?: string; e?: number; f: string; g?: string; }
 * ```
 */
/**
 * @template T
 * @typedef {T extends infer U ? { [K in keyof U]: U[K] } : never} _Id
 * Tell TS to evaluate an object type immediately. Actually does nothing, but
 * it's useful for debugging or make type information more readable.
 *
 * Sometimes strange things happen when you try to use it with a *generic type*,
 * so avoid that if possible.
 */
/**
 * @template T
 * @typedef {{ [K in keyof T]-?: ({} extends { [P in K]: T[K] } ? K : never) }[keyof T]} _OptionalPropertyNames
 */
/**
 * @template L
 * @template R
 * @template {keyof L & keyof R} K
 * @typedef {{ [P in K]: L[P] | Exclude<R[P], undefined> }} _SpreadProperties
 */

/**
 * @exports
 * @template {PropertyKey} K
 * @template T
 * @typedef {{ readonly [P in K]: T }} ReadonlyRecord Construct a type with a set of readonly properties K of type T.
 */

/**
 * @exports
 * @template T
 * @template U
 * @typedef {(<G>() => G extends T ? 1 : 2) extends (<G>() => G extends U ? 1 : 2) ? true : false} Equals Check if two types are equal.
 */

/**************
 * Base types *
 **************/
/**
 * @exports
 * @typedef {number} integer Defines an integer number in the range of -2^31 to 2^31 - 1.
 */
/**
 * @exports
 * @typedef {number} uinteger Defines an unsigned integer number in the range of 0 to 2^31 - 1.
 */
/**
 * @exports
 * @typedef {number} decimal Defines a decimal number. Since decimal numbers are very
 *                           rare in the language server specification we denote the
 *                           exact range with every decimal using the mathematics
 *                           interval notation (e.g. [0, 1] denotes all decimals d with
 *                           0 <= d <= 1.
 */
/**
 * @exports
 * @since 3.17.0
 * @typedef {LSPObject | LSPArray | string | integer | uinteger | decimal | boolean | null} LSPAny The LSP any type
 */
/**
 * @exports
 * @since 3.17.0
 * @typedef {{ readonly [key: string]: LSPAny }} LSPObject LSP object definition.
 */
/**
 * @exports
 * @since 3.17.0
 * @typedef {readonly LSPAny[]} LSPArray LSP arrays.
 */

/**
 * Check if a value is an integer.
 * @param {unknown} value
 * @returns {value is integer}
 */
const isInteger = (value) => Number.isInteger(value);
/**
 * Check if a value is an unsigned integer.
 * @param {unknown} value
 * @returns {value is uinteger}
 */
const isUInteger = (value) => isInteger(value) && value >= 0;
/**
 * Check if a value is a decimal.
 * @param {unknown} value
 * @returns {value is decimal}
 */
const isDecimal = (value) => typeof value === "number" && !isNaN(value);
/**
 * Check if a value is a LSP any.
 * @param {unknown} value
 * @returns {value is LSPAny}
 */
const isLSPAny = (value) =>
  typeof value === "string" ||
  typeof value === "boolean" ||
  value === null ||
  isInteger(value) ||
  isDecimal(value) ||
  isLSPArray(value) ||
  isLSPObject(value);
/**
 * Check if a value is a LSP object.
 * @param {unknown} value
 * @returns {value is LSPObject}
 */
const isLSPObject = (value) => {
  if (typeof value !== "object" || value === null) return false;
  for (const key in value)
    if (!isLSPAny(value[/** @type {keyof typeof value} */ (key)])) return false;
  return true;
};
/**
 * Check if a value is a LSP array.
 * @param {unknown} value
 * @returns {value is LSPArray}
 */
const isLSPArray = (value) => Array.isArray(value) && value.every(isLSPAny);

/*****************
 * Message types *
 *****************/
/**
 * @exports
 * @typedef {typeof JSONRPC_VERSION} JSONRPCVersion
 */
const JSONRPC_VERSION = "2.0";

/**
 * @exports
 * @typedef {{ jsonrpc: JSONRPCVersion extends infer U ? U : never }} Message A general message as defined by JSON-RPC. The language server protocol always uses “2.0” as the `jsonrpc` version.
 */
/**
 * @exports
 * @typedef {Merge<Message, _BaseRequestMessage>} RequestMessage A request message to describe a request between the client and the server. Every processed request must send a response back to the sender of the request.
 */
/**
 * @typedef {object} _BaseRequestMessage
 * @property {integer | string} id The request id.
 * @property {string} method The method to be invoked.
 * @property {LSPObject | LSPArray} [params] The method's params.
 */
/**
 * @exports
 * @typedef {SuccessResponseMessage | ErrorResponseMessage} ResponseMessage A Response Message sent as a result of a request. If a request doesn’t provide a result value the receiver of a request still needs to return a response message to conform to the JSON-RPC specification. The result property of the ResponseMessage should be set to null in this case to signal a successful request.
 */
/**
 * @typedef {object} _BaseResponseMessage
 * @property {?integer | string} id The request id.
 */
/**
 * @exports
 * @typedef {Merge<Message, Merge<_BaseResponseMessage, _BaseSuccessResponseMessage>>} SuccessResponseMessage
 */
/**
 * @typedef {object} _BaseSuccessResponseMessage
 * @property {?integer | string} id The request id.
 * @property {string | number | boolean | LSPArray | LSPObject | null} result The result of a request. This member is REQUIRED on success. This member MUST NOT exist if there was an error invoking the method.
 */
/**
 * @exports
 * @typedef {Merge<Message, Merge<_BaseResponseMessage, _BaseErrorResponseMessage>>} ErrorResponseMessage
 */
/**
 * @typedef {object} _BaseErrorResponseMessage
 * @property {ResponseError} error The error object in case a request fails.
 */
/**
 * @exports
 * @typedef {object} ResponseError
 * @property {integer} code A number indicating the error type that occurred.
 * @property {string} message A string providing a short description of the error.
 * @property {string | number | boolean | LSPArray | LSPObject | null} [data] A primitive or structured value that contains additional information about the error. Can be omitted.
 */
/**
 * @exports
 * @typedef {Merge<Message, _BaseNotificationMessage>} NotificationMessage A notification message. A processed notification message must not send a response back. They work like events.
 */
/**
 * @typedef {object} _BaseNotificationMessage
 * @property {string} method The method to be invoked.
 * @property {LSPObject | LSPArray} [params] The notification's params.
 */
/**
 * @exports
 * @typedef {object} CancelParams Params to be sent with a `$/cancelRequest` notification.
 * @property {integer | string} id The request id to cancel.
 */
/**
 * @exports
 * @typedef {integer | string} ProgressToken A token that represents a work in progress.
 */
/**
 * @exports
 * @template {LSPAny} [T = LSPAny]
 * @typedef {object} ProgressParams Params to be sent with a `$/progress` notification.
 * @property {ProgressToken} token The progress token provided by the client or server.
 * @property {T} value The progress data.
 */

/**
 * Check if a value is a message.
 * @param {unknown} value
 * @returns {value is Message}
 */
const isMessage = (value) => {
  if (typeof value !== "object" || value === null) return false;
  if (!("jsonrpc" in value) || typeof value.jsonrpc !== "string") return false;
  return true;
};
/**
 * Check if a value is a request message.
 * @param {unknown} value
 * @returns {value is RequestMessage}
 */
const isRequestMessage = (value) => {
  if (!isMessage(value)) return false;
  if (
    !("id" in value) ||
    (!isInteger(value.id) && typeof value.id !== "string" && value.id !== null)
  )
    return false;
  if (!("method" in value) || typeof value.method !== "string") return false;
  if ("params" in value && !isLSPArray(value.params) && !isLSPObject(value.params)) return false;
  return true;
};
/**
 * Check if a value is a response message.
 * @param {unknown} value
 * @returns {value is ResponseMessage}
 */
const isResponseMessage = (value) => {
  if (!isMessage(value)) return false;
  if (
    !("id" in value) ||
    (!isInteger(value.id) && typeof value.id !== "string" && value.id !== null)
  )
    return false;
  if (
    "result" in value &&
    ("error" in value ||
      (typeof value.result !== "string" &&
        typeof value.result !== "number" &&
        typeof value.result !== "boolean" &&
        !isLSPArray(value.result) &&
        !isLSPObject(value.result) &&
        value.result !== null))
  )
    return false;
  if ("error" in value && !isResponseError(value.error)) return false;
  if (!("result" in value) && !("error" in value)) return false;
  return true;
};
/**
 * Check if a value is a response error.
 * @param {unknown} value
 * @returns {value is ResponseError}
 */
const isResponseError = (value) => {
  if (typeof value !== "object" || value === null) return false;
  if (!("code" in value) || !isInteger(value.code)) return false;
  if (!("message" in value) || typeof value.message !== "string") return false;
  if (
    "data" in value &&
    typeof value.data !== "string" &&
    typeof value.data !== "number" &&
    typeof value.data !== "boolean" &&
    !isLSPArray(value.data) &&
    !isLSPObject(value.data) &&
    value.data !== null
  )
    return false;
  return true;
};
/**
 * Check if a value is a notification message.
 * @param {unknown} value
 * @returns {value is NotificationMessage}
 */
const isNotificationMessage = (value) => {
  if (!isMessage(value)) return false;
  if ("id" in value && value.id !== null) return false;
  if (!("method" in value) || typeof value.method !== "string") return false;
  if ("params" in value && !isLSPArray(value.params) && !isLSPObject(value.params)) return false;
  return true;
};

/************************
 * JSON-RPC error codes *
 ************************/
/**
 * @exports
 */
const ErrorCodes = {};

// Defined by JSON-RPC
ErrorCodes.ParseError = pin(-32700);
ErrorCodes.InvalidRequest = pin(-32600);
ErrorCodes.MethodNotFound = pin(-32601);
ErrorCodes.InvalidParams = pin(-32602);
ErrorCodes.InternalError = pin(-32603);

/**
 * This is the start range of JSON-RPC reserved error codes.
 * It doesn't denote a real error code. No LSP error codes should
 * be defined between the start and end range. For backwards
 * compatibility the `ServerNotInitialized` and the `UnknownErrorCode`
 * are left in the range.
 *
 * @since 3.16.0
 */
ErrorCodes.jsonrpcReservedErrorRangeStart = pin(-32099);
/**
 * @deprecated use `jsonrpcReservedErrorRangeStart`
 */
ErrorCodes.serverErrorStart = ErrorCodes.jsonrpcReservedErrorRangeStart;

/**
 * Error code indicating that a server received a notification or
 * request before the server has received the `initialize` request.
 */
ErrorCodes.ServerNotInitialized = pin(-32002);
ErrorCodes.UnknownErrorCode = pin(-32001);

/**
 * This is the end range of JSON-RPC reserved error codes.
 * It doesn't denote a real error code.
 *
 * @since 3.16.0
 */
ErrorCodes.jsonrpcReservedErrorRangeEnd = pin(-32000);
/**
 * @deprecated use `jsonrpcReservedErrorRangeEnd`
 */
ErrorCodes.serverErrorEnd = ErrorCodes.jsonrpcReservedErrorRangeEnd;

/**
 * This is the start range of LSP reserved error codes.
 * It doesn't denote a real error code.
 *
 * @since 3.16.0
 */
ErrorCodes.lspReservedErrorRangeStart = pin(-32899);

/**
 * A request failed but it was syntactically correct, e.g the
 * method name was known and the parameters were valid. The error
 * message should contain human readable information about why
 * the request failed.
 *
 * @since 3.17.0
 */
ErrorCodes.RequestFailed = pin(-32803);

/**
 * The server cancelled the request. This error code should
 * only be used for requests that explicitly support being
 * server cancellable.
 *
 * @since 3.17.0
 */
ErrorCodes.ServerCancelled = pin(-32802);

/**
 * The server detected that the content of a document got
 * modified outside normal conditions. A server should
 * NOT send this error code if it detects a content change
 * in it unprocessed messages. The result even computed
 * on an older state might still be useful for the client.
 *
 * If a client decides that a result is not of any use anymore
 * the client should cancel the request.
 */
ErrorCodes.ContentModified = pin(-32801);

/**
 * The client has canceled a request and a server as detected
 * the cancel.
 */
ErrorCodes.RequestCancelled = pin(-32800);

/**
 * This is the end range of LSP reserved error codes.
 * It doesn't denote a real error code.
 *
 * @since 3.16.0
 */
ErrorCodes.lspReservedErrorRangeEnd = pin(-32800);

/**
 * Get the name of an error code.
 * @param {integer} errorCode
 * @returns
 */
const getErrorCodeName = (errorCode) =>
  /** @type {readonly (readonly [string, integer])[]} */ (Object.entries(ErrorCodes)).find(
    ([, v]) => v === errorCode
  )?.[0];

/************
 * Protocol *
 ************/
/**
 * @exports
 * @typedef {string} DocumentUri
 */
/**
 * @exports
 * @typedef {string} URI A normal non document URI.
 */
/**
 * @exports
 * @typedef {"abap" | "bat" | "bibtex" | "clojure" | "coffeescript" | "c" | "cpp" | "csharp" | "css" | "diff" | "dart" | "dockerfile" | "elixir" | "erlang" | "fsharp" | "git-commit" | "git-rebase" | "go" | "groovy" | "handlebars" | "html" | "ini" | "java" | "javascript" | "javascriptreact" | "json" | "latex" | "less" | "lua" | "makefile" | "markdown" | "objective-c" | "objective-cpp" | "perl" | "perl6" | "php" | "powershell" | "jade" | "python" | "r" | "razor" | "ruby" | "rust" | "scss" | "sass" | "scala" | "shaderlab" | "shellscript" | "sql" | "swift" | "typescript" | "typescriptreact" | "tex" | "vb" | "xml" | "xsl" | "yaml" | (string & {})} LanguageId
 * Recommended language identifiers for LSP.
 */
/**
 * @exports
 * @typedef {object} Position
 * Position in a text document expressed as zero-based line and zero-based character offset. A
 * position is between two characters like an ‘insert’ cursor in an editor. Special values like for
 * example `-1` to denote the end of a line are not supported.
 * @property {uinteger} line Line position in a document (zero-based).
 * @property {uinteger} character
 * Character offset on a line in a document (zero-based). The meaning of this offset is determined
 * by the negotiated `PositionEncodingKind`.
 *
 * If the character value is greater than the line length it defaults back to the line length.
 */
/**
 * @exports
 * @typedef {object} Range
 * A range in a text document expressed as (zero-based) start and end positions. A range is
 * comparable to a selection in an editor. Therefore, the end position is exclusive. If you want to
 * specify a range that contains a line including the line ending character(s) then use an end
 * position denoting the start of the next line.
 * @property {Position} start The range's start position.
 * @property {Position} end The range's end position.
 */
/**
 * @exports
 * @typedef {"off" | "messages" | "verbose"} TraceValue
 * A `TraceValue` represents the level of verbosity with which the server systematically reports
 * its execution trace using `$/logTrace` notifications. The initial trace value is set by the client
 * at initialization and can be modified later using the `$/setTrace` notification.
 */
/**
 * @exports
 * @typedef {object} TextDocumentItem An item to transfer a text document from the client to the server.
 * @property {DocumentUri} uri The text document's URI.
 * @property {LanguageId} languageId The text document's language identifier.
 * @property {integer} version The version number of this document (it will increase after each change, including undo/redo).
 * @property {string} text The content of the opened text document.
 */
/**
 * @exports
 * @typedef {object} TextDocumentIdentifier Text documents are identified using a URI. On the protocol level, URIs are passed as strings.
 * @property {DocumentUri} uri The text document's URI.
 */
/**
 * @exports
 * @typedef {Merge<_BaseVersionedTextDocumentIdentifier, TextDocumentIdentifier>} VersionedTextDocumentIdentifier
 * An identifier to denote a specific version of a text document.
 */
/**
 * @typedef {object} _BaseVersionedTextDocumentIdentifier
 * @property {integer} version
 * The version number of this document.
 *
 * The version number of a document will increase after each change,
 * including undo/redo. The number doesn't need to be consecutive.
 */
/**
 * @exports
 * @typedef {Merge<_BaseOptionalVersionedTextDocumentIdentifier, TextDocumentIdentifier>} OptionalVersionedTextDocumentIdentifier
 * An identifier which optionally denotes a specific version of a text document.
 */
/**
 * @typedef {object} _BaseOptionalVersionedTextDocumentIdentifier
 * @property {?integer} version
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
/**
 * @exports
 * @typedef {object} TextDocumentPositionParams
 * A parameter literal used in requests to pass a text document and a position inside that document.
 * It is up to the client to decide how a selection is converted into a position when issuing a
 * request for a text document. The client can for example honor or ignore the selection direction
 * to make LSP request consistent with features implemented internally.
 * @property {TextDocumentIdentifier} textDocument The text document.
 * @property {Position} position The position inside the text document.
 */
/**
 * @exports
 * @typedef {object} DocumentFilter
 * A document filter denotes a document through properties like `language`, `scheme` or `pattern`.
 * An example is a filter that applies to TypeScript files on disk. Another example is a filter that
 * applies to JSON files with name `package.json`.
 *
 * Please note that for a document filter to be valid at least one of the properties for `language`,
 * `scheme`, or `pattern` must be set. To keep the type definition simple all properties are marked
 * as optional.
 * @property {LanguageId} [language] A language id, like `typescript`.
 * @property {string} [scheme] A Uri [scheme](#Uri.scheme), like `file` or `untitled`.
 * @property {string} [pattern]
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
/**
 * @exports
 * @typedef {readonly DocumentFilter[]} DocumentSelector A document selector is the combination of one or more document filters.
 */
/**
 * @exports
 * @typedef {object} TextEdit A textual edit applicable to a text document.
 * @property {Range} range The range of the text document to be manipulated. To insert text into a document create a range where `start === end`.
 * @property {string} newText The string to be inserted. For delete operations use an empty string.
 */
/**
 * @exports
 * @typedef {Merge<TextEdit, _BaseAnnotatedTextEdit>} AnnotatedTextEdit
 * A special text edit with an additional change annotation.
 *
 * **@since** 3.16.0.
 */
/**
 * @typedef {object} _BaseAnnotatedTextEdit
 * @property {ChangeAnnotationIdentifier} annotationId The actual annotation identifier.
 *
 * **@since** 3.16.0.
 */
/**
 * @exports
 * @typedef {string} ChangeAnnotationIdentifier An identifier referring to a change annotation managed by a workspace edit.
 */
/**
 * @exports
 * @typedef {object} ChangeAnnotation Additional information that describes document changes.
 *
 * **@since** 3.16.0.
 * @property {string} label A human-readable string describing the actual change. The string is rendered prominent in the user interface.
 * @property {boolean} [needsConfirmation] A flag which indicates that user confirmation is needed before applying the change.
 * @property {string} [description] A human-readable string which is rendered less prominent in the user interface.
 */
/**
 * @exports
 * @typedef {object} TextDocumentEdit
 * Describes textual changes on a single text document. The text document is referred to as a
 * `OptionalVersionedTextDocumentIdentifier` to allow clients to check the text document version
 * before an edit is applied. A `TextDocumentEdit` describes all changes on a version Si+1 and after
 * they are applied move the document to version `Si+1`. So the creator of a `TextDocumentEdit`
 * doesn’t need to sort the array of edits or do any kind of ordering. However the edits must be non
 * overlapping.
 * @property {OptionalVersionedTextDocumentIdentifier} textDocument The text document to change.
 * @property {readonly (TextEdit | AnnotatedTextEdit)[]} edits The edits to be applied.
 */
/**
 * @exports
 * @typedef {object} Location Represents a location inside a resource, such as a line inside a text file.
 * @property {DocumentUri} uri
 * @property {Range} range
 */
/**
 * @exports
 * @typedef {object} LocationLink Represents a link between a source and a target location.
 * @property {Range} [originSelectionRange]
 * Span of the origin of this link.
 *
 * Used as the underlined span for mouse interaction. Defaults to the word range at the mouse
 * position.
 * @property {DocumentUri} targetUri The target resource identifier of this link.
 * @property {Range} targetRange
 * The full target range of this link. If the target for example is a symbol then target range is
 * the range enclosing this symbol not including leading/trailing whitespace but everything else
 * like comments. This information is typically used to highlight the range in the editor.
 * @property {Range} targetSelectionRange
 * The range that should be selected and revealed when this link is being followed, e.g the name of
 * a function. Must be contained by the `targetRange`. See also `DocumentSymbol#range`.
 */
/**
 * @exports
 * @typedef {object} Command
 * Represents a reference to a command. Provides a title which will be used to represent a command
 * in the UI. Commands are identified by a string identifier. The recommended way to handle commands
 * is to implement their execution on the server side if the client and server provides the
 * corresponding capabilities. Alternatively the tool extension code could handle the command. The
 * protocol currently doesn’t specify a set of well-known commands.
 * @property {string} title Title of the command, like `save`.
 * @property {string} command The identifier of the actual command handler.
 * @property {readonly LSPAny[]} [arguments] Arguments that the command handler should be invoked with.
 */
/**
 * @exports
 * @typedef {object} CreateFileOptions Options to create a file.
 * @property {boolean} [overwrite] Overwrite existing file. Overwrite wins over `ignoreIfExists`.
 * @property {boolean} [ignoreIfExists] Ignore if exists.
 */
/**
 * @exports
 * @typedef {object} CreateFile Create file operation
 * @property {"create"} kind A create.
 * @property {DocumentUri} uri The resource to create.
 * @property {CreateFileOptions} [options] Additional options
 * @property {ChangeAnnotationIdentifier} [annotationId] An optional annotation identifier describing the operation.
 *
 * **@since** 3.16.0
 */
/**
 * @exports
 * @typedef {object} RenameFileOptions Rename file options
 * @property {boolean} [overwrite] Overwrite target if existing. Overwrite wins over `ignoreIfExists`.
 * @property {boolean} [ignoreIfExists] Ignores if target exists.
 */
/**
 * @exports
 * @typedef {object} RenameFile Rename file operation
 * @property {"rename"} kind A rename.
 * @property {DocumentUri} oldUri The old (existing) location.
 * @property {DocumentUri} newUri The new location.
 * @property {RenameFileOptions} [options] Rename options.
 * @property {ChangeAnnotationIdentifier} [annotationId] An optional annotation identifier describing the operation.
 *
 * **@since** 3.16.0
 */
/**
 * @exports
 * @typedef {object} DeleteFileOptions Delete file options
 * @property {boolean} [recursive] Delete the content recursively if a folder is denoted.
 * @property {boolean} [ignoreIfNotExists] Ignore the operation if the file doesn't exist.
 */
/**
 * @exports
 * @typedef {object} DeleteFile Delete file operation
 * @property {"delete"} kind A delete.
 * @property {DocumentUri} uri The file to delete.
 * @property {DeleteFileOptions} [options] Delete options.
 * @property {ChangeAnnotationIdentifier} [annotationId] An optional annotation identifier describing the operation.
 */
/**
 * @exports
 * @typedef {object} WorkspaceEdit
 * A workspace edit represents changes to many resources managed in the workspace. The edit should
 * either provide `changes` or `documentChanges`. If the client can handle versioned document edits
 * and if `documentChanges` are present, the latter are preferred over `changes`.
 * @property {{ readonly [uri: DocumentUri]: readonly TextEdit[]; }} [changes] Holds changes to existing resources.
 * @property {(readonly TextDocumentEdit[] | readonly (TextDocumentEdit | CreateFile | RenameFile | DeleteFile)[])} [documentChanges]
 * Depending on the client capability `workspace.workspaceEdit.resourceOperations` document changes
 * are either an array of `TextDocumentEdit`s to express changes to n different text documents where
 * each text document edit addresses a specific version of a text document. Or it can contain above
 * `TextDocumentEdit`s mixed with create, rename and delete file / folder operations.
 *
 * Whether a client supports versioned document edits is expressed via
 * `workspace.workspaceEdit.documentChanges` client capability.
 *
 * If a client neither supports `documentChanges` nor
 * `workspace.workspaceEdit.resourceOperations` then only plain `TextEdit`s using the `changes`
 * property are supported.
 * @property {{ readonly [id: ChangeAnnotationIdentifier]: ChangeAnnotation; }} [changeAnnotations]
 * A map of change annotations that can be referenced in `AnnotatedTextEdit`s or create, rename and
 * delete file / folder operations.
 *
 * Whether clients honor this property depends on the client capability
 * `workspace.changeAnnotationSupport`.
 *
 * **@since** 3.16.0
 */
/**
 * @exports
 * @typedef {object} PartialResultParams A parameter literal used to pass a partial result token.
 * @property {ProgressToken} [partialResultToken] An optional token that a server can use to report partial results (e.g. streaming) to the client.
 */
/**
 * @exports
 * @typedef {object} WorkDoneProgressParams The token used to report work done progress.
 * @property {ProgressToken} [workDoneToken] An optional token that a server can use to report work done progress.
 */
/**
 * @exports
 * @typedef {object} WorkspaceFolder Workspace folder information.
 * @property {URI} uri The associated URI for this workspace folder.
 * @property {string} name The name of the workspace folder. Used to refer to this workspace folder in the user interface.
 */
/**
 * @exports
 * @typedef {Merge<WorkDoneProgressParams, _BaseInitializeParams>} InitializeParams
 */
/**
 * @typedef {object} _BaseInitializeParams Params to be sent with an `initialize` request, which is sent as the first request from the client to the server.
 * @property {?integer} processId The process ID of the parent process that started the server. Is `null` if the process has not been started by another process. If the parent process is not alive then the server should exit (see exit notification) its process.
 * @property {{ name: string; version?: string }} [clientInfo] Information about the client.
 *
 * **@since** 3.15.0.
 * @property {string} [locale] The locale the client is currently showing the user interface in. This must not necessarily be the locale of the operating system.
 *
 * Uses IETF language tags as the value's syntax (See https://en.wikipedia.org/wiki/IETF_language_tag).
 *
 * **@since** 3.16.0.
 * @property {?string} [rootPath] The root path of the workspace. Is `null` if no folder is open.
 *
 * **@deprecated** in favour of `rootUri`.
 * @property {?DocumentUri} [rootUri] The root URI of the workspace. Is `null` if no folder is open. If both `rootPath` and `rootUri` are set, `rootUri` wins.
 *
 * **@deprecated** in favour of `workspaceFolders`.
 * @property {LSPAny} [initializationOptions] User provided initialization options.
 * @property {any} capabilities The capabilities provided by the client (editor or tool).
 * @property {TraceValue} [trace] The initial trace setting. If omitted, trace is disabled (`"off"`).
 * @property {?readonly WorkspaceFolder[]} [workspaceFolders] The workspace folders configured in the client when the server starts. This property is only available if the client supports workspace folders. It can be `null` if the client supports workspace folders but none are configured.
 *
 * **@since** 3.6.0.
 */
/**
 * @exports
 * @typedef {object} InitializeResult The result returned from a response to an `initialize` request.
 * @property {any} capabilities The capabilities the language server provides.
 * @property {{ name: string; version?: string }} [serverInfo] Information about the server.
 *
 * **@since** 3.15.0
 */
/**
 * @exports
 * @typedef {object} Registration General parameters to register for a capability.
 * @property {string} id The id used to register the request. The id can be used to deregister the request again.
 * @property {string} method The method / capability to register for.
 * @property {LSPAny} [registerOptions] Options necessary for the registration.
 */
/**
 * @exports
 * @typedef {object} RegistrationParams Params to be sent with a `client/registerCapability` request.
 * @property {readonly Registration[]} registrations The actual registrations.
 */
/**
 * @exports
 * @typedef {object} StaticRegistrationOptions Static registration options to be returned in the initialize request.
 * @property {string} id The id used to register the request. The id can be used to deregister the request again. See also `Registration#id`.
 */
/**
 * @exports
 * @typedef {object} TextDocumentRegistrationOptions General text document registration options.
 * @property {DocumentSelector} documentSelector A document selector to identify the scope of the registration. If set to `null` the document selector provided on the client side will be used.
 */
/**
 * @exports
 * @typedef {object} Unregistration General parameters to unregister a capability.
 * @property {string} id The id used to unregister the request or notification. Usually an id provided during the register request.
 * @property {string} method The method / capability to unregister for.
 */
/**
 * @exports
 * @typedef {object} UnregistrationParams Params to be sent with a `client/unregisterCapability` request.
 * @property {readonly Unregistration[]} unregisterations
 * This should correctly be named `unregistrations`. However changing this is a breaking change and
 * needs to wait until we deliver a 4.x version of the specification.
 */
/**
 * @exports
 * @typedef {object} SetTraceParams Params to be sent with a `$/setTrace` notification.
 * @property {TraceValue} value The new value that should be assigned to the trace setting.
 */
/**
 * @exports
 * @typedef {object} LogTraceParams Params to be sent with a `$/logTrace` notification.
 * @property {string} message The message to be logged.
 * @property {string} [verbose] Additional information that can be computed if the `trace` configuration is set to `'verbose'`.
 */

/**
 * @exports
 */
const EOL = ["\n", "\r\n", "\r"];

/**
 * Defines how the host (editor) should sync document changes to the language server.
 * @exports
 */
const TextDocumentSyncKind = {};
/**
 * Documents should not be synced at all.
 */
TextDocumentSyncKind.None = pin(0);
/**
 * Documents are synced by always sending the full content of the document.
 */
TextDocumentSyncKind.Full = pin(1);
/**
 * Documents are synced by sending the full content on open. After that only incremental updates to
 * the document are sent.
 */
TextDocumentSyncKind.Incremental = pin(2);
/**
 * @exports
 * @typedef {0 | 1 | 2} TextDocumentSyncKind The kind of a `TextDocumentSync` value.
 */
/**
 * @exports
 * @typedef {object} TextDocumentSyncOptions Options to configure the text document synchronization.
 * @property {boolean | TextDocumentSyncKind} [openClose] Open and close notifications are sent to the server. If omitted open close notification should not be sent.
 * @property {TextDocumentSyncKind} [change] Change notifications are sent to the server. See `TextDocumentSyncKind.None`, `TextDocumentSyncKind.Full` and `TextDocumentSyncKind.Incremental`. If omitted it defaults to `TextDocumentSyncKind.None`.
 */
/**
 * @exports
 * @typedef {object} DidOpenTextDocumentParams Params to be sent with a `textDocument/didOpen` notification.
 * @property {TextDocumentItem} textDocument The document that was opened.
 */
/**
 * @exports
 * @typedef {Merge<TextDocumentRegistrationOptions, _BaseTextDocumentChangeRegistrationOptions>} TextDocumentChangeRegistrationOptions
 * Describe options to be used when registering for text document change events.
 */
/**
 * @typedef {object} _BaseTextDocumentChangeRegistrationOptions
 * @property {TextDocumentSyncKind} syncKind How documents are synced to the server. See `TextDocumentSyncKind.Full` and `TextDocumentSyncKind.Incremental`.
 */
/**
 * @exports
 * @typedef {object} DidChangeTextDocumentParams Params to be sent with a `textDocument/didChange` notification.
 * @property {VersionedTextDocumentIdentifier} textDocument
 * The document that did change. The version number points to the version after all provided content
 * changes have been applied.
 * @property {readonly TextDocumentContentChangeEvent[]} contentChanges
 * The actual content changes. The content changes describe single state changes to the document. So
 * if there are two content changes c1 (at array index 0) and c2 (at array index 1) for a document
 * in state S then c1 moves the document from S to S' and c2 from S' to S''. So c1 is computed on
 * the state S and c2 is computed on the state S'.
 *
 * To mirror the content of a document using change events use the following approach:
 * - start with the same initial content
 * - apply the `"textDocument/didChange"` notifications in the order you receive them.
 * - apply the `TextDocumentContentChangeEvent`s in a single notification in the order you receive
 *   them.
 */
/**
 * @exports
 * @typedef {object} TextDocumentContentChangeEvent
 * An event describing a change to a text document. If only a text is provided it is considered to
 * be the full content of the document.
 * @property {Range} [range] The range of the document that changed.
 * @property {uinteger} [rangeLength] The optional length of the range that got replaced.
 *
 * **@deprecated** use `range` instead.
 * @property {string} text The new text for the provided range.
 */
/**
 * @exports
 * @typedef {object} DidCloseTextDocumentParams Params to be sent with a `textDocument/didClose` notification.
 * @property {TextDocumentIdentifier} textDocument The document that was closed.
 */
/**
 * @exports
 * @typedef {object} DidChangeWorkspaceFoldersParams Params to be sent with a `workspace/didChangeWorkspaceFolders` notification.
 * @property {WorkspaceFoldersChangeEvent} event The actual workspace folder change event.
 */
/**
 * @exports
 * @typedef {object} WorkspaceFoldersChangeEvent The workspace folder change event.
 * @property {readonly WorkspaceFolder[]} added The array of added workspace folders.
 * @property {readonly WorkspaceFolder[]} removed he array of the removed workspace folders.
 */

/*********************
 * Utility functions *
 *********************/
/**
 * Omit keys from an object
 * @template {Record<PropertyKey, unknown>} O
 * @template {ReadonlyArray<keyof O>} KS
 * @param {O} obj
 * @param {KS} keys
 * @returns {Omit<O, KS[number]> extends infer U ? { [K in keyof U]: U[K] } : never}
 *
 * @example
 * ```javascript
 * omit({ a: 1, b: 2, c: 3 }, "a"); // => { b: 2, c: 3 }
 * omit({ a: 1, b: 2, c: 3 }, "a", "c"); // => { b: 2 }
 * ```
 */
const omit = (obj, ...keys) => {
  /** @type {Record<PropertyKey, unknown>} */
  const result = {};
  for (const key in obj) {
    if (!keys.includes(key)) {
      result[key] = obj[key];
    }
  }
  return /** @type {Omit<O, KS[number]> extends infer U ? { [K in keyof U]: U[K] } : never} */ (
    result
  );
};

/**********
 * Logger *
 **********/
/**
 * @typedef {object} SimpleLoggerOptions Options for simple logger.
 * @property {string} [prefix] Prefix to display before the text.
 */
/**
 * Create a simple logger that logs a message to the console.
 * @param {SimpleLoggerOptions} [options]
 * @returns
 */
const createSimpleLogger = (options) => {
  const { prefix = "" } = options ?? {};

  return {
    /**
     * Log a debug message to the console.
     * @param {...unknown} data
     */
    debug: (...data) =>
      console.debug(
        ...(data.length > 0 && typeof data[0] === "string" ? [prefix + data[0]] : []),
        ...(data.length > 1 ? data.slice(1) : [])
      ),
    /**
     * Log a message to the console.
     * @param {...unknown} data
     */
    info: (...data) =>
      console.log(
        ...(data.length > 0 && typeof data[0] === "string" ? [prefix + data[0]] : []),
        ...(data.length > 1 ? data.slice(1) : [])
      ),
    /**
     * Log a warning message to the console.
     * @param {...unknown} data
     */
    warn: (...data) =>
      console.warn(
        ...(data.length > 0 && typeof data[0] === "string" ? [prefix + data[0]] : []),
        ...(data.length > 1 ? data.slice(1) : [])
      ),
    /**
     * Log an error message to the console.
     * @param {...unknown} data
     */
    error: (...data) =>
      console.error(
        ...(data.length > 0 && typeof data[0] === "string" ? [prefix + data[0]] : []),
        ...(data.length > 1 ? data.slice(1) : [])
      ),

    /**
     * Overwrite `options` with new options.
     * @param {SimpleLoggerOptions extends infer U ? _Id<U> : never} overwriteOptions
     */
    overwrite: (overwriteOptions) => createSimpleLogger({ ...options, ...overwriteOptions }),
  };
};

/**
 * Prepare console block parameters.
 * @param {object} options
 * @param {string} options.text Text to display.
 * @param {string} [options.prefix] Prefix to display before the text.
 * @param {string} [options.color] Block background color.
 * @param {string} [options.textColor] Block text color.
 * @returns
 */
const _prepareConsoleBlockParams = (options) => {
  const { text, prefix = "", color: backgroundColor = "gray", textColor = "white" } = options;

  return [
    "%c" + prefix + text,
    `background-color: ${backgroundColor}; color: ${textColor}; padding: 5px 10px; font-family: ''; font-weight: bold; width: 100%`,
  ];
};

/**
 * @typedef {Omit<Parameters<typeof _prepareConsoleBlockParams>[0], "text"> extends infer U ? _Id<U> : never} BlockLoggerOptions Options for block logger.
 */
/**
 * Create a logger that logs a block-formatted message to the console.
 * @param {BlockLoggerOptions} [options]
 * @returns
 */
const createBlockLogger = (options) => ({
  /**
   * Log a block-formatted debug message to the console.
   * @param {string} text
   * @param {...unknown} data
   */
  debug: (text, ...data) =>
    console.debug(..._prepareConsoleBlockParams({ text, ...options }), ...data),
  /**
   * Log a block-formatted message to the console.
   * @param {string} text
   * @param {...unknown} data
   */
  info: (text, ...data) =>
    console.log(..._prepareConsoleBlockParams({ text, ...options }), ...data),
  /**
   * Log a block-formatted warning message to the console.
   * @param {string} text
   * @param {...unknown} data
   */
  warn: (text, ...data) =>
    console.warn(..._prepareConsoleBlockParams({ text, ...options }), ...data),
  /**
   * Log a block-formatted error message to the console.
   * @param {string} text
   * @param {...unknown} data
   */
  error: (text, ...data) =>
    console.error(..._prepareConsoleBlockParams({ text, ...options }), ...data),

  /**
   * Overwrite `options` with new options.
   * @param {BlockLoggerOptions} overwriteOptions
   */
  overwrite: (overwriteOptions) => createBlockLogger({ ...options, ...overwriteOptions }),
});

/**
 * @exports
 * @typedef {ReturnType<typeof createLogger>} Logger A logger that logs a message to the console.
 */
/**
 * Create a logger that logs a message to the console.
 * @param {Merge<SimpleLoggerOptions, { block?: BlockLoggerOptions }>} [options]
 * @returns
 */
const createLogger = (options) =>
  Object.assign(createSimpleLogger(options), {
    block: createBlockLogger({ ...(options ? omit(options, "block") : {}), ...options?.block }),
  });

/**
 * Format request ID for logging.
 * @param {?integer | string} id
 * @returns
 *
 * @example
 * ```javascript
 * formatId(1); // => "[1] "
 * formatId("abc"); // => "[abc] "
 * formatId(null); // => ""
 * ```
 */
const formatId = (id) => (id !== null ? `[${id}] ` : "");
/**
 * Format method name for logging.
 * @param {?string} method
 * @returns
 *
 * @example
 * ```javascript
 * formatMethod("initialize"); // => "initialize"
 * formatMethod(null); // => "Anonymous"
 * ```
 */
const formatMethod = (method) => method ?? "Anonymous";
/**
 * Format error code for logging.
 * @param {integer} code
 * @returns
 *
 * @example
 * ```javascript
 * formatErrorCode(-32601); // => "-32601 (MethodNotFound)"
 * formatErrorCode(123); // => "123"
 * ```
 */
const formatErrorCode = (code) => {
  const name = getErrorCodeName(code);
  return code + (name ? ` (${name})` : "");
};

/**************
 * LSP client *
 **************/
/**
 * @exports
 * @template T
 * @typedef {Promise<T> & Readonly<_BaseResponsePromise>} ResponsePromise
 * A promise specially designed for LSP client representing a future response from LSP server that holds the relevant request ID and a `cancel` function to cancel the request.
 */
/**
 * @typedef {object} _BaseResponsePromise
 * @property {"fulfilled" | "rejected" | "pending"} status Status of the promise.
 * @property {integer | string} id ID of the request.
 * @property {() => void} cancel Cancel the request. **Throws** an error if the promise is not pending.
 */

/**
 * @typedef {Merge<ClientContext, _BaseHandlerContext>} HandlerContext LSP client handler context.
 */
/**
 * @typedef {object} _BaseHandlerContext
 * @property {() => void} suppressLogging Suppress logging.
 */
/**
 * @typedef {{ readonly type: "query" | "mutation"; readonly handler: (params: never, success: (value: string | number | boolean | LSPArray | LSPObject | null) => void, error: (reason: ResponseError) => void, context: HandlerContext) => void | Promise<void> }} RequestHandler
 * Client handler for a LSP request sent from the server. The `type` property actually does nothing, and is only used for logging.
 *
 * Type of `params` in `handler` is defined as `never` because function parameters type are contravariant in TypeScript, so in order to make it possible to refine `params` type, for example, `(params: InitializeParams, success: (value: string) => void, error: (reason: ResponseError) => void, context: HandlerContext) => void` should be compatible with this type, we have to define `params` type as generic as possible, i.e. `never`.
 *
 * To make sure a subtype of this type is valid, i.e. `params` type extends `RequestMessage["params"]`, validate it using `validateRequestHandlers` function.
 */
/**
 * @typedef {(params: never, context: HandlerContext) => void | Promise<void>} NotificationHandler
 * Client handler for a LSP notification sent from the server.
 *
 * Type of `params` is defined as `never` because function parameters type are contravariant in TypeScript, so in order to make it possible to refine `params` type, for example, `(params: CancelParams, context: HandlerContext) => void` should be compatible with this type, we have to define `params` type as generic as possible, i.e. `never`.
 *
 * To make sure a subtype of this type is valid, i.e. `params` type extends `NotificationMessage["params"]`, validate it using `validateNotificationHandlers` function.
 */

/**
 * @template {ReadonlyRecord<string, RequestHandler>} RequestHandlers
 * @template {ReadonlyRecord<string, RequestHandler>} RefineHandlers
 * @typedef {{ readonly [P in keyof RequestHandlers]: P extends keyof RefineHandlers ? RefineHandlers[P] : RequestHandlers[P] }} RefineRequestHandlers
 * Refine request handlers type according to pre-defined protocol request handlers.
 */
/**
 * @template {ReadonlyRecord<string, RequestHandler>} RequestHandlers
 * @typedef {RequestHandlers extends { [P in keyof RequestHandlers]: { type: RequestHandlers[P]["type"], handler: Parameters<RequestHandlers[P]["handler"]>[0] extends RequestMessage["params"] ? RequestHandlers[P]["handler"] : "Request handler params must extend `RequestMessage[\"params\"]`" } } ? RequestHandlers : { [P in keyof RequestHandlers]: { type: RequestHandlers[P]["type"], handler: Parameters<RequestHandlers[P]["handler"]>[0] extends RequestMessage["params"] ? RequestHandlers[P]["handler"] : "Request handler params must extend `RequestMessage[\"params\"]`" } }} ValidateRequestHandlers
 * Validate request handlers. Check if the request handler params extend `RequestMessage["params"]`.
 */
/**
 * Validate request handlers. Check if the request handler params extend `RequestMessage["params"]`.
 * @template {ReadonlyRecord<string, RequestHandler>} RequestHandlers
 * @param {ValidateRequestHandlers<RequestHandlers>} requestHandlers
 * @returns
 */
const validateRequestHandlers = (requestHandlers) => requestHandlers;
/**
 * @template {ReadonlyRecord<string, NotificationHandler>} NotificationHandlers
 * @template {ReadonlyRecord<string, NotificationHandler>} RefineHandlers
 * @typedef {{ readonly [P in keyof NotificationHandlers]: P extends keyof RefineHandlers ? RefineHandlers[P] : NotificationHandlers[P] }} RefineNotificationHandlers
 * Refine notification handlers type according to pre-defined protocol notification handlers.
 */
/**
 * @template {ReadonlyRecord<string, NotificationHandler>} NotificationHandlers
 * @typedef {NotificationHandlers extends { [P in keyof NotificationHandlers]: Parameters<NotificationHandlers[P]>[0] extends NotificationMessage["params"] ? NotificationHandlers[P] : "Notification handler params must extend `NotificationMessage[\"params\"]`" } ? NotificationHandlers : { [P in keyof NotificationHandlers]: Parameters<NotificationHandlers[P]>[0] extends NotificationMessage["params"] ? NotificationHandlers[P] : "Notification handler params must extend `NotificationMessage[\"params\"]`" }} ValidateNotificationHandlers
 * Validate notification handlers. Check if the notification handler params extend `NotificationMessage["params"]`.
 */
/**
 * Validate notification handlers. Check if the notification handler params extend `NotificationMessage["params"]`.
 * @template {ReadonlyRecord<string, NotificationHandler>} NotificationHandlers
 * @param {ValidateNotificationHandlers<NotificationHandlers>} notificationHandlers
 * @returns
 */
const validateNotificationHandlers = (notificationHandlers) => notificationHandlers;

/**
 * @exports
 * @typedef {object} ClientContext LSP client context.
 * @property {import("child_process").ChildProcessWithoutNullStreams} server The LSP server, represented as a child process.
 * @property {Logger} logger A logger that logs a message to the console.
 * @property {(data: Message) => void} send Send a JSON-RPC message to the LSP server.
 */

/**
 * @exports
 * @typedef {ReturnType<typeof _prepareProtocolRequestHandlers>} ProtocolRequestHandlers Protocol request handlers.
 */
/**
 * Prepare protocol request handlers.
 * @param {ClientContext} context
 * @returns
 */
const _prepareProtocolRequestHandlers = (context) => {
  const { server, logger, send } = context;

  return validateRequestHandlers({
    "client/registerCapability": {
      type: "mutation",
      /**
       * The `client/registerCapability` request is sent from the server to the client to register
       * for a new capability on the client side. Not all clients need to support dynamic capability
       * registration. A client opts in via the `dynamicRegistration` property on the specific
       * client capabilities. A client can even provide dynamic registration for capability A but
       * not for capability B (see `TextDocumentClientCapabilities` as an example).
       *
       * Server must not register the same capability both statically through the initialize result
       * and dynamically for the same document selector. If a server wants to support both static
       * and dynamic registration it needs to check the client capability in the initialize request
       * and only register the capability statically if the client doesn’t support dynamic
       * registration for that capability.
       * @param {RegistrationParams} param_0
       */
      handler: ({ registrations }, success, error) => {
        // To be implemented by an actual implementation
        success(null);
      },
    },
    "client/unregisterCapability": {
      type: "mutation",
      /**
       * The `client/unregisterCapability` request is sent from the server to the client to unregister
       * a previously registered capability.
       * @param {UnregistrationParams} param_0
       */
      handler: ({ unregisterations }, success, error) => {
        // To be implemented by an actual implementation
        success(null);
      },
    },
  });
};
/**
 * @exports
 * @typedef {ReturnType<typeof _prepareProtocolNotificationHandlers>} ProtocolNotificationHandlers Protocol notification handlers.
 */
/**
 * Prepare protocol notification handlers.
 * @param {ClientContext} context
 * @returns
 */
const _prepareProtocolNotificationHandlers = (context) => {
  const { server, logger, send } = context;

  return validateNotificationHandlers({
    /**
     * Invoked when received a `$/cancelRequest` notification from the server.
     * @param {CancelParams} param_0
     */
    "$/cancelRequest": ({ id }) => {
      // TODO: Implement it
    },
    /**
     * Invoked when received a `$/progress` notification from the server.
     * @param {ProgressParams} param_0
     */
    "$/progress": ({ token, value }) => {
      // To be implemented by an actual implementation
    },

    /**
     * A notification to log the trace of the server’s execution. The amount and content of these
     * notifications depends on the current `trace` configuration. If `trace` is `"off"`, the server
     * should not send any `$/logTrace` notification. If trace is `"messages"`, the server should
     * not add the `"verbose"` field in the LogTraceParams.
     *
     * `$/logTrace` should only be used for systematic trace reporting. For single debugging
     * messages, the server should send `window/logMessage` notifications.
     * @param {LogTraceParams} param_0
     */
    "$/logTrace": ({ message, verbose }) => {
      // To be implemented by an actual implementation
    },
  });
};

/**
 * @template {ReadonlyRecord<string, RequestHandler>} RequestHandlers
 * @template {ReadonlyRecord<string, NotificationHandler>} NotificationHandlers
 * @typedef {object} ClientOptions
 * @property {"debug" | "error" | false} [logging] Logging level. `false` to disable logging; `"error"` to log errors only; `"debug"` to log everything. Defaults to `"error"`.
 * @property {string} [serverName] Name of the server. Used for logging. Defaults to `""`, i.e. no name.
 * @property {RefineRequestHandlers<RequestHandlers, ProtocolRequestHandlers>} [requestHandlers] Request handlers by method name. Invoked when a request is received from the server. Defaults to `{}`.
 * @property {RefineNotificationHandlers<NotificationHandlers, ProtocolNotificationHandlers>} [notificationHandlers] Notification handlers by method name. Invoked when a notification is received from the server. Defaults to `{}`.
 */
/**
 * @template {ClientOptions<any, any>} Options
 * @typedef {{ [P in keyof Options]: P extends "requestHandlers" ? Options[P] extends ReadonlyRecord<string, RequestHandler> ? ValidateRequestHandlers<Options[P]> : never : P extends "notificationHandlers" ? Options[P] extends ReadonlyRecord<string, NotificationHandler> ? ValidateNotificationHandlers<Options[P]> : never : Options[P] }} ValidateClientOptions Validate client options.
 */

/**
 * Create a LSP client.
 * @template {ReadonlyRecord<string, RequestHandler>} RequestHandlers
 * @template {ReadonlyRecord<string, NotificationHandler>} NotificationHandlers
 * @param {import("child_process").ChildProcessWithoutNullStreams} server
 * @param {ClientOptions<RequestHandlers, NotificationHandlers>} [options]
 * @returns
 */
const createClient = (server, options) => {
  /**
   * @typedef {RefineRequestHandlers<RequestHandlers, ProtocolRequestHandlers>} RefinedRequestHandlers
   */
  /**
   * @typedef {RefineNotificationHandlers<NotificationHandlers, ProtocolNotificationHandlers>} RefinedNotificationHandlers
   */

  const {
    logging = "error",
    serverName = "",
    requestHandlers = /** @type {RefinedRequestHandlers} */ ({}),
    notificationHandlers = /** @type {RefinedNotificationHandlers} */ ({}),
  } = options ?? {};

  /**
   * Send a JSON-RPC Message to the LSP server.
   * @param {Message} data
   */
  const _send = (data) => {
    const dataString = JSON.stringify(data);
    const contentLength = Buffer.byteLength(dataString, "utf8");
    const rpcString = `Content-Length: ${contentLength}\r\n\r\n${dataString}`;
    server.stdin.write(rpcString);
  };

  const logger = createLogger({
    prefix: `\x1b[1m${serverName && serverName + " "}LSP:\x1b[0m `,
    block: {
      prefix: `${serverName && serverName + " "}LSP `,
    },
  });

  /** @satisfies {ClientContext} */
  const context = { server, logger, send: _send };

  /** @type {Map<integer | string, readonly ["query" | "mutation", string, (value: string | number | boolean | LSPObject | LSPArray | null) => void]>} */
  const resolveMap = new Map();
  /** @type {Map<integer | string, readonly ["query" | "mutation", string, (reason: ResponseError) => void]>} */
  const rejectMap = new Map();

  const _protocolRequestHandlers = _prepareProtocolRequestHandlers(context);
  const _protocolNotificationHandlers = _prepareProtocolNotificationHandlers(context);

  /* Merge user handlers with protocol handlers */
  for (const [method, { type, handler }] of Object.entries(requestHandlers)) {
    if (!(method in _protocolRequestHandlers)) continue;
    const { type: protocolType } =
      _protocolRequestHandlers[/** @type {keyof typeof _protocolRequestHandlers} */ (method)];
    if (type !== protocolType) {
      Object.defineProperty(requestHandlers, method, {
        value: { type: protocolType, handler },
        enumerable: true,
      });
      if (logging)
        logger.warn(
          `Request handler type (${type}) mismatch for protocol method \`${method}\`,` +
            ` using protocol type (${protocolType}) instead`
        );
    }
    if (logging === "debug")
      logger.debug(`Overwriting request handler for protocol method \`${method}\``);
  }
  for (const [method] of Object.entries(notificationHandlers)) {
    if (!(method in _protocolNotificationHandlers)) continue;
    if (logging === "debug")
      logger.debug(`Overwriting notification handler for protocol method \`${method}\``);
  }

  /**
   * Send a success response to LSP server.
   * @param {"query" | "mutation"} type
   * @param {boolean} isProtocol
   * @param {?integer | string} id
   * @param {string} method
   * @param {string | number | boolean | LSPArray | LSPObject | null} value
   */
  const _success = (type, isProtocol, id, method, value) => {
    /** @satisfies {SuccessResponseMessage} */
    const response = {
      jsonrpc: JSONRPC_VERSION,
      id,
      result: value,
    };
    _send(response);

    // Log to console
    if (logging === "debug") {
      const color = type === "query" ? "#49cc90" : "purple";
      logger.block
        .overwrite({ color })
        .debug(`>> [${id}] ${isProtocol ? "[Protocol] " : ""}Response ${method}`, value);
    }
  };
  /**
   * Send an error response to LSP server.
   * @param {boolean} isProtocol
   * @param {?integer | string} id
   * @param {string} method
   * @param {ResponseError} reason
   */
  const _error = (isProtocol, id, method, reason) => {
    /** @satisfies {ErrorResponseMessage} */
    const response = {
      jsonrpc: JSONRPC_VERSION,
      id,
      error: reason,
    };
    _send(response);

    // Log to console
    if (logging === "debug") {
      const errorCode = reason.code;
      const errorData = reason.data;
      logger.block
        .overwrite({ color: "crimson" })
        .debug(
          `>> [${id}] ${isProtocol ? "[Protocol] " : ""}Error Response ${method} ${formatErrorCode(
            errorCode
          )}`,
          "\n" + reason.message,
          ...(errorData !== undefined ? [errorData] : [])
        );
    }
  };

  // Listen to server stdout
  server.stdout.on("data", (data) => {
    /** @type {string} */
    const rawString = data.toString("utf8");
    const payloadStrings = rawString.split(/Content-Length: \d+\r\n\r\n/).filter((s) => s);

    for (const payloadString of payloadStrings) {
      /** @type {Record<string, unknown>} */
      let payload;
      try {
        payload = JSON.parse(payloadString);
      } catch (e) {
        if (logging) logger.error(`Unable to parse payload: ${payloadString}`, e);
        return;
      }

      if (isResponseMessage(payload)) {
        if ("error" in payload) {
          const typeAndMethodAndReject =
            payload.id === null ? undefined : rejectMap.get(payload.id);
          if (payload.id !== null && !typeAndMethodAndReject) {
            if (logging) {
              const errorCode = payload.error.code;
              const errorData = payload.error.data;
              logger.error(
                `Unable to find reject function for id ${payload.id}`,
                `\nError Response ${formatErrorCode(errorCode)}\n${payload.error.message}`,
                ...(errorData !== undefined ? [errorData] : [])
              );
            }
          } else {
            /** @type {?string} */
            let method = null;
            if (payload.id !== null && typeAndMethodAndReject) {
              const [, m, reject] = typeAndMethodAndReject;
              method = m;
              reject(payload.error);
              rejectMap.delete(payload.id);
            }

            // Log to console
            if (logging) {
              const errorCode = payload.error.code;
              const errorData = payload.error.data;
              logger.block
                .overwrite({ color: "crimson" })
                .error(
                  `<< ${formatId(payload.id)}` +
                    `${formatMethod(method)} Error Response ${formatErrorCode(errorCode)}`,
                  "\n" + payload.error.message,
                  ...(errorData !== undefined ? [errorData] : [])
                );
            }
          }
        } else {
          const typeAndMethodAndResolve =
            payload.id === null ? undefined : resolveMap.get(payload.id);
          if (payload.id !== null && !typeAndMethodAndResolve) {
            if (logging)
              logger.error(`Unable to find resolve function for id ${payload.id}`, payload.result);
          } else {
            /** @type {?"query" | "mutation"} */
            let type = null;
            /** @type {?string} */
            let method = null;
            if (payload.id !== null && typeAndMethodAndResolve) {
              const [t, m, resolve] = typeAndMethodAndResolve;
              type = t;
              method = m;
              resolve(payload.result);
              resolveMap.delete(payload.id);
            }

            if (logging === "debug") {
              const color =
                type === "query" ? "#49cc90" : type === "mutation" ? "purple" : "lightgray";
              logger.block
                .overwrite({ color })
                .debug(
                  `<< ${formatId(payload.id)}${formatMethod(method)} Response`,
                  payload.result
                );
            }
          }
        }
      } else if (isRequestMessage(payload)) {
        const request = payload;

        let loggingSuppressed = false;

        if (request.method.startsWith("$/")) {
          const typeAndHandler =
            requestHandlers[request.method] ??
            _protocolRequestHandlers[
              /** @type {keyof typeof _protocolRequestHandlers} */ (request.method)
            ];

          if (!typeAndHandler) {
            _error(true, request.id, request.method, {
              code: ErrorCodes.MethodNotFound,
              message: `Method not found: ${request.method}`,
            });

            if (logging)
              logger.error(
                `Request handler not found for method ${request.method} with id ${request.id}`
              );
          } else {
            const { type, handler } = typeAndHandler;
            handler(
              castNever(request.params),
              (value) => _success(type, true, request.id, request.method, value),
              (reason) => _error(true, request.id, request.method, reason),
              {
                ...context,
                suppressLogging: () => {
                  loggingSuppressed = true;
                },
              }
            );
          }
        } else {
          const typeAndHandler =
            requestHandlers[request.method] ??
            _protocolRequestHandlers[
              /** @type {keyof typeof _protocolRequestHandlers} */ (request.method)
            ];

          if (typeAndHandler) {
            const { type, handler } = typeAndHandler;
            handler(
              castNever(request.params),
              (value) =>
                _success(
                  type,
                  request.method in _protocolRequestHandlers,
                  request.id,
                  request.method,
                  value
                ),
              (reason) =>
                _error(
                  request.method in _protocolRequestHandlers,
                  request.id,
                  request.method,
                  reason
                ),
              {
                ...context,
                suppressLogging: () => {
                  loggingSuppressed = true;
                },
              }
            );
          }
        }

        if (logging === "debug" && !loggingSuppressed) {
          const typeAndHandler =
            requestHandlers[request.method] ??
            _protocolRequestHandlers[
              /** @type {keyof typeof _protocolRequestHandlers} */ (request.method)
            ];
          const type = typeAndHandler?.type ?? "unknown";
          const color = type === "query" ? "#49cc90" : type === "mutation" ? "purple" : "gray";
          logger.block
            .overwrite({ color })
            .debug(
              `<< [${request.id}] ${
                request.method in _protocolRequestHandlers
                  ? "[Protocol] "
                  : requestHandlers[payload.method]
                  ? ""
                  : "[Ignored] "
              }${request.method} Request`,
              ...(request.params !== undefined ? [request.params] : [])
            );
        }
      } else if (isNotificationMessage(payload)) {
        let loggingSuppressed = false;

        void notificationHandlers[payload.method]?.(castNever(payload.params), {
          ...context,
          suppressLogging: () => {
            loggingSuppressed = true;
          },
        });

        if (logging === "debug" && !loggingSuppressed)
          logger.block
            .overwrite({ color: "lightgray" })
            .debug(
              `<< ${notificationHandlers[payload.method] ? "" : "[Ignored] "}${
                payload.method
              } Notification`,
              ...(payload.params ? [payload.params] : [])
            );
      } else {
        if (logging) logger.error(`Invalid payload`, payload);
      }
    }
  });
  // End

  let requestId = 0;

  const result = {
    logger,

    requestHandlers:
      /** @type {Equals<RequestHandlers, RefineRequestHandlers<ReadonlyRecord<string, RequestHandler>, ProtocolRequestHandlers>> extends true ? Record<string, never> : RefinedRequestHandlers} */ (
        requestHandlers
      ),
    notificationHandlers:
      /** @type {Equals<NotificationHandlers, RefineNotificationHandlers<ReadonlyRecord<string, NotificationHandler>, ProtocolNotificationHandlers>> extends true ? Record<string, never> : RefinedNotificationHandlers} */ (
        notificationHandlers
      ),
    protocolRequestHandlers: _protocolRequestHandlers,
    protocolNotificationHandlers: _protocolNotificationHandlers,

    /**
     * @readonly
     */
    request: Object.assign(
      /**
       * Send a request to LSP server.
       * @template {string | number | boolean | LSPArray | LSPObject | null} [R = string | number | boolean | LSPArray | LSPObject | null]
       * @param {"query" | "mutation"} type
       * @param {string} method
       * @param {LSPArray | LSPObject} [params]
       * @returns {ResponsePromise<R>}
       */
      (type, method, params) => {
        /** @satisfies {RequestMessage} */
        const request = {
          jsonrpc: JSONRPC_VERSION,
          id: ++requestId,
          method,
          ...(params && { params }),
        };
        _send(request);

        // Log to console
        if (logging === "debug") {
          const color = type === "query" ? "#49cc90" : "purple";
          logger.block
            .overwrite({ color })
            .debug(
              `>> [${requestId}] Request ${method}`,
              ...(params !== undefined ? [params] : [])
            );
        }

        const result = Object.assign(
          /** @type {Promise<R>} */
          (
            new Promise((resolve, reject) => {
              resolveMap.set(requestId, [
                type,
                method,
                (value) => {
                  result.status = "fulfilled";
                  resolve(castNever(value));
                },
              ]);
              rejectMap.set(requestId, [
                type,
                method,
                (reason) => {
                  result.status = "rejected";
                  reject(reason);
                },
              ]);
            })
          ),
          /** @satisfies {Readonly<_BaseResponsePromise>} */
          ({
            /** @type {"pending" | "fulfilled" | "rejected"} */
            status: "pending",
            id: requestId,
            cancel: () => {
              if (result.status !== "pending") {
                if (logging)
                  logger.error(
                    `Unable to cancel request with id ${requestId} because it is already ${result.status}`
                  );

                throw new Error(
                  `Unable to cancel request with id ${requestId} because it is already ${result.status}`
                );
              }

              _notify("$/cancelRequest", /** @satisfies {CancelParams} */ ({ id: requestId }));
              resolveMap.delete(requestId);
              rejectMap.delete(requestId);
            },
          })
        );

        return result;
      },
      /**
       * Request methods.
       * @readonly
       */
      pin({
        /**
         * The initialize request is sent as the first request from the client to the server. If the
         * server receives a request or notification before the `initialize` request it should act
         * as follows:
         *
         * - For a request the response should be an error with code: -32002. The message can be
         * picked by the server.
         * - Notifications should be dropped, except for the exit notification. This will allow the
         * exit of a server without an initialize request.
         *
         * Until the server has responded to the `initialize` request with an `InitializeResult`,
         * the client must not send any additional requests or notifications to the server. In
         * addition the server is not allowed to send any requests or notifications to the client
         * until it has responded with an `InitializeResult`, with the exception that during the
         * `initialize` request the server is allowed to send the notifications
         * `window/showMessage`, `window/logMessage` and `telemetry/event` as well as the
         * `window/showMessageRequest` request to the client. In case the client sets up a progress
         * token in the initialize params (e.g. property `workDoneToken`) the server is also allowed
         * to use that token (and only that token) using the `$/progress` notification sent from the
         * server to the client.
         *
         * The `initialize` request may only be sent once.
         * @param {InitializeParams} params
         * @returns {ResponsePromise<InitializeResult>}
         */
        initialize: (params) => _mutate("initialize", params),
        /**
         * The shutdown request is sent from the client to the server. It asks the server to shut
         * down, but to not exit (otherwise the response might not be delivered correctly to the
         * client). There is a separate exit notification that asks the server to exit. Clients must
         * not send any notifications other than `exit` or requests to a server to which they have
         * sent a shutdown request. Clients should also wait with sending the exit notification
         * until they have received a response from the `shutdown` request.
         *
         * If a server receives requests after a shutdown request those requests should error with
         * `InvalidRequest`.
         * @returns {ResponsePromise<null>}
         */
        shutdown: () => _mutate("shutdown"),
      })
    ),
    /**
     * Send a query request to LSP server.
     * @readonly
     * @template {string | number | boolean | LSPArray | LSPObject | null} [R = string | number | boolean | LSPArray | LSPObject | null]
     * @param {string} method
     * @param {LSPArray | LSPObject} [params]
     * @returns {ResponsePromise<R>}
     */
    query: (method, params) => _request("query", method, params),
    /**
     * Send a mutation request to LSP server.
     * @readonly
     * @template {string | number | boolean | LSPArray | LSPObject | null} [R = string | number | boolean | LSPArray | LSPObject | null]
     * @param {string} method
     * @param {LSPArray | LSPObject} [payload]
     * @returns {ResponsePromise<R>}
     */
    mutate: (method, payload) => _request("mutation", method, payload),

    /**
     * Send a notification to LSP server.
     * @readonly
     * @param {string} method
     * @param {LSPArray | LSPObject} [params]
     */
    notify: (method, params) => {
      /** @satisfies {NotificationMessage} */
      const notification = {
        jsonrpc: JSONRPC_VERSION,
        method,
        ...(params && { params }),
      };
      _send(notification);

      // Log to console
      if (logging === "debug")
        logger.block
          .overwrite({ color: "lightgray" })
          .debug(`>> Notification ${method}`, ...(params ? [params] : []));
    },

    /**
     * Notification methods.
     * @readonly
     */
    notification: pin({
      /**
       * The initialized notification is sent from the client to the server after the client
       * received the result of the `initialize` request but before the client is sending any
       * other request or notification to the server. The server can use the `initialized`
       * notification for example to dynamically register capabilities.
       *
       * The `initialized` notification may only be sent once.
       */
      initialized: () => _notify("initialized", {}),
      /**
       * A notification that should be used by the client to modify the trace setting of the server.
       * @readonly
       * @param {SetTraceParams} params
       */
      setTrace: (params) => _notify("$/setTrace", params),
      /**
       * A notification to ask the server to exit its process. The server should exit with `success`
       * code 0 if the shutdown request has been received before; otherwise with `error` code 1.
       */
      exit: () => _notify("exit"),

      /**
       * Text document notifications.
       */
      textDocument: pin({
        /**
         * The document open notification is sent from the client to the server to signal newly opened
         * text documents. The document’s content is now managed by the client and the server must not
         * try to read the document’s content using the document’s Uri. Open in this sense means it is
         * managed by the client. It doesn’t necessarily mean that its content is presented in an
         * editor. An open notification must not be sent more than once without a corresponding close
         * notification send before. This means open and close notification must be balanced and the
         * max open count for a particular textDocument is one. Note that a server’s ability to
         * fulfill requests is independent of whether a text document is open or closed.
         *
         * The `DidOpenTextDocumentParams` contain the language id the document is associated with. If
         * the language id of a document changes, the client needs to send a `textDocument/didClose`
         * to the server followed by a `textDocument/didOpen` with the new language id if the server
         * handles the new language id as well.
         * @param {DidOpenTextDocumentParams} params
         */
        didOpen: (params) => _notify("textDocument/didOpen", params),
        /**
         * The document change notification is sent from the client to the server to signal changes to
         * a text document. Before a client can change a text document it must claim ownership of its
         * content using the `textDocument/didOpen` notification. In 2.0 the shape of the params has
         * changed to include proper version numbers.
         * @param {DidChangeTextDocumentParams} params
         */
        didChange: (params) => _notify("textDocument/didChange", params),
        /**
         * The document close notification is sent from the client to the server when the document
         * got closed in the client. The document’s master now exists where the document’s Uri
         * points to (e.g. if the document’s Uri is a file Uri the master now exists on disk). As
         * with the open notification the close notification is about managing the document’s
         * content. Receiving a close notification doesn’t mean that the document was open in an
         * editor before. A close notification requires a previous open notification to be sent.
         * Note that a server’s ability to fulfill requests is independent of whether a text
         * document is open or closed.
         * @param {DidCloseTextDocumentParams} params
         */
        didClose: (params) => _notify("textDocument/didClose", params),
      }),

      /**
       * Workspace notifications.
       * @readonly
       */
      workspace: pin({
        /**
         * The `workspace/didChangeWorkspaceFolders` notification is sent from the client to the
         * server to inform the server about workspace folder configuration changes. A server can
         * register for this notification by using either the *server capability*
         * `workspace.workspaceFolders.changeNotifications` or by using the dynamic capability
         * registration mechanism. To dynamically register for the
         * `workspace/didChangeWorkspaceFolders` send a `client/registerCapability` request from
         * the server to the client. The registration parameter must have a `registrations` item of
         * the following form, where id is a unique `id` used to unregister the capability (the
         * example uses a UUID).
         * @param {DidChangeWorkspaceFoldersParams} params
         */
        didChangeWorkspaceFolders: (params) =>
          _notify("workspace/didChangeWorkspaceFolders", params),
      }),
    }),
  };

  const _request = result.request;
  const _query = result.query;
  const _mutate = result.mutate;
  const _notify = result.notify;

  return result;
};

/**********************
 * Copilot LSP client *
 **********************/
/**
 * @exports
 * @typedef {"MaybeOk" | "NotAuthorized" | "NotSignedIn" | "OK"} CopilotAccountStatus Copilot account status.
 */

/**
 * @exports
 * @typedef {"InProgress" | "Warning" | "Normal"} CopilotStatus Copilot status.
 */

/**
 * @exports
 * @typedef {object} CompletionOptions
 * @property {number} [tabSize] Tab size, such as `2` or `4`. Defaults to `4`.
 * @property {number} [indentSize] Indent size, if you do not understand this, do not provide it. Defaults to `tabSize`.
 * @property {boolean} [insertSpaces] Whether to insert spaces instead of tabs. Defaults to `true`.
 * @property {string} [path] Path to the file. If provided and `uri` is not provided, `uri` will be automatically generated using `pathToFileURL(path)` provided by Node.js `url` module. Defaults to `""`.
 * @property {string} [uri] URI of the file. If not provided but `path` is provided, it will be automatically generate using `pathToFileURL(path)` provided by Node.js `url` module.
 * @property {string} [relativePath] Relative path of the file. Usually it should be relative to the project root. Defaults to `path`.
 * @property {LanguageId} [languageId] Language ID of the file, such as `"javascript"` or `"python"`. Defaults to `""`.
 * @property {Position} position Position of the cursor. `line` is row number, starting from `0`. `character` is column number, starting from `0`. Defaults to end of `source`.
 * @property {number} [version] Version of the buffer. It actually means the number of times the buffer has been changed. Defaults to `this.version`.
 */

/**
 * @exports
 * @typedef {object} CompletionResult
 * @property {readonly Completion[]} completions The completion text.
 * @property {string} [cancellationReason] Cancellation reason.
 */
/**
 * @exports
 * @typedef {object} Completion
 * @property {string} uuid UUID.
 * @property {Position} position
 * @property {Range} range
 * @property {number} docVersion
 * @property {string} text
 * @property {string} displayText
 */

/**
 * @exports
 * @callback CopilotChangeStatusHandler Copilot change status handler.
 * @param {CopilotChangeStatusEvent} ev Copilot change status event.
 * @returns {void | Promise<void>}
 */
/**
 * @exports
 * @typedef {object} CopilotChangeStatusEvent Copilot change status event.
 * @property {CopilotStatus} oldStatus Old status.
 * @property {CopilotStatus} newStatus New status.
 */

/**
 * Create a Copilot LSP client.
 * @template {ReadonlyRecord<string, RequestHandler>} RequestHandlers
 * @template {ReadonlyRecord<string, NotificationHandler>} NotificationHandlers
 * @param {import("child_process").ChildProcessWithoutNullStreams} server
 * @param {Omit<ClientOptions<RequestHandlers, NotificationHandlers>, "serverName">} [options]
 * @returns
 */
const createCopilotClient = (server, options) => {
  const client = createClient(server, {
    ...options,
    notificationHandlers: {
      /**
       * Log message to console.
       * @param {{ level: integer; message: string; metadataStr: string; extra?: LSPArray }} param_0
       */
      LogMessage: ({ message, extra }, { logger, suppressLogging }) => {
        suppressLogging();
        logger.debug(message, ...(extra ? [extra] : []));
      },
      /**
       * Show message to user.
       * @param {{ message: string; status: "InProgress" | "Normal" | "Warning" }} param0
       */
      statusNotification: ({ status }) => {
        const oldStatus = result.status;
        const newStatus = status;
        result.status = newStatus;
        _eventHandlers.get("changeStatus")?.forEach((handler) => {
          void handler({ oldStatus, newStatus });
        });
      },

      ...options?.notificationHandlers,
    },
    serverName: "Copilot",
  });

  /**
   * Prepare completion params for requests such as `getCompletions` and `getCompletionsCycling`.
   * @param {CompletionOptions} options
   * @returns
   */
  const _prepareCompletionParams = (options) => {
    const {
      tabSize = 4,
      indentSize = tabSize,
      insertSpaces = true,
      path = "",
      uri = path && pathToFileURL(path).href,
      relativePath = path,
      languageId = "",
      position,
      version = result.version,
    } = options;

    return {
      doc: {
        tabSize,
        indentSize,
        insertSpaces,
        path,
        uri,
        relativePath,
        languageId,
        position,
        version,
      },
    };
  };

  /** @type {CopilotStatus} */
  let _status = "Normal";
  /** @type {Map<string, Array<(ev: any) => void | Promise<void>>>} */
  const _eventHandlers = new Map();

  const result = {
    /**
     * @readonly
     */
    logger: client.logger,

    // Mutable properties start
    /**
     * Version of the buffer. It actually means the number of times the buffer has been changed.
     */
    version: 0,
    /**
     * Status of Copilot.
     * @type {CopilotStatus}
     */
    get status() {
      return _status;
    },
    set status(value) {
      if (value !== _status) {
        _status = value;
        _eventHandlers.get("changeStatus")?.forEach((handler) => {
          void handler({ oldStatus: _status, newStatus: value });
        });
      }
    },
    // Mutable properties end

    /**
     * Request methods.
     * @readonly
     */
    request: pin({
      ...client.request,

      /**
       * Get version of Copilot.
       * @returns {ResponsePromise<{ buildType: string; runtimeVersion: string; version: string }>}
       */
      getVersion: () => client.query("getVersion", {}),

      /**
       * Check status of Copilot.
       * @param {{ localChecksOnly?: boolean }} [options]
       * @returns {ResponsePromise<{ status: CopilotAccountStatus; user?: string }>}
       */
      checkStatus: (options) => client.query("checkStatus", options ?? {}),

      /**
       * Initiate Copilot sign in.
       * @returns {ResponsePromise<{ verificationUri: string; status: string; userCode: string; expiresIn: number; interval: number }>}
       */
      signInInitiate: () => client.mutate("signInInitiate", {}),
      /**
       * Confirm Copilot sign in.
       * @param {{ userCode: string }} options
       * @returns {ResponsePromise<{ status: CopilotAccountStatus; user: string }>}
       */
      signInConfirm: (options) => client.mutate("signInConfirm", options),
      /**
       * Sign out Copilot.
       * @returns {ResponsePromise<{ status: "NotSignedIn" }>}
       */
      signOut: () => client.mutate("signOut", {}),

      /**
       * Set editor info.
       * @param {{ editorInfo: { name: string; version: string }; editorPluginInfo: { name: string; version: string }}} options
       * @returns {ResponsePromise<"OK">}
       */
      setEditorInfo: (options) => client.mutate("setEditorInfo", options),

      /**
       * Get completions.
       * @param {CompletionOptions} options
       * @returns {ResponsePromise<CompletionResult>}
       */
      getCompletions: (options) =>
        client.query("getCompletions", _prepareCompletionParams(options)),
      /**
       * Get cycling completions (i.e. get the next completion).
       * @param {CompletionOptions} options
       * @returns
       */
      getCompletionsCycling: (options) =>
        client.query("getCompletionsCycling", _prepareCompletionParams(options)),
    }),

    /**
     * Notification methods.
     * @readonly
     */
    notification: pin({
      ...client.notification,

      /**
       * Notify Copilot that the completion is shown.
       * @param {{ uuid: string }} options
       */
      notifyShown: (options) => client.notify("notifyShown", options),
      /**
       * Notify Copilot that the completion is accepted.
       * @param {{ uuid: string }} options
       */
      notifyAccepted: (options) => client.notify("notifyAccepted", options),
      /**
       * Notify Copilot that the completion is rejected.
       * @param {{ uuids: readonly string[] }} options
       */
      notifyRejected: (options) => client.notify("notifyRejected", options),
    }),

    /**
     * Add event handler.
     * @type {{ (event: "changeStatus", handler: CopilotChangeStatusHandler): void; }}
     * @readonly
     */
    on: (event, handler) => {
      const handlers = _eventHandlers.get(event) ?? [];
      handlers.push(handler);
      _eventHandlers.set(event, handlers);
    },
    /**
     * Remove event handler.
     * @type {{ (event: "changeStatus", handler: CopilotChangeStatusHandler): void; }}
     * @readonly
     */
    off: (event, handler) => {
      const handlers = _eventHandlers.get(event) ?? [];
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
      _eventHandlers.set(event, handlers);
    },
  };

  return result;
};

/********
 * Main *
 ********/
const COPILOT_DIR = /** @type {string} */ (getGlobalVar("__copilotDir"));
const COPILOT_ICON_PATHNAME = path.join(COPILOT_DIR, "assets/copilot-icon.png");
const COPILOT_WARNING_ICON_PATHNAME = path.join(COPILOT_DIR, "assets/copilot-icon-warning.png");

const server = fork(path.join(COPILOT_DIR, "language-server/agent"), { silent: true });

const logger = createLogger({ prefix: `\x1b[1mCopilot plugin:\x1b[0m ` });
logger.info("Copilot plugin activated. Version:", VERSION);
logger.debug("Copilot LSP server started. PID:", server.pid);

/**
 * Copilot LSP client.
 */
const copilot = createCopilotClient(
  /** @type {import("child_process").ChildProcessWithoutNullStreams} */ (server),
  { logging: "debug" }
);
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
const FAKE_TEMP_WORKSPACE_FOLDER =
  window?.process?.platform === "win32"
    ? "C:\\Users\\FakeUser\\FakeTyporaCopilotWorkspace"
    : "/home/fakeuser/faketyporacopilotworkspace";
const FAKE_TEMP_FILENAME = "typora-copilot-fake-markdown.md";

/* Footer stuff start */
/** @type {HTMLElement | null} */
const footerContainer = document.querySelector("footer.ty-footer");
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
    `Copilot (${status === "Normal" ? "Ready" : status === "InProgress" ? "In Progress" : status})`
  );
});

/**
 * Create Copilot footer icon DOM element by status.
 * @param {CopilotStatus} status
 */
const createCopilotIcon = (status) => {
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
        path.sep
      )
    )}')`;
    result.style.maskImage = `url('${path.posix.join(
      ...(status === "Normal" ? COPILOT_ICON_PATHNAME : COPILOT_WARNING_ICON_PATHNAME).split(
        path.sep
      )
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
 * @param {CopilotAccountStatus} status
 */
const resetAccountStatus = (status) => {
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
footerPanelBtnSignIn.addEventListener("click", async () => {
  const { status, userCode, verificationUri } = await copilot.request.signInInitiate();
  if (status === "AlreadySignedIn") return;
  // Copy user code to clipboard
  navigator.clipboard.writeText(userCode);
  // Open verification URI in browser
  // @ts-expect-error - `electron` is not declared in types
  require("electron").shell.openExternal(verificationUri);
  Files.editor.EditHelper.showDialog({
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
        Files.editor.EditHelper.showDialog({
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
   * @returns {string | null}
   */
  const getWorkspaceFolder = () => editor.library?.watchedFolder ?? null;
  /**
   * Get active file pathname.
   * @returns {string | null}
   */
  const getActiveFilePathname = () =>
    (Files.filePath ?? (Files.bundle && Files.bundle.filePath)) || null;

  /**
   * Get current cursor position in source markdown text.
   * @returns {Position | null}
   */
  const getCursorPos = () => {
    // When selection, return null
    if (sourceView.inSourceMode) {
      if (cm.doc.getSelection()) return null;
    } else {
      const rangy = editor.selection.getRangy();
      if (!rangy) return null;
      if (!rangy.collapsed) return null;
    }

    /* If in source mode, simply return cursor position get from `cm` */
    if (sourceView.inSourceMode) {
      const { line, ch } = cm.doc.getCursor();
      return { line, character: ch };
    }

    /* When in live preview mode, calculate cursor position */
    // First sync `cm` with live preview mode markdown text
    cm.setValue(editor.getMarkdown(), "begin");

    /** @type {Typora.CursorPlacement | null} */
    let placement;
    try {
      placement = getCursorPlacement();
    } catch (e) {
      if (e instanceof Error && e.stack) console.warn(e.stack);
      return null;
    }
    if (!placement) return null;

    /** @type {string | null} */
    let lineContent;
    let ch = placement.ch;

    // If line number is negative, set it to the last line
    if (placement.line < 0) placement.line = cm.doc.lineCount() - 1;

    // Handle indentation after list items, blockquotes, etc.
    if (placement.afterIndent) {
      lineContent = cm.doc.getLine(placement.line);
      ch = (/^((\s+)|([-+*]\s)|(\[( |x)\])|>|(\d+(\.|\))\s))+/i.exec(nonNullish(lineContent)) || [
        "",
      ])[0].length;
    }

    // If character position is not defined
    if (ch === undefined) {
      lineContent = cm.doc.getLine(placement.line) ?? "";
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
   * @param {Completion} options
   * @returns
   */
  const insertCompletionTextToEditor = (options) => {
    const { position, displayText, text, range } = options;

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
      /** @type {Typora.CodeMirror} */
      const cm = /** @type {{ CodeMirror: Typora.CodeMirror }} */ (castUnknown(cms[0])).CodeMirror;
      const subCmCompletion = { ...options };
      const startPos = nonNullish(getCursorPos());
      startPos.line -= cm.getValue().split(Files.useCRLF ? "\r\n" : "\n").length - 1;
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
      const codeBlockStarter = nonNullish(
        state.markdown.split(Files.useCRLF ? "\r\n" : "\n")[startPos.line - 1]
      ).slice(startPos.character, startPos.character + 3);
      // Get only completion text before code block starter, as in Typora code block it is not possible
      // to insert a new code block or end one using "```" or "~~~"
      const indexOfCodeBlockStarter = subCmCompletion.text.indexOf(codeBlockStarter);
      if (indexOfCodeBlockStarter !== -1) {
        subCmCompletion.displayText = subCmCompletion.displayText.slice(
          0,
          subCmCompletion.displayText.indexOf(codeBlockStarter)
        );
        subCmCompletion.text = subCmCompletion.text.slice(0, indexOfCodeBlockStarter);
        const textAfterCodeBlockStarter = subCmCompletion.text.slice(indexOfCodeBlockStarter);
        // Reduce `subCmCompletion.range` to only include text before code block starter
        const rows = textAfterCodeBlockStarter.split(Files.useCRLF ? "\r\n" : "\n").length - 1;
        subCmCompletion.range.end.line -= rows;
        subCmCompletion.range.end.character = nonNullish(
          textAfterCodeBlockStarter.split(Files.useCRLF ? "\r\n" : "\n").pop()
        ).length;
      }
      insertCompletionTextToCodeMirror(cm, subCmCompletion);

      return;
    }

    const focusedElem = /** @type {HTMLElement} */ (
      document.querySelector(`[cid=${editor.focusCid}]`)
    );
    if (!focusedElem) return;
    if (!(focusedElem instanceof HTMLElement)) return;

    /**
     * @returns {{ x: number; y: number } | null}
     */
    const getMouseCursorPosition = () => {
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
      ...COPILOT_ICON_PATHNAME.split(path.sep)
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
      styleActiveLine: true,
      visibleSpace: true,
      autoCloseTags: true,
      resetSelectionOnContextMenu: false,
      lineNumbers: false,
      dragDrop: false,
    });
    code.style.backgroundColor = window.getComputedStyle(document.body).backgroundColor;
    completionPanelCm.getWrapperElement().style.backgroundColor = window.getComputedStyle(
      document.body
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
          Files.useCRLF ? "\r\n" : "\n"
        );
        if (text.startsWith(markdownInRange)) {
          safeToJustUseInsertText = true;
          textToInsert = text.slice(markdownInRange.length);
        }
      }

      if (safeToJustUseInsertText) {
        editor.insertText(textToInsert);
      } else {
        cm.setValue(editor.getMarkdown(), "begin");
        cm.setCursor({ line: position.line, ch: position.character });
        cm.replaceRange(
          text,
          { line: range.start.line, ch: range.start.character },
          { line: range.end.line, ch: range.end.character }
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
     * @param {KeyboardEvent} event
     * @returns
     */
    const keydownHandler = (event) => {
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
   * @param {Typora.CodeMirror} cm
   * @param {Completion} param_1
   * @returns
   */
  const insertCompletionTextToCodeMirror = (cm, { uuid, displayText, position, range, text }) => {
    /**
     * @param {ReturnType<Typora.CodeMirror["getHistory"]>} history
     * @returns {ReturnType<Typora.CodeMirror["getHistory"]>}
     */
    const cloneHistory = (history) => ({
      done: history.done.map((item) =>
        "primIndex" in item
          ? new (castAny(item).constructor)([...castAny(item).ranges], item.primIndex)
          : { ...item, changes: [...castAny(item).changes] }
      ),
      undone: history.undone.map((item) =>
        "primIndex" in item
          ? new (castAny(item).constructor)([...castAny(item).ranges], item.primIndex)
          : { ...item, changes: [...castAny(item).changes] }
      ),
    });

    const cursorBefore = cm.getCursor();
    const historyBefore = cloneHistory(cm.getHistory());
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
      done: cm.getHistory().done,
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
        { line: range.end.line, ch: range.end.character }
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
     * @param {Typora.CodeMirror} _
     * @param {KeyboardEvent} event
     */
    const cmTabFixer = (_, event) => {
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
     * @param {Typora.CodeMirror} cm
     * @param {Typora.CodeMirrorBeforeChangeEvent} param_1
     */
    const cmChangeFixer = (cm, { text, from, to, cancel, origin }) => {
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
          cm.replaceRange(text.join(Files.useCRLF ? "\r\n" : "\n"), from, to, origin);
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
   * @param {?string} newFolder
   * @param {?string} oldFolder
   */
  const onChangeWorkspaceFolder = (newFolder, oldFolder) => {
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
   * @param {?string} newPathname
   * @param {?string} oldPathname
   */
  const onChangeActiveFile = (newPathname, oldPathname) => {
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
    /**
     * @param {string} newMarkdown
     * @param {string} oldMarkdown
     */
    async (newMarkdown, oldMarkdown) => {
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
      const { completions, cancellationReason } = await copilot.request.getCompletions({
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
            changeTimestamp
          );
        else
          logger.debug(
            "Ignoring completion due to text cursor change timestamp mismatch",
            state.latestCursorChangeTimestamp,
            cursorChangeTimestamp
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
      const firstCompletion = nonNullish(completions[0]);
      const { uuid } = firstCompletion;
      completion.latestUUID = uuid;

      if (editor.sourceView.inSourceMode) insertCompletionTextToCodeMirror(cm, firstCompletion);
      else insertCompletionTextToEditor(firstCompletion);
    },
    500
  );

  /*********************
   * Initialize states *
   *********************/
  const editor = /** @type {Typora.EnhancedEditor} */ (Files.editor);
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
  const sourceView = /** @type {Typora.EnhancedSourceView} */ (editor.sourceView);
  if (!sourceView.cm) sourceView.prep();
  const cm = nonNullish(sourceView.cm);
  // Initialize completion state
  const completion = {
    latestUUID: "",
    /**
     * Reject current completion.
     * @type {?() => void}
     */
    reject: null,
    /**
     * Accept current completion.
     * @type {?() => void}
     */
    accept: null,
  };

  /**************************
   * Initialize Copilot LSP *
   **************************/
  /* Send `initialize` request */
  await copilot.request.initialize({
    processId: window?.process?.pid ?? null,
    capabilities: { workspace: { workspaceFolders: true } },
    trace: "verbose",
    rootPath: state.workspaceFolder,
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
  /** @type {Awaited<ReturnType<typeof copilot.request.checkStatus>>} */
  let initialCheckStatusResult;
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
  editor.on("change", (_, { oldMarkdown, newMarkdown }) => {
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
    onChangeMarkdown(newMarkdown, oldMarkdown);
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
    onChangeMarkdown(newMarkdown, oldMarkdown);
  });
};

// Execute `main` function until Typora editor is initialized
void waitUntilEditorInitialized().then(main);
