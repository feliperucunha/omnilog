import { toast } from "sonner";
import type { ErrorCode } from "./errorCodes";
import { getErrorMessageKey } from "./errorCodes";

type TFunction = (key: string, opts?: Record<string, string>) => string;

/**
 * Show an error toast with a user-friendly message only (no technical codes in the UI).
 * The error code is logged for debugging when an original error is provided.
 */
export function showErrorToast(
  t: TFunction,
  code: ErrorCode,
  options?: { interpolation?: Record<string, string | number>; originalError?: unknown }
): void {
  const messageKey = getErrorMessageKey(code);
  const params =
    options?.interpolation &&
    Object.fromEntries(
      Object.entries(options.interpolation).map(([k, v]) => [k, String(v)])
    ) as Record<string, string>;
  const message = options?.interpolation ? t(messageKey, params) : t(messageKey);
  toast.error(message);
  if (options?.originalError !== undefined) {
    console.error(`[${code}]`, options.originalError);
  } else {
    console.error(`[${code}]`);
  }
}
