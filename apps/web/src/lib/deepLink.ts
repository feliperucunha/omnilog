/** Custom scheme used in Android intent-filters (`geeklogs://app/...`). */
const GEEKLOGS_APP_HOST = "app";

/**
 * Maps an opened app URL to an in-app path for React Router (`pathname` + `search` + `hash`).
 * Supports:
 * - `geeklogs://app/path` (custom scheme)
 * - `https` URLs whose host matches `import.meta.env.VITE_APP_WEB_ORIGIN` (App Links)
 */
export function appUrlToInternalPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const webOrigin = import.meta.env.VITE_APP_WEB_ORIGIN as string | undefined;

    if (parsed.protocol === "geeklogs:" && parsed.hostname === GEEKLOGS_APP_HOST) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    }

    if (webOrigin) {
      const expected = new URL(webOrigin);
      if (parsed.protocol === "https:" && parsed.host === expected.host) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
      }
    }

    return null;
  } catch {
    return null;
  }
}
