/** Max length for review text stored in DB */
const REVIEW_MAX_LENGTH = 10_000;

/**
 * Sanitizes review text for safe DB storage and display.
 * - Strips HTML tags
 * - Removes null bytes and other control characters
 * - Normalizes line endings to \n
 * - Trims and truncates to REVIEW_MAX_LENGTH
 */
export function sanitizeReview(input: string | null | undefined): string | null {
  if (input == null || typeof input !== "string") return null;
  let s = input.trim();
  if (s.length === 0) return null;
  // Strip HTML tags (simple regex; not for parsing, only to remove tags)
  s = s.replace(/<[^>]*>/g, "");
  // Remove null bytes and other control characters (0x00–0x1F except \t \n \r)
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  // Normalize line endings
  s = s.replace(/\r\n?/g, "\n");
  s = s.trim();
  if (s.length === 0) return null;
  if (s.length > REVIEW_MAX_LENGTH) s = s.slice(0, REVIEW_MAX_LENGTH);
  return s;
}
