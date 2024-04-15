import { P, match } from "ts-pattern";

import type {
  CancelParams,
  DidChangeTextDocumentParams,
  DidChangeWorkspaceFoldersParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  ErrorResponseMessage,
  InitializeParams,
  InitializeResult,
  LSPAny,
  LSPArray,
  LSPObject,
  LogMessageParams,
  LogTraceParams,
  Message,
  NotificationMessage,
  ProgressParams,
  RegistrationParams,
  RequestMessage,
  ResponseError,
  SetTraceParams,
  SuccessResponseMessage,
  UnregistrationParams,
  integer,
} from "../types/lsp";
import type { Equals, ReadonlyRecord } from "@/types/tools";
import type { Logger } from "@/utils/logging";
import type { NodeServer } from "@modules/child_process";

import { ErrorCodes, JSONRPC_VERSION, MessageType } from "@/types/lsp";
import { createLogger, formatErrorCode, formatId, formatMethod } from "@/utils/logging";
import { isNotificationMessage, isRequestMessage, isResponseMessage } from "@/utils/lsp";
import { isKeyOf } from "@/utils/tools";

/**
 * A promise specially designed for LSP client representing a future response from LSP server that
 * holds the relevant request ID and a `cancel` function to cancel the request.
 */
export interface ResponsePromise<T> extends Promise<T>, _BaseResponsePromise {}
interface _BaseResponsePromise {
  /**
   * Status of the promise.
   */
  readonly status: "fulfilled" | "rejected" | "pending";

  /**
   * ID of the request.
   */
  readonly id: integer | string;

  /**
   * Cancel the request.
   *
   * @throws An error if the promise is not pending.
   */
  readonly cancel: () => void;
}

export interface HandlerContext extends ClientContext {
  /**
   * Suppress logging.
   */
  readonly suppressLogging: () => void;
}

/**
 * Client handler for a LSP request sent from the server. The `type` property actually does nothing,
 * and is only used for logging.
 *
 * Type of `params` in `handler` is defined as `never` because function parameters type are
 * contravariant in TypeScript, so in order to make it possible to refine `params` type, for
 * example, `(params: InitializeParams, success: (value: string) => void, error:
 * (reason: ResponseError) => void, context: HandlerContext) => void` should be compatible with this
 * type, we have to define `params` type as generic as possible, i.e. `never`.
 *
 * To make sure a subtype of this type is valid, i.e. `params` type extends
 * `RequestMessage["params"]`, validate it using `validateRequestHandlers` function.
 */
export type RequestHandler = {
  readonly type: "query" | "mutation";
  readonly handler: (
    params: never,
    success: (value: LSPAny) => void,
    error: (reason: ResponseError) => void,
    context: HandlerContext,
  ) => void | Promise<void>;
};

/**
 * Client handler for a LSP notification sent from the server.
 *
 * Type of `params` is defined as `never` because function parameters type are contravariant in
 * TypeScript, so in order to make it possible to refine `params` type, for example,
 * `(params: CancelParams, context: HandlerContext) => void` should be compatible with this type, we
 * have to define `params` type as generic as possible, i.e. `never`.
 *
 * To make sure a subtype of this type is valid, i.e. `params` type extends
 * `NotificationMessage["params"]`, validate it using `validateNotificationHandlers` function.
 */
export type NotificationHandler = (params: never, context: HandlerContext) => void | Promise<void>;

/**
 * Refine request handlers type according to pre-defined protocol request handlers.
 */
export type RefineRequestHandlers<
  RequestHandlers extends ReadonlyRecord<string, RequestHandler>,
  RefineHandlers extends ReadonlyRecord<string, RequestHandler>,
> = {
  readonly [P in keyof RequestHandlers]: P extends keyof RefineHandlers ? RefineHandlers[P]
  : RequestHandlers[P];
};

/**
 * Validate request handlers. Check if the request handler params extend `LSPArray | LSPObject`.
 */
export type ValidateRequestHandlers<
  RequestHandlers extends ReadonlyRecord<string, RequestHandler>,
> =
  RequestHandlers extends {
    [P in keyof RequestHandlers]: {
      type: RequestHandlers[P]["type"];
      handler: Parameters<RequestHandlers[P]["handler"]>[0] extends LSPArray | LSPObject ?
        RequestHandlers[P]["handler"]
      : "Request handler params must extend `LSPArray | LSPObject`";
    };
  } ?
    RequestHandlers
  : {
      [P in keyof RequestHandlers]: {
        type: RequestHandlers[P]["type"];
        handler: Parameters<RequestHandlers[P]["handler"]>[0] extends LSPArray | LSPObject ?
          RequestHandlers[P]["handler"]
        : "Request handler params must extend `LSPArray | LSPObject`";
      };
    };

