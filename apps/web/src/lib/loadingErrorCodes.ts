/**
 * Known error codes shown on the initial loading screen when the first API
 * request fails. Used so users and support can identify the failure reason.
 */
export enum LoadingErrorCode {
  /** Request aborted (timeout). */
  TIMEOUT = "TIMEOUT",
  /** No response – connection failed, CORS, or network unreachable. */
  NETWORK = "NETWORK",
  /** Server returned 5xx. */
  SERVER_ERROR = "SERVER_ERROR",
  /** Server returned 401 (e.g. session expired, invalid token). */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** Server returned 403. */
  FORBIDDEN = "FORBIDDEN",
  /** Server returned 404. */
  NOT_FOUND = "NOT_FOUND",
  /** Server returned 4xx (other). */
  CLIENT_ERROR = "CLIENT_ERROR",
  /** App version no longer supported (401 with version mismatch). */
  VERSION_MISMATCH = "VERSION_MISMATCH",
  /** Unclassified error. */
  UNKNOWN = "UNKNOWN",
}
