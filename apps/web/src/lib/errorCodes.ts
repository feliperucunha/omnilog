/**
 * Central error codes for user-facing toasts. Every error toast shows a friendly message + code.
 * Docs: see errorCodes.docs.* in locales and the Error code reference section on the About page.
 */
export const ERROR_CODES = {
  E001: "E001",
  E002: "E002",
  E003: "E003",
  E004: "E004",
  E005: "E005",
  E006: "E006",
  E007: "E007",
  E008: "E008",
  E009: "E009",
  E010: "E010",
  E011: "E011",
  E012: "E012",
  E013: "E013",
  E014: "E014",
  E015: "E015",
  E016: "E016",
  E017: "E017",
  E018: "E018",
  E019: "E019",
  E020: "E020",
  E021: "E021",
  E022: "E022",
  E023: "E023",
  E024: "E024",
  E025: "E025",
  E099: "E099",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** i18n key for the user-friendly message shown in the toast. */
const CODE_TO_MESSAGE_KEY: Record<ErrorCode, string> = {
  [ERROR_CODES.E001]: "errorCodes.toast.E001",
  [ERROR_CODES.E002]: "errorCodes.toast.E002",
  [ERROR_CODES.E003]: "errorCodes.toast.E003",
  [ERROR_CODES.E004]: "errorCodes.toast.E004",
  [ERROR_CODES.E005]: "errorCodes.toast.E005",
  [ERROR_CODES.E006]: "errorCodes.toast.E006",
  [ERROR_CODES.E007]: "errorCodes.toast.E007",
  [ERROR_CODES.E008]: "errorCodes.toast.E008",
  [ERROR_CODES.E009]: "errorCodes.toast.E009",
  [ERROR_CODES.E010]: "errorCodes.toast.E010",
  [ERROR_CODES.E011]: "errorCodes.toast.E011",
  [ERROR_CODES.E012]: "errorCodes.toast.E012",
  [ERROR_CODES.E013]: "errorCodes.toast.E013",
  [ERROR_CODES.E014]: "errorCodes.toast.E014",
  [ERROR_CODES.E015]: "errorCodes.toast.E015",
  [ERROR_CODES.E016]: "errorCodes.toast.E016",
  [ERROR_CODES.E017]: "errorCodes.toast.E017",
  [ERROR_CODES.E018]: "errorCodes.toast.E018",
  [ERROR_CODES.E019]: "errorCodes.toast.E019",
  [ERROR_CODES.E020]: "errorCodes.toast.E020",
  [ERROR_CODES.E021]: "errorCodes.toast.E021",
  [ERROR_CODES.E022]: "errorCodes.toast.E022",
  [ERROR_CODES.E023]: "errorCodes.toast.E023",
  [ERROR_CODES.E024]: "errorCodes.toast.E024",
  [ERROR_CODES.E025]: "errorCodes.toast.E025",
  [ERROR_CODES.E099]: "errorCodes.toast.E099",
};

/** i18n key for the doc description (About page). */
const CODE_TO_DOC_KEY: Record<ErrorCode, string> = {
  [ERROR_CODES.E001]: "errorCodes.docs.E001",
  [ERROR_CODES.E002]: "errorCodes.docs.E002",
  [ERROR_CODES.E003]: "errorCodes.docs.E003",
  [ERROR_CODES.E004]: "errorCodes.docs.E004",
  [ERROR_CODES.E005]: "errorCodes.docs.E005",
  [ERROR_CODES.E006]: "errorCodes.docs.E006",
  [ERROR_CODES.E007]: "errorCodes.docs.E007",
  [ERROR_CODES.E008]: "errorCodes.docs.E008",
  [ERROR_CODES.E009]: "errorCodes.docs.E009",
  [ERROR_CODES.E010]: "errorCodes.docs.E010",
  [ERROR_CODES.E011]: "errorCodes.docs.E011",
  [ERROR_CODES.E012]: "errorCodes.docs.E012",
  [ERROR_CODES.E013]: "errorCodes.docs.E013",
  [ERROR_CODES.E014]: "errorCodes.docs.E014",
  [ERROR_CODES.E015]: "errorCodes.docs.E015",
  [ERROR_CODES.E016]: "errorCodes.docs.E016",
  [ERROR_CODES.E017]: "errorCodes.docs.E017",
  [ERROR_CODES.E018]: "errorCodes.docs.E018",
  [ERROR_CODES.E019]: "errorCodes.docs.E019",
  [ERROR_CODES.E020]: "errorCodes.docs.E020",
  [ERROR_CODES.E021]: "errorCodes.docs.E021",
  [ERROR_CODES.E022]: "errorCodes.docs.E022",
  [ERROR_CODES.E023]: "errorCodes.docs.E023",
  [ERROR_CODES.E024]: "errorCodes.docs.E024",
  [ERROR_CODES.E025]: "errorCodes.docs.E025",
  [ERROR_CODES.E099]: "errorCodes.docs.E099",
};

export function getErrorMessageKey(code: ErrorCode): string {
  return CODE_TO_MESSAGE_KEY[code];
}

export function getErrorDocKey(code: ErrorCode): string {
  return CODE_TO_DOC_KEY[code];
}

export const ALL_ERROR_CODES: ErrorCode[] = Object.values(ERROR_CODES);