/**
 * Validate request handlers. Check if the request handler params extend `LSPArray | LSPObject`.
 * @param requestHandlers
 * @returns
 */
export const validateRequestHandlers = <
  RequestHandlers extends ReadonlyRecord<string, RequestHandler>,
>(
  requestHandlers: ValidateRequestHandlers<RequestHandlers>,
) => requestHandlers;

/**
 * Refine notification handlers type according to pre-defined protocol notification handlers.
 */
export type RefineNotificationHandlers<
  NotificationHandlers extends ReadonlyRecord<string, NotificationHandler>,
  RefineHandlers extends ReadonlyRecord<string, NotificationHandler>,
> = {
  readonly [P in keyof NotificationHandlers]: P extends keyof RefineHandlers ? RefineHandlers[P]
  : NotificationHandlers[P];
};

/**
 * Validate notification handlers. Check if the notification handler params extend `LSPArray | LSPObject`.
 */
export type ValidateNotificationHandlers<
  NotificationHandlers extends ReadonlyRecord<string, NotificationHandler>,
> =
  NotificationHandlers extends {
    [P in keyof NotificationHandlers]: Parameters<NotificationHandlers[P]>[0] extends (
      LSPArray | LSPObject
    ) ?
      NotificationHandlers[P]
    : "Notification handler params must extend `LSPArray | LSPObject`";
  } ?
    NotificationHandlers
  : {
      [P in keyof NotificationHandlers]: Parameters<NotificationHandlers[P]>[0] extends (
        LSPArray | LSPObject
      ) ?
        NotificationHandlers[P]
      : "Notification handler params must extend `LSPArray | LSPObject`";
    };

/**
 * Validate notification handlers. Check if the notification handler params extend `LSPArray | LSPObject`.
 * @param notificationHandlers
 * @returns
 */
export const validateNotificationHandlers = <
  NotificationHandlers extends ReadonlyRecord<string, NotificationHandler>,
>(
  notificationHandlers: ValidateNotificationHandlers<NotificationHandlers>,
) => notificationHandlers;

/**
 * LSP client context.
 */
export interface ClientContext {
  /**
   * The LSP server, represented as a child process.
   */
  readonly server: NodeServer;

  /**
   * A logger that logs a message to the console.
   */
  readonly logger: Logger;

  /**
   * Send a JSON-RPC message to the LSP server.
   */
  readonly send: (data: Message) => void;
}

/**
 * Protocol request handlers.
 */
export type ProtocolRequestHandlers = ReturnType<typeof _prepareProtocolRequestHandlers>;

/**
 * Prepare protocol request handlers.
 * @returns
 */
const _prepareProtocolRequestHandlers = () =>
  validateRequestHandlers({
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
       */
      handler: (
        // @ts-expect-error - Unused parameters
        params: RegistrationParams,
        success,
        // @ts-expect-error - Unused parameters
        error,
        // @ts-expect-error - Unused parameters
        context,
      ) => {
        // To be implemented by an actual implementation
        success(null);
      },
    },

    "client/unregisterCapability": {
      type: "mutation",
      /**
       * The `client/unregisterCapability` request is sent from the server to the client to unregister
       * a previously registered capability.
       */
      handler: (
        // @ts-expect-error - Unused parameters
        params: UnregistrationParams,
        success,
        // @ts-expect-error - Unused parameters
        error,
        // @ts-expect-error - Unused parameters
        context,
      ) => {
        // To be implemented by an actual implementation
        success(null);
      },
    },
  });

/**
 * Protocol notification handlers.
 */
export type ProtocolNotificationHandlers = ReturnType<typeof _prepareProtocolNotificationHandlers>;

/**
 * Prepare protocol notification handlers.
 * @returns
 */
