import { useMemo } from "react";

const DEFAULT_SUPPORT_EMAIL = "support@geeklogs.app";

/** Public support contact for legal/FAQ copy; override with `VITE_SUPPORT_EMAIL`. */
export function useSupportEmail(): string {
  return useMemo(
    () => (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || DEFAULT_SUPPORT_EMAIL,
    []
  );
}
