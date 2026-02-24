/**
 * Format time-to-beat hours for display (e.g. "12 h", "1 h 30 m").
 * Used for games only (RAWG playtime).
 */
export function formatTimeToBeatHours(hours: number): { hours: number; minutes: number } {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return { hours: h, minutes: m };
}

/**
 * Format time between two dates for display (e.g. "3 days", "2 weeks").
 */
export function formatTimeToFinish(startedAt: string, completedAt: string): string {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const days = Math.round((end - start) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Same day";
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks === 1) return "1 week";
  if (weeks < 4) return `${weeks} weeks`;
  const months = Math.round(days / 30);
  if (months === 1) return "1 month";
  if (months < 12) return `${months} months`;
  const years = Math.round(days / 365);
  return years === 1 ? "1 year" : `${years} years`;
}