const _prepareProtocolNotificationHandlers = () =>
  validateNotificationHandlers({
    /**
     * Invoked when received a `$/cancelRequest` notification from the server.
     */
    "$/cancelRequest": (
      // @ts-expect-error - Unused parameters
      params: CancelParams,
      // @ts-expect-error - Unused parameters
      context,
    ) => {
      // TODO: Implement it
    },

    /**
     * Invoked when received a `$/progress` notification from the server.
     */
    "$/progress": (
      // @ts-expect-error - Unused parameters
      params: ProgressParams,
      // @ts-expect-error - Unused parameters
      context,
    ) => {
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
     */
    "$/logTrace": (
      // @ts-expect-error - Unused parameters
      params: LogTraceParams,
      // @ts-expect-error - Unused parameters
      context,
    ) => {
      // To be implemented by an actual implementation
    },

    /**
     * The log message notification is sent from the server to the client to ask the client to log a
     * particular message.
     */
    "window/logMessage": ({ message, type }: LogMessageParams, { logger, suppressLogging }) => {
      suppressLogging();
      match(type)
        .with(MessageType.Error, () => logger.error(message))
        .with(MessageType.Warning, () => logger.warn(message))
        .with(P.union(MessageType.Info, MessageType.Log, MessageType.Debug), () =>
          logger.debug(message),
        )
        .exhaustive();
    },
  });

/**
 * Client options.
 */
export interface ClientOptions<
  RequestHandlers extends ReadonlyRecord<string, RequestHandler>,
  NotificationHandlers extends ReadonlyRecord<string, NotificationHandler>,
> {
  /**
   * Logging level. `false` to disable logging; `"error"` to log errors only; `"debug"` to log
   * everything. Defaults to `"error"`.
   */
  readonly logging?: "debug" | "error" | false;

  /**
   * Name of the server. Used for logging. Defaults to `""`, i.e. no name.
   */
  readonly serverName?: string;

  /**
   * Request handlers by method name. Invoked when a request is received from the server. Defaults
   * to `{}`.
   */
  readonly requestHandlers?: RefineRequestHandlers<RequestHandlers, ProtocolRequestHandlers>;

  /**
   * Notification handlers by method name. Invoked when a notification is received from the server.
   * Defaults to `{}`.
   */
  readonly notificationHandlers?: RefineNotificationHandlers<
    NotificationHandlers,
    ProtocolNotificationHandlers
  >;
}

export type ClientEventHandler<EventName extends keyof ClientEventMap> = (
  ...args: ClientEventMap[EventName] extends void ? [] : [ev: ClientEventMap[EventName]]
) => void | Promise<void>;

export interface ClientEventMap {
  initialized: void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidateClientOptions<Options extends ClientOptions<any, any>> = {
  [P in keyof Options]: P extends "requestHandlers" ?
    Options[P] extends ReadonlyRecord<string, RequestHandler> ?
      ValidateRequestHandlers<Options[P]>
    : never
  : P extends "notificationHandlers" ?
    Options[P] extends ReadonlyRecord<string, NotificationHandler> ?
      ValidateNotificationHandlers<Options[P]>
    : never
  : Options[P];
};

/**
 * Create a LSP client.
 * @param server
 * @param options
 * @returns
 */
export const createClient = <
  RequestHandlers extends ReadonlyRecord<string, RequestHandler>,
  NotificationHandlers extends ReadonlyRecord<string, NotificationHandler>,
>(
  server: NodeServer,
  options?: ClientOptions<RequestHandlers, NotificationHandlers>,
) => {
  type RefinedRequestHandlers = RefineRequestHandlers<RequestHandlers, ProtocolRequestHandlers>;
  type RefinedNotificationHandlers = RefineNotificationHandlers<
    NotificationHandlers,
    ProtocolNotificationHandlers
  >;

  const {
    logging = "error",
    notificationHandlers = {} as RefinedNotificationHandlers,
    requestHandlers = {} as RefinedRequestHandlers,
    serverName = "",
  } = options ?? {};

  /**
   * Send a JSON-RPC Message to the LSP server.
   * @param data
   */
  const _send = (data: Message) => {
    const dataString = JSON.stringify(data);
    const contentLength = new TextEncoder().encode(dataString).length;
    const rpcString = `Content-Length: ${contentLength}\r\n\r\n${dataString}`;
    server.send(rpcString);
  };

  const logger = createLogger({
    prefix: `%c${serverName && serverName + " "}LSP:%c `,
    styles: ["font-weight: bold", "font-weight: normal"],
    block: {
      prefix: `${serverName && serverName + " "}LSP `,
    },
  });

  const context = { server, logger, send: _send } satisfies ClientContext;

  const resolveMap: Map<
    integer | string,
    readonly ["query" | "mutation", string, (value: LSPAny) => void]
  > = new Map();
  const rejectMap: Map<
    integer | string,
    readonly ["query" | "mutation", string, (reason: ResponseError) => void]
  > = new Map();

  const _protocolRequestHandlers = _prepareProtocolRequestHandlers();
  const _protocolNotificationHandlers = _prepareProtocolNotificationHandlers();

  /* Merge user handlers with protocol handlers */
  for (const [method, { handler, type }] of Object.entries(requestHandlers)) {
    if (!isKeyOf(_protocolRequestHandlers, method)) continue;
    const { type: protocolType } = _protocolRequestHandlers[method];
    if (type !== protocolType) {
      Object.defineProperty(requestHandlers, method, {
        value: { type: protocolType, handler },
        enumerable: true,
      });
      if (logging)
        logger.warn(
          `Request handler type (${type}) mismatch for protocol method \`${method}\`,` +
            ` using protocol type (${protocolType}) instead`,
        );
    }
    if (logging === "debug")
      logger.debug(`Overwriting request handler for protocol method \`${method}\``);
  }
  for (const [method] of Object.entries(notificationHandlers)) {
    if (!isKeyOf(_protocolNotificationHandlers, method)) continue;
    if (logging === "debug")
      logger.debug(`Overwriting notification handler for protocol method \`${method}\``);
  }

  /**
   * Send a success response to LSP server.
   * @param type
   * @param isProtocol
   * @param id
   * @param method
   * @param value
   */
  const _success = (
    type: "query" | "mutation",
    isProtocol: boolean,
    id: (integer | string) | null,
    method: string,
    value: LSPAny,
  ) => {
    const response = {
      jsonrpc: JSONRPC_VERSION,
      id,
      result: value,
    } satisfies SuccessResponseMessage;
    _send(response);

    // Log to console
    if (logging === "debug") {
      const color = type === "query" ? "#49cc90" : "purple";
      logger.block
        .overwrite({ color })
        // eslint-disable-next-line sonarjs/no-duplicate-string
        .debug(`>> [${id}] ${isProtocol ? "[Protocol] " : ""}Response ${method}`, value);
    }
  };
  /**
   * Send an error response to LSP server.
   * @param isProtocol
   * @param id
   * @param method
   * @param reason
   */
  const _error = (
    isProtocol: boolean,
    id: (integer | string) | null,
    method: string,
    reason: ResponseError,
  ) => {
    const response = {
      jsonrpc: JSONRPC_VERSION,
      id,
      error: reason,
    } satisfies ErrorResponseMessage;
    _send(response);

    // Log to console
    if (logging === "debug") {
      const errorCode = reason.code;
      const errorData = reason.data;
      logger.block
        .overwrite({ color: "crimson" })
        .debug(
          `>> [${id}] ${isProtocol ? "[Protocol] " : ""}Error Response ${method} ${formatErrorCode(
            errorCode,
          )}`,
          "\n" + reason.message,
          ...(errorData !== undefined ? [errorData] : []),
        );
    }
  };

  // Listen to server stdout
  server.onMessage((rawString) => {
    const payloadStrings = rawString.split(/Content-Length: \d+\r\n\r\n/).filter((s) => s);

    for (const payloadString of payloadStrings) {
      let payload: unknown;
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
                ...(errorData !== undefined ? [errorData] : []),
              );
            }
          } else {
            let method: string | null = null;
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
                  ...(errorData !== undefined ? [errorData] : []),
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
            let type: ("query" | "mutation") | null = null;
            let method: string | null = null;
            if (payload.id !== null && typeAndMethodAndResolve) {
              const [t, m, resolve] = typeAndMethodAndResolve;
              type = t;
              method = m;
              resolve(payload.result);
              resolveMap.delete(payload.id);
            }

            if (logging === "debug") {
              const color =
                type === "query" ? "#49cc90"
                : type === "mutation" ? "purple"
                : "lightgray";
              logger.block
                .overwrite({ color })
                .debug(
                  `<< ${formatId(payload.id)}${formatMethod(method)} Response`,
                  payload.result,
                );
            }
          }
        }
      } else if (isRequestMessage(payload)) {
        const request = payload;

        let loggingSuppressed = false;

        if (request.method.startsWith("$/")) {
          const typeAndHandler =
            requestHandlers[request.method] ?? _protocolRequestHandlers[request.method as never];

          if (!typeAndHandler) {
            _error(true, request.id, request.method, {
              code: ErrorCodes.MethodNotFound,
              message: `Method not found: ${request.method}`,
            });

            if (logging)
              logger.error(
                `Request handler not found for method ${request.method} with id ${request.id}`,
              );
          } else {
            const { handler, type } = typeAndHandler;
            void handler(
              request.params as never,
              (value) => _success(type, true, request.id, request.method, value),
              (reason) => _error(true, request.id, request.method, reason),
              {
                ...context,
                suppressLogging: () => {
                  loggingSuppressed = true;
                },
              },
            );
          }
        } else {
          const typeAndHandler =
            requestHandlers[request.method] ?? _protocolRequestHandlers[request.method as never];

          if (typeAndHandler) {
            const { handler, type } = typeAndHandler;
            void handler(
              request.params as never,
              (value) =>
                _success(
                  type,
                  request.method in _protocolRequestHandlers,
                  request.id,
                  request.method,
                  value,
                ),
              (reason) =>
                _error(
                  request.method in _protocolRequestHandlers,
                  request.id,
                  request.method,
                  reason,
                ),
              {
                ...context,
                suppressLogging: () => {
                  loggingSuppressed = true;
                },
              },
            );
          }
        }

        if (logging === "debug" && !loggingSuppressed) {
          const typeAndHandler =
            requestHandlers[request.method] ?? _protocolRequestHandlers[request.method as never];
          const type = typeAndHandler?.type ?? "unknown";
          const color =
            type === "query" ? "#49cc90"
            : type === "mutation" ? "purple"
            : "gray";
          logger.block.overwrite({ color }).debug(
            `<< [${request.id}] ${
              request.method in _protocolRequestHandlers ? "[Protocol] "
              : requestHandlers[payload.method] ? ""
              : "[Ignored] "
            }${request.method} Request`,
            ...(request.params !== undefined ? [request.params] : []),
          );
        }
      } else if (isNotificationMessage(payload)) {
        let loggingSuppressed = false;

        void (
          notificationHandlers[payload.method] ??
          _protocolNotificationHandlers[payload.method as never]
        )?.(payload.params as never, {
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
              ...(payload.params ? [payload.params] : []),
            );
      } else {
        if (logging) logger.error(`Invalid payload`, payload);
      }
    }
  });
  // End

  let requestId = 0;
  let _initialized = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _eventHandlers: Map<string, Array<(ev?: any) => void | Promise<void>>> = new Map();

  const result = {
    /**
     * @readonly
     */
    logger,

    get initialized() {
      return _initialized;
    },

    requestHandlers: requestHandlers as Equals<
      RequestHandlers,
      RefineRequestHandlers<ReadonlyRecord<string, RequestHandler>, ProtocolRequestHandlers>
    > extends true ?
      Record<string, never>
    : RefinedRequestHandlers,
    notificationHandlers: notificationHandlers as Equals<
      NotificationHandlers,
      RefineNotificationHandlers<
        ReadonlyRecord<string, NotificationHandler>,
        ProtocolNotificationHandlers
      >
    > extends true ?
      Record<string, never>
    : RefinedNotificationHandlers,
    protocolRequestHandlers: _protocolRequestHandlers,
    protocolNotificationHandlers: _protocolNotificationHandlers,

    /**
     * @readonly
     */
    request: Object.assign(
      /**
       * Send a request to LSP server.
       * @param type
       * @param method
       * @param params
       * @returns
       */
      <R extends LSPAny = LSPAny>(
        type: "query" | "mutation",
        method: string,
        params?: LSPArray | LSPObject,
      ): ResponsePromise<R> => {
        const request = {
          jsonrpc: JSONRPC_VERSION,
          id: ++requestId,
          method,
          ...(params && { params }),
        } satisfies RequestMessage;
        _send(request);

        // Log to console
        if (logging === "debug") {
          const color = type === "query" ? "#49cc90" : "purple";
          logger.block
            .overwrite({ color })
            .debug(
              `>> [${requestId}] Request ${method}`,
              ...(params !== undefined ? [params] : []),
            );
        }

        const result = Object.assign(
          new Promise<R>((resolve, reject) => {
            resolveMap.set(requestId, [
              type,
              method,
              (value) => {
                result.status = "fulfilled";
                resolve(value as never);
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
          }),
          {
            status: "pending" as "pending" | "fulfilled" | "rejected",
            id: requestId,
            cancel: () => {
              if (result.status !== "pending") {
                if (logging)
                  logger.error(
                    `Unable to cancel request with id ${requestId} because it is already ${result.status}`,
                  );

                throw new Error(
                  `Unable to cancel request with id ${requestId} because it is already ${result.status}`,
                );
              }

              _notify("$/cancelRequest", { id: requestId } satisfies CancelParams);
              resolveMap.delete(requestId);
              rejectMap.delete(requestId);
            },
          } satisfies _BaseResponsePromise,
        );

        return result;
      },
      /**
       * Request methods.
       * @readonly
       */
      {
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
         */
        initialize: (params: InitializeParams): ResponsePromise<InitializeResult> => {
          const promise = _mutate(
            "initialize",
            params as unknown as LSPObject,
          ) as unknown as ResponsePromise<InitializeResult>;
          void promise.then(() => {
            _initialized = true;
            _eventHandlers.get("initialized")?.forEach((handler) => void handler());
          });
          return promise;
        },
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
         */
        shutdown: (): ResponsePromise<null> => _mutate("shutdown"),
      } as const,
    ),
    /**
     * Send a query request to LSP server.
     * @readonly
     * @param method
     * @param params
     * @returns
     */
    query: <R extends LSPAny = LSPAny>(
      method: string,
      params?: LSPArray | LSPObject,
    ): ResponsePromise<R> => _request("query", method, params),
    /**
     * Send a mutation request to LSP server.
     * @readonly
     * @param method
     * @param payload
     * @returns
     */
    mutate: <R extends LSPAny = LSPAny>(
      method: string,
      payload?: LSPArray | LSPObject,
    ): ResponsePromise<R> => _request("mutation", method, payload),

    /**
     * Send a notification to LSP server.
     * @readonly
     * @param method
     * @param params
     */
    notify: (method: string, params?: LSPArray | LSPObject) => {
      const notification = {
        jsonrpc: JSONRPC_VERSION,
        method,
        ...(params && { params }),
      } satisfies NotificationMessage;
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
    notification: {
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
       */
      setTrace: (params: SetTraceParams) => _notify("$/setTrace", params as unknown as LSPObject),
      /**
       * A notification to ask the server to exit its process. The server should exit with `success`
       * code 0 if the shutdown request has been received before; otherwise with `error` code 1.
       */
      exit: () => _notify("exit"),

      /**
       * Text document notifications.
       */
      textDocument: {
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
         */
        didOpen: (params: DidOpenTextDocumentParams) =>
          _notify("textDocument/didOpen", params as unknown as LSPObject),
        /**
         * The document change notification is sent from the client to the server to signal changes to
         * a text document. Before a client can change a text document it must claim ownership of its
         * content using the `textDocument/didOpen` notification. In 2.0 the shape of the params has
         * changed to include proper version numbers.
         */
        didChange: (params: DidChangeTextDocumentParams) =>
          _notify("textDocument/didChange", params as unknown as LSPObject),
        /**
         * The document close notification is sent from the client to the server when the document
         * got closed in the client. The document’s master now exists where the document’s Uri
         * points to (e.g. if the document’s Uri is a file Uri the master now exists on disk). As
         * with the open notification the close notification is about managing the document’s
         * content. Receiving a close notification doesn’t mean that the document was open in an
         * editor before. A close notification requires a previous open notification to be sent.
         * Note that a server’s ability to fulfill requests is independent of whether a text
         * document is open or closed.
         */
        didClose: (params: DidCloseTextDocumentParams) =>
          _notify("textDocument/didClose", params as unknown as LSPObject),
      } as const,

      /**
       * Workspace notifications.
       * @readonly
       */
      workspace: {
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
         */
        didChangeWorkspaceFolders: (params: DidChangeWorkspaceFoldersParams) =>
          _notify("workspace/didChangeWorkspaceFolders", params as unknown as LSPObject),
      } as const,
    } as const,

    _eventHandlers,

    /**
     * Add event handler.
     * @readonly
     */
    on: ((event, handler): void => {
      const handlers = _eventHandlers.get(event) ?? [];
      handlers.push(handler as never);
      _eventHandlers.set(event, handlers);
    }) as <E extends keyof ClientEventMap>(event: E, handler: ClientEventHandler<E>) => void,
    /**
     * Remove event handler.
     * @readonly
     */
    off: ((event, handler): void => {
      const handlers = _eventHandlers.get(event) ?? [];
      const index = handlers.indexOf(handler as never);
      if (index !== -1) handlers.splice(index, 1);
      _eventHandlers.set(event, handlers);
    }) as <E extends keyof ClientEventMap>(event: E, handler: ClientEventHandler<E>) => void,
  };

  const _request = result.request;
  // @ts-expect-error - Planned to use in the future
  const _query = result.query;
  const _mutate = result.mutate;
  const _notify = result.notify;

  return result;
};
