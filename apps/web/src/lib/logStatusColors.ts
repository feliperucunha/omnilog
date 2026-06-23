import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES } from "@geeklogs/shared";

export function isDroppedStatus(status: string | null | undefined): boolean {
  return status === "dropped";
}

export function isInProgressStatus(status: string | null | undefined): boolean {
  return status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
}

export function isCompletedStatus(status: string | null | undefined): boolean {
  return status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
}

/** Solid badge for thumbnails and log cards. */
export function logStatusBadgeClass(status: string | null | undefined): string {
  if (status == null) return "";
  if (isDroppedStatus(status)) return "bg-red-500/95 text-white";
  if (isInProgressStatus(status)) return "bg-amber-400 text-[var(--color-darkest)]";
  if (isCompletedStatus(status)) return "bg-emerald-600 text-white";
  return "bg-[var(--color-mid)]/90 text-[var(--color-lightest)]";
}

/** Soft badge for inline labels and review metadata. */
export function logStatusSoftBadgeClass(status: string | null | undefined): string {
  if (status == null) return "bg-[var(--color-darkest)] text-[var(--color-light)]";
  if (isDroppedStatus(status)) return "bg-red-500/20 text-red-300 border border-red-500/40";
  if (isInProgressStatus(status)) return "bg-amber-400/20 text-amber-200 border border-amber-400/40";
  if (isCompletedStatus(status)) return "bg-emerald-600/20 text-emerald-300 border border-emerald-600/40";
  return "bg-[var(--color-mid)]/30 text-[var(--color-light)] border border-[var(--color-mid)]/50";
}

export function logStatusBorderClass(status: string | null | undefined): string {
  if (status == null) return "border border-[var(--color-surface-border)]";
  if (isDroppedStatus(status)) return "border border-red-500";
  if (isInProgressStatus(status)) return "border border-amber-400";
  if (isCompletedStatus(status)) return "border border-emerald-600";
  return "border border-[var(--color-mid)]";
}

/** Tint for status select triggers in review forms. */
export function logStatusSelectTriggerClass(status: string | null | undefined): string {
  if (!status) return "";
  if (isDroppedStatus(status)) return "border-red-500/60 bg-red-500/10 text-red-200";
  if (isInProgressStatus(status)) return "border-amber-400/60 bg-amber-400/10 text-amber-100";
  if (isCompletedStatus(status)) return "border-emerald-600/60 bg-emerald-600/10 text-emerald-200";
  return "border-[var(--color-mid)] bg-[var(--color-mid)]/20 text-[var(--color-lightest)]";
}

export function mediaTypeUsesEpisodeStatusColors(mediaType: string): boolean {
  return mediaType === "tv" || mediaType === "anime";
}

export type SeriesAirState = "ongoing" | "ended";

const SERIES_ENDED_STATUSES = new Set(["ended", "canceled", "cancelled"]);
const SERIES_ONGOING_STATUSES = new Set(["returning series", "in production", "pilot", "planned"]);

export function getSeriesAirState(status: string | null | undefined): SeriesAirState | null {
  if (!status) return null;
  const s = status.trim().toLowerCase();
  if (SERIES_ENDED_STATUSES.has(s)) return "ended";
  if (SERIES_ONGOING_STATUSES.has(s)) return "ongoing";
  return null;
}

export function seriesAirStatusSoftBadgeClass(status: string | null | undefined): string {
  const air = getSeriesAirState(status);
  if (air === "ongoing") return "bg-amber-400/20 text-amber-200 border border-amber-400/40";
  if (air === "ended") return "bg-emerald-600/20 text-emerald-300 border border-emerald-600/40";
  return "bg-[var(--color-mid)]/30 text-[var(--color-light)] border border-[var(--color-mid)]/50";
}
