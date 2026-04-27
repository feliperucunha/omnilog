/**
 * Returns a safe in-app path for post-login redirect, or null.
 * Rejects values that would cause an open redirect (e.g. https://…).
 */
export function safeInternalPathFromQuery(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  if (t === "" || t.length > 2048) return null;
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.includes("://")) return null;
  return t;
}
