/**
 * Grades in the API/DB are 0–10 (0 = no rating). The UI uses 10 stars and
 * integer grades 1–10 when a rating is set.
 */
export function gradeToStars(grade: number | null | undefined): number | null {
  if (grade == null || !Number.isFinite(grade) || grade <= 0) return null;
  return Math.max(1, Math.min(10, Math.round(grade)));
}

/** Full-star count (1–10) to DB grade (1–10). */
export function starsToGrade(stars: number): number {
  return Math.max(1, Math.min(10, Math.round(stars)));
}
