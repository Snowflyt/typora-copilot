import { pathToFileURL } from "@modules/url";

import { createClient } from "./general-client";

import type {
  ClientOptions,
  NotificationHandler,
  RequestHandler,
  ResponsePromise,
} from "./general-client";
import type {
  LSPArray,
  LSPObject,
  LanguageIdentifier,
  Position,
  Range,
  integer,
} from "./types/lsp";
import type { ReadonlyRecord } from "./types/tools";
import type { ChildProcessWithoutNullStreams } from "@modules/child_process";

/**
 * Copilot account status.
 */
export type CopilotAccountStatus = "MaybeOk" | "NotAuthorized" | "NotSignedIn" | "OK";

/**
 * Copilot status.
 */
export type CopilotStatus = "InProgress" | "Warning" | "Normal";

/**
 * Completion options.
 */
export interface CompletionOptions {
  /**
   * Tab size, such as `2` or `4`. Defaults to `4`.
   */
  tabSize?: number;

  /**
   * Indent size, if you do not understand this, do not provide it. Defaults to `tabSize`.
   */
  indentSize?: number;

  /**
   * Whether to insert spaces instead of tabs. Defaults to `true`.
   */
  insertSpaces?: boolean;

  /**
   * Path to the file. If provided and `uri` is not provided, `uri` will be automatically generated
   * using `pathToFileURL(path)` provided by Node.js `url` module. Defaults to `""`.
   */
  path?: string;

  /**
   * URI of the file. If not provided but `path` is provided, it will be automatically generate
   * using `pathToFileURL(path)` provided by Node.js `url` module.
   */
  uri?: string;

  /**
   * Relative path of the file. Usually it should be relative to the project root. Defaults to
   * `path`.
   */
  relativePath?: string;

  /**
   * Language ID of the file, such as `"javascript"` or `"python"`. Defaults to `""`.
   */
  languageId?: LanguageIdentifier;

  /**
   * Position of the cursor. `line` is row number, starting from `0`. `character` is column number,
   * starting from `0`. Defaults to end of `source`.
   */
  position: Position;

  /**
   * Version of the buffer. It actually means the number of times the buffer has been changed.
   * Defaults to `this.version`.
   */
  version?: number;
}

/**
 * A type representing a completion returned by Copilot.
 */
export interface Completion {
  /**
   * UUID.
   */
  readonly uuid: string;

  /**
   * Position to display `displayText`.
   */
  readonly position: Position;

  /**
   * Range of raw text to replace with `text`.
   */
  readonly range: Range;

  /**
   * Version of the document.
   */
  readonly docVersion: number;

  /**
   * Text to replace.
   */
  readonly text: string;

  /**
   * Text to display.
   */
  readonly displayText: string;
}

/**
 * Result of a completion request.
 */
export interface CompletionResult {
  /**
   * The completion text.
   */
  readonly completions: readonly Completion[];

  /**
   * Cancellation reason.
   */
  readonly cancellationReason?: string;
}

export type CopilotChangeStatusHandler = (ev: CopilotChangeStatusEvent) => void | Promise<void>;

/**
 * Copilot change status event.
 */
export interface CopilotChangeStatusEvent {
  /**
   * Old status.
   */
  readonly oldStatus: CopilotStatus;

  /**
   * New status.
   */
  readonly newStatus: CopilotStatus;
}

export type CopilotClientOptions<
  RequestHandlers extends ReadonlyRecord<string, RequestHandler>,
  NotificationHandlers extends ReadonlyRecord<string, NotificationHandler>,
> = Omit<ClientOptions<RequestHandlers, NotificationHandlers>, "serverName">;

/**
 * Create a Copilot LSP client.
 * @param server
 * @param options
 * @returns
 */
export const createCopilotClient = <
  RequestHandlers extends ReadonlyRecord<string, RequestHandler>,
  NotificationHandlers extends ReadonlyRecord<string, NotificationHandler>,
