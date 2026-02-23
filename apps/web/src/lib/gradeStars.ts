/** Grade is stored 0–10 in DB. UI uses 0–5 stars with half steps. */
export function gradeToStars(grade: number | null | undefined): number {
  if (grade == null) return 0;
  return Math.max(0, Math.min(5, grade / 2));
}

/** Convert UI stars (0–5, half steps) to DB grade (0–10). */
export function starsToGrade(stars: number): number {
  return Math.round(Math.max(0, Math.min(5, stars)) * 2);
}
