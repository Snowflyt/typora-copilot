import type {
  LSPAny,
  LSPArray,
  LSPObject,
  Message,
  NotificationMessage,
  RequestMessage,
  ResponseError,
  ResponseMessage,
  decimal,
  integer,
  uinteger,
} from "@/types/lsp";
import { ErrorCodes } from "@/types/lsp";

/**************
 * Base types *
 **************/
/**
 * Check if a value is an integer.
 * @param value The value to check.
 * @returns
 *
 * @see {@link integer}
 */
export const isInteger = (value: unknown): value is integer => Number.isInteger(value);
/**
 * Check if a value is an unsigned integer.
 * @param value The value to check.
 * @returns
 *
 * @see {@link uinteger}
 */
export const isUInteger = (value: unknown): value is uinteger => isInteger(value) && value >= 0;
/**
 * Check if a value is a decimal.
 * @param value The value to check.
 * @returns
 *
 * @see {@link decimal}
 */
export const isDecimal = (value: unknown): value is decimal =>
  typeof value === "number" && !isNaN(value);

/**
 * Check if a value is an LSP any.
 * @param value The value to check.
 * @returns
 *
 * @see {@link LSPAny}
 */
export const isLSPAny = (value: unknown): value is LSPAny =>
  typeof value === "string" ||
  typeof value === "boolean" ||
  value === null ||
  isInteger(value) ||
  isDecimal(value) ||
  isLSPArray(value) ||
  isLSPObject(value);

/**
 * Check if a value is an LSP object.
 * @param value The value to check.
 * @returns
 *
 * @see {@link LSPObject}
 */
export const isLSPObject = (value: unknown): value is LSPObject => {
  if (typeof value !== "object" || value === null) return false;
  for (const key in value) if (!isLSPAny(value[key as keyof typeof value])) return false;
  return true;
};

/**
 * Check if a value is an LSP array.
 * @param value The value to check.
 * @returns
 *
 * @see {@link LSPArray}
 */
export const isLSPArray = (value: unknown): value is LSPArray =>
  Array.isArray(value) && value.every(isLSPAny);

/*****************
 * Base Protocol *
 *****************/
/**
 * Check if a value is a message.
 * @param value The value to check.
 * @returns
 */
export const isMessage = (value: unknown): value is Message => {
  if (typeof value !== "object" || value === null) return false;
  return !(!("jsonrpc" in value) || typeof value.jsonrpc !== "string");
};

/**
 * Check if a value is a request message.
 * @param value The value to check.
 * @returns
 */
export const isRequestMessage = (value: unknown): value is RequestMessage => {
  if (!isMessage(value)) return false;
  if (
    !("id" in value) ||
    (!isInteger(value.id) && typeof value.id !== "string" && value.id !== null)
  )
    return false;
  if (!("method" in value) || typeof value.method !== "string") return false;
  return !("params" in value && !isLSPArray(value.params) && !isLSPObject(value.params));
};

/**
 * Check if a value is a response message.
 * @param value The value to check.
 * @returns
 */
export const isResponseMessage = (value: unknown): value is ResponseMessage => {
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
  return !(!("result" in value) && !("error" in value));
};

/**
 * Check if a value is a response error.
 * @param value The value to check.
 * @returns
 */
export const isResponseError = (value: unknown): value is ResponseError => {
  if (typeof value !== "object" || value === null) return false;
  if (!("code" in value) || !isInteger(value.code)) return false;
  if (!("message" in value) || typeof value.message !== "string") return false;
  return !(
    "data" in value &&
    typeof value.data !== "string" &&
    typeof value.data !== "number" &&
    typeof value.data !== "boolean" &&
    !isLSPArray(value.data) &&
    !isLSPObject(value.data) &&
    value.data !== null
  );
};

export const toJSError = (error: ResponseError) => {
  const ErrorClass = class extends Error {};
  let errorName = getErrorCodeName(error.code) ?? "UnknownError";
  if (!errorName.endsWith("Error")) errorName += "Error";
  Object.defineProperty(ErrorClass, "name", {
    value: errorName,
    writable: false,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(ErrorClass.prototype, "name", {
    value: errorName,
    writable: true,
    enumerable: false,
    configurable: true,
  });
  return Object.assign(new ErrorClass(error.message), { code: error.code, data: error.data });
};

/**
 * Get the name of an error code.
 * @param errorCode The error code.
 * @returns
 */
export const getErrorCodeName = (errorCode: integer) =>
  Object.entries(ErrorCodes).find(([, v]) => v === errorCode)?.[0] ?? null;

/**
 * Check if a value is a notification message.
 * @param value The value to check.
 * @returns
 */
export const isNotificationMessage = (value: unknown): value is NotificationMessage => {
  if (!isMessage(value)) return false;
  if ("id" in value && value.id !== null) return false;
  if (!("method" in value) || typeof value.method !== "string") return false;
  return !("params" in value && !isLSPArray(value.params) && !isLSPObject(value.params));
};
