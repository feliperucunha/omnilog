import { getItem, getItemSync, setItem } from "@/lib/storage";

export type LogViewMode = "list" | "compact" | "grid";

export type LogViewPage = "dashboard" | "search";

const STORAGE_KEYS: Record<LogViewPage, string> = {
  dashboard: "log-view-dashboard",
  search: "log-view-search",
};

const LEGACY_DASHBOARD_KEY = "dashboard-log-view";

const VALID_MODES = new Set<LogViewMode>(["list", "compact", "grid"]);

export function normalizeLogView(raw: string | null | undefined): LogViewMode {
  if (raw === "dense") return "compact";
  if (raw === "cards") return "list";
  if (raw && VALID_MODES.has(raw as LogViewMode)) return raw as LogViewMode;
  return "list";
}

export function readLogViewPreferenceSync(page: LogViewPage): LogViewMode {
  let raw = getItemSync(STORAGE_KEYS[page]);
  if (page === "dashboard" && raw == null) {
    raw = getItemSync(LEGACY_DASHBOARD_KEY);
  }
  return normalizeLogView(raw);
}

export async function readLogViewPreference(page: LogViewPage): Promise<LogViewMode> {
  let raw = await getItem(STORAGE_KEYS[page]);
  if (page === "dashboard" && raw == null) {
    raw = await getItem(LEGACY_DASHBOARD_KEY);
  }
  return normalizeLogView(raw);
}

export function persistLogViewPreference(page: LogViewPage, view: LogViewMode): void {
  void setItem(STORAGE_KEYS[page], view);
}

export function resolveLogViewForContext(
  enabled: boolean,
  view: LogViewMode
): LogViewMode {
  return enabled ? view : "list";
}