>(
  server: ChildProcessWithoutNullStreams,
  options?: CopilotClientOptions<RequestHandlers, NotificationHandlers>,
) => {
  const client = createClient(server, {
    ...options,

    notificationHandlers: {
      /**
       * Log message to console.
       */
      LogMessage: (
        {
          extra,
          message,
        }: { level: integer; message: string; metadataStr: string; extra?: LSPArray },
        { logger, suppressLogging },
      ) => {
        suppressLogging();
        logger.debug(message, ...(extra ? [extra] : []));
      },

      /**
       * Show message to user.
       */
      statusNotification: ({
        status,
      }: {
        message: string;
        status: "InProgress" | "Normal" | "Warning";
      }) => {
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
   * @param options Options.
   * @returns
   */
  const _prepareCompletionParams = (options: CompletionOptions) => {
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

  let _status: CopilotStatus = "Normal";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _eventHandlers: Map<string, Array<(ev: any) => void | Promise<void>>> = new Map();

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
    request: {
      ...client.request,

      /**
       * Get version of Copilot.
       * @returns
       */
      getVersion: (): ResponsePromise<{
        buildType: string;
        runtimeVersion: string;
        version: string;
      }> => client.query("getVersion", {}),

      /**
       * Check status of Copilot.
       * @param options Options.
       * @returns
       */
      checkStatus: (options?: {
        localChecksOnly?: boolean;
      }): ResponsePromise<{ status: CopilotAccountStatus; user?: string }> =>
        client.query("checkStatus", options ?? {}),

      /**
       * Initiate Copilot sign in.
       * @returns
       */
      signInInitiate: (): ResponsePromise<{
        verificationUri: string;
        status: string;
        userCode: string;
        expiresIn: number;
        interval: number;
      }> => client.mutate("signInInitiate", {}),
      /**
       * Confirm Copilot sign in.
       * @param options Options.
       * @returns
       */
      signInConfirm: (options: {
        userCode: string;
      }): ResponsePromise<{ status: CopilotAccountStatus; user: string }> =>
        client.mutate("signInConfirm", options),
      /**
       * Sign out Copilot.
       * @returns
       */
      signOut: (): ResponsePromise<{ status: "NotSignedIn" }> => client.mutate("signOut", {}),

      /**
       * Set editor info.
       * @param options Options.
       * @returns
       */
      setEditorInfo: (options: {
        editorInfo: { name: string; version: string };
        editorPluginInfo: { name: string; version: string };
      }): ResponsePromise<"OK"> => client.mutate("setEditorInfo", options),

      /**
       * Get completions.
       * @param options Options.
       * @returns
       */
      getCompletions: (options: CompletionOptions): ResponsePromise<CompletionResult> =>
        client.query(
          "getCompletions",
          _prepareCompletionParams(options) as unknown as LSPObject,
        ) as unknown as ResponsePromise<CompletionResult>,
      /**
       * Get cycling completions (i.e. get the next completion).
       * @param options Options.
       * @returns
       */
      getCompletionsCycling: (options: CompletionOptions) =>
        client.query(
          "getCompletionsCycling",
          _prepareCompletionParams(options) as unknown as LSPObject,
        ),
    } as const,

    /**
     * Notification methods.
     * @readonly
     */
    notification: {
      ...client.notification,

      /**
       * Notify Copilot that the completion is shown.
       * @param options
       */
      notifyShown: (options: { uuid: string }) => client.notify("notifyShown", options),
      /**
       * Notify Copilot that the completion is accepted.
       * @param options
       */
      notifyAccepted: (options: { uuid: string }) => client.notify("notifyAccepted", options),
      /**
       * Notify Copilot that the completion is rejected.
       * @param options
       */
      notifyRejected: (options: { uuids: readonly string[] }) =>
        client.notify("notifyRejected", options),
    },

    /**
     * Add event handler.
     * @readonly
     */
    on: ((event, handler): void => {
      const handlers = _eventHandlers.get(event) ?? [];
      handlers.push(handler);
      _eventHandlers.set(event, handlers);
    }) satisfies {
      (event: "changeStatus", handler: CopilotChangeStatusHandler): void;
    },
    /**
     * Remove event handler.
     * @readonly
     */
    off: ((event, handler): void => {
      const handlers = _eventHandlers.get(event) ?? [];
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
      _eventHandlers.set(event, handlers);
    }) satisfies {
      (event: "changeStatus", handler: CopilotChangeStatusHandler): void;
    },
  };

  return result;
};
