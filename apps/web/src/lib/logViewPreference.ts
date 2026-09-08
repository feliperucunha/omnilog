import { getItem, getItemSync, setItem } from "@/lib/storage";

export type LogViewMode = "list" | "compact" | "grid";

export type LogViewPage = "dashboard" | "search" | "publicProfile";

const STORAGE_KEYS: Record<LogViewPage, string> = {
  dashboard: "log-view-dashboard",
  search: "log-view-search",
  publicProfile: "log-view-public-profile",
};

const LEGACY_DASHBOARD_KEY = "dashboard-log-view";

const VALID_MODES = new Set<LogViewMode>(["list", "compact", "grid"]);

export function parseStoredLogView(raw: string | null | undefined): LogViewMode | null {
  if (raw === "dense") return "compact";
  if (raw === "cards") return "list";
  if (raw && VALID_MODES.has(raw as LogViewMode)) return raw as LogViewMode;
  return null;
}

export function normalizeLogView(raw: string | null | undefined): LogViewMode {
  return parseStoredLogView(raw) ?? "list";
}

export function defaultPublicProfileLogView(isMobile: boolean): LogViewMode {
  return isMobile ? "grid" : "list";
}

function storedRawSync(page: LogViewPage): string | null {
  let raw = getItemSync(STORAGE_KEYS[page]);
  if (page === "dashboard" && raw == null) {
    raw = getItemSync(LEGACY_DASHBOARD_KEY);
  }
  return raw;
}

async function storedRaw(page: LogViewPage): Promise<string | null> {
  let raw = await getItem(STORAGE_KEYS[page]);
  if (page === "dashboard" && raw == null) {
    raw = await getItem(LEGACY_DASHBOARD_KEY);
  }
  return raw;
}

export function readStoredLogViewPreferenceSync(page: LogViewPage): LogViewMode | null {
  return parseStoredLogView(storedRawSync(page));
}

export async function readStoredLogViewPreference(page: LogViewPage): Promise<LogViewMode | null> {
  return parseStoredLogView(await storedRaw(page));
}

export function readLogViewPreferenceSync(page: LogViewPage): LogViewMode {
  return normalizeLogView(storedRawSync(page));
}

export async function readLogViewPreference(page: LogViewPage): Promise<LogViewMode> {
  return normalizeLogView(await storedRaw(page));
}

export function persistLogViewPreference(page: LogViewPage, view: LogViewMode): void {
  void setItem(STORAGE_KEYS[page], view);
}

export function resolveLogViewForContext(enabled: boolean, view: LogViewMode): LogViewMode {
  return enabled ? view : "list";
}
