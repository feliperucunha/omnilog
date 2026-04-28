/** Grade in DB/API is 0–10. UI uses 0.5 steps across 0–5 stars. */
export function gradeToStars(grade: number | null | undefined): number | null {
  if (grade == null || !Number.isFinite(grade) || grade <= 0) return null;
  const stars = Math.max(0, Math.min(5, grade / 2));
  return Math.round(stars * 2) / 2;
}

/** UI stars (0–5, half-steps) to API grade (0–10). */
export function starsToGrade(stars: number): number {
  const safe = Math.max(0, Math.min(5, stars));
  return Math.round(safe * 2);
}
