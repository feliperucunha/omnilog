import type { Locale } from "@/contexts/LocaleContext";

function intlLocaleTag(locale: Locale): string {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "es") return "es";
  return "en";
}

/**
 * Human-readable label for stats API period keys (`YYYY-MM` or `YYYY`), UTC-aligned with the API.
 */
export function formatStatsTimeAxisLabel(
  period: string,
  granularity: "month" | "year",
  locale: Locale
): string {
  const tag = intlLocaleTag(locale);
  if (granularity === "year") {
    if (/^\d{4}$/.test(period)) {
      return new Intl.DateTimeFormat(tag, { year: "numeric", timeZone: "UTC" }).format(
        new Date(Date.UTC(Number(period), 0, 1))
      );
    }
    return period;
  }
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const y = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(y) || month < 1 || month > 12) return period;
  return new Intl.DateTimeFormat(tag, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, month - 1, 1)));
}

/** How many month/year buckets stay visible before "See earlier". */
export const STATS_RECENT_PERIODS = 3;

/** Oldest period key still shown in the default (collapsed) Logs chart view. */
export function statsPeriodRecentCutoff(
  granularity: "month" | "year",
  tzOffsetMinutes: number,
  keepRecent = STATS_RECENT_PERIODS
): string {
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  const shifted = new Date(Date.now() + offsetMs);
  if (granularity === "year") {
    return String(shifted.getUTCFullYear() - (keepRecent - 1));
  }
  let y = shifted.getUTCFullYear();
  let m = shifted.getUTCMonth() + 1 - (keepRecent - 1);
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function isStatsPeriodAtOrAfter(period: string, cutoff: string): boolean {
  return period.localeCompare(cutoff) >= 0;
}

export function sortStatsPeriodsDesc(periods: readonly string[]): string[] {
  return [...periods].sort((a, b) => b.localeCompare(a));
}

export function partitionStatsPeriods(
  periods: readonly string[],
  granularity: "month" | "year",
  tzOffsetMinutes: number
): { recent: string[]; older: string[] } {
  const sorted = sortStatsPeriodsDesc(periods);
  const cutoff = statsPeriodRecentCutoff(granularity, tzOffsetMinutes);
  const recent: string[] = [];
  const older: string[] = [];
  for (const period of sorted) {
    if (isStatsPeriodAtOrAfter(period, cutoff)) recent.push(period);
    else older.push(period);
  }
  return { recent, older };
}
