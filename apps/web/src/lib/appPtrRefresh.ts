/** Dispatched on pull-to-refresh (native) for the active screen to refetch data. */
export const APP_PTR_REFRESH_EVENT = "app:ptrrefresh";

const PTR_EXCLUDED_PATHS = new Set(["/about", "/faq", "/privacy", "/terms"]);

export function isPullToRefreshEnabled(pathname: string): boolean {
  return !PTR_EXCLUDED_PATHS.has(pathname);
}

