/**
 * Input sanitization for safe DB storage and external API use.
 * - Removes null bytes and control characters (except \t \n \r)
 * - Trims and enforces max lengths to avoid DoS and injection
 */

/** Remove null bytes and C0 control characters (0x00–0x1F except \t \n \r). */
export function stripControlChars(s: string): string {
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
}

/** Max lengths for stored/used strings. */
export const TITLE_MAX_LENGTH = 500;
export const EXTERNAL_ID_MAX_LENGTH = 256;
export const SEARCH_QUERY_MAX_LENGTH = 300;
export const API_KEY_MAX_LENGTH = 512;
export const IMAGE_URL_MAX_LENGTH = 2048;
const REVIEW_MAX_LENGTH = 10_000;

/**
 * Sanitize a plain text field (title, externalId, search query, etc.).
 * Trims, strips control chars and HTML, truncates to maxLength.
 * Returns null if empty after trim.
 */
export function sanitizeText(
  input: string | null | undefined,
  maxLength: number
): string | null {
  if (input == null || typeof input !== "string") return null;
  let s = stripControlChars(input).trim();
  s = s.replace(/<[^>]*>/g, "");
  s = s.trim();
  if (s.length === 0) return null;
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

/**
 * Sanitize a URL string (image URL). Caller must validate URL format (e.g. zod.url()).
 * Trims, strips control chars, truncates to maxLength.
 */
export function sanitizeUrl(
  input: string | null | undefined,
  maxLength: number = IMAGE_URL_MAX_LENGTH
): string | null {
  if (input == null || typeof input !== "string") return null;
  const s = stripControlChars(input).trim();
  if (s.length === 0) return null;
  return s.length > maxLength ? s.slice(0, maxLength) : s;
}

/**
 * Sanitize an API key or other opaque secret before storage.
 * Trims, strips control chars, truncates. Returns null if empty after trim.
 */
export function sanitizeApiKey(input: string | null | undefined): string | null {
  return sanitizeText(input, API_KEY_MAX_LENGTH);
}

/**
 * Sanitize email before DB lookup/storage: trim, strip control chars, max 255.
 * Returns null if empty after trim. Caller should still validate format (zod.email()).
 */
export function sanitizeEmail(input: string | null | undefined): string | null {
  if (input == null || typeof input !== "string") return null;
  const s = stripControlChars(input).trim();
  if (s.length === 0) return null;
  return s.length > 255 ? s.slice(0, 255) : s;
}

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
  s = s.replace(/<[^>]*>/g, "");
  s = stripControlChars(s);
  s = s.replace(/\r\n?/g, "\n");
  s = s.trim();
  if (s.length === 0) return null;
  if (s.length > REVIEW_MAX_LENGTH) s = s.slice(0, REVIEW_MAX_LENGTH);
  return s;
}
