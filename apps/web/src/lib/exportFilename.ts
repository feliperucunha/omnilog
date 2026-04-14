import type { MeResponse } from "@/contexts/MeContext";

/** Product name segment in CSV export filenames. */
export const EXPORT_APP_DISPLAY_NAME = "Geeklogs";

export type LogsExportPage = "dashboard" | "settings" | "statistics" | "logs";

/** One path segment: safe for download / native cache paths. */
function toFilenameSegment(raw: string, maxLen: number, fallback: string): string {
  const collapsed = raw
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\./g, "-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const cut = collapsed.slice(0, maxLen).replace(/-+$/g, "");
  return cut || fallback;
}

/**
 * CSV filename: Geeklogs-{page}-{user}-{category}-{date}.csv
 * (Server may still send Content-Disposition; callers typically override with this value.)
 */
export function buildLogsExportFilename(parts: {
  page: LogsExportPage;
  userSlug: string;
  /** e.g. `movies`, `boardgames`, or `all-categories` */
  categoryKey: string;
  /** ISO date YYYY-MM-DD; defaults to today (UTC) */
  dateIso?: string;
}): string {
  const date = parts.dateIso ?? new Date().toISOString().slice(0, 10);
  const app = toFilenameSegment(EXPORT_APP_DISPLAY_NAME, 20, "Geeklogs");
  const page = toFilenameSegment(parts.page, 16, "export");
  const user = toFilenameSegment(parts.userSlug, 36, "user");
  const cat = toFilenameSegment(parts.categoryKey, 28, "all");
  const d = toFilenameSegment(date, 12, date);
  return `${app}-${page}-${user}-${cat}-${d}.csv`;
}

/** Prefer username, then email local-part, then user id. */
export function userSlugFromMe(me: MeResponse | null | undefined): string {
  const u = me?.user;
  if (!u) return "user";
  const username = u.username?.trim();
  if (username) return username;
  const email = u.email?.trim();
  if (email) {
    const at = email.indexOf("@");
    if (at > 0) return email.slice(0, at);
  }
  return u.id;
}
