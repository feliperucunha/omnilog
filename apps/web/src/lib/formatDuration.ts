/**
 * Format time-to-beat hours for display (e.g. "12 h", "1 h 30 m").
 * Used for games only (RAWG playtime).
 */
export function formatTimeToBeatHours(hours: number): { hours: number; minutes: number } {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return { hours: h, minutes: m };
}

import type { Locale } from "@/contexts/LocaleContext";

type DurationUnit = "day" | "week" | "month" | "year";

const DURATION_UNITS: Record<Locale, Record<DurationUnit, [singular: string, plural: string]>> = {
  en: {
    day: ["day", "days"],
    week: ["week", "weeks"],
    month: ["month", "months"],
    year: ["year", "years"],
  },
  "pt-BR": {
    day: ["dia", "dias"],
    week: ["semana", "semanas"],
    month: ["mês", "meses"],
    year: ["ano", "anos"],
  },
  es: {
    day: ["día", "días"],
    week: ["semana", "semanas"],
    month: ["mes", "meses"],
    year: ["año", "años"],
  },
};

function formatUnit(count: number, unit: DurationUnit, locale: Locale): string {
  const labels = DURATION_UNITS[locale][unit];
  return `${count} ${count === 1 ? labels[0] : labels[1]}`;
}

/**
 * Format time between two dates for display (e.g. "3 days", "2 weeks").
 */
export function formatTimeToFinish(
  startedAt: string,
  completedAt: string,
  locale: Locale = "en"
): string {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const days = Math.round((end - start) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "";
  if (days < 7) return formatUnit(days, "day", locale);
  const weeks = Math.round(days / 7);
  if (weeks < 4) return formatUnit(weeks, "week", locale);
  const months = Math.round(days / 30);
  if (months < 12) return formatUnit(months, "month", locale);
  return formatUnit(Math.round(days / 365), "year", locale);
}
