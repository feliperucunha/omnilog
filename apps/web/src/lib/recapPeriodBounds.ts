export type RecapPeriod = "week" | "month" | "year" | "all";

function offsetMs(tzOffsetMinutes: number): number {
  return Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes * 60 * 1000 : 0;
}

export function recapBoundsForDays(daysAgo: number, tzOffsetMinutes: number): { from: Date; to: Date } {
  const days = Math.max(0, Math.min(365, Math.round(daysAgo)));
  const om = offsetMs(tzOffsetMinutes);
  const now = new Date();
  const shifted = new Date(now.getTime() + om);
  const localMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - om;
  return { from: new Date(localMidnight - days * 86400000), to: now };
}

export function recapCheckpointDays(
  tzOffsetMinutes: number
): Array<{ days: number; kind: "jan1" | "lastMonth" | "lastWeek" }> {
  const om = offsetMs(tzOffsetMinutes);
  const shifted = new Date(Date.now() + om);
  const jan1Days = Math.floor(
    (shifted.getTime() - Date.UTC(shifted.getUTCFullYear(), 0, 1)) / 86400000
  );
  const candidates = [
    { days: jan1Days, kind: "jan1" as const },
    { days: 30, kind: "lastMonth" as const },
    { days: 7, kind: "lastWeek" as const },
  ];
  return candidates
    .filter((candidate) => candidate.days > 0 && candidate.days < 365)
    .filter((candidate, index, all) => all.findIndex((item) => item.days === candidate.days) === index)
    .sort((a, b) => b.days - a.days);
}

function intlLocale(locale: string): string {
  return locale === "pt-BR" ? "pt-BR" : locale;
}

export function buildRecapTitle(params: {
  categoryLabel: string;
  locale: string;
  tzOffsetMinutes: number;
  daysAgo: number;
  allTime: boolean;
  allTimeLabel: string;
  sinceLabel: string;
}): string {
  if (params.allTime) {
    return `${params.categoryLabel} — ${params.allTimeLabel}`;
  }
  const { from } = recapBoundsForDays(params.daysAgo, params.tzOffsetMinutes);
  const shiftedFrom = new Date(from.getTime() + offsetMs(params.tzOffsetMinutes));
  const dateLabel = new Intl.DateTimeFormat(intlLocale(params.locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(shiftedFrom);
  return `${params.categoryLabel} — ${params.sinceLabel} ${dateLabel}`;
}
