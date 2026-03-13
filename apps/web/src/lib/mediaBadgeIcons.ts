import type { MediaType } from "@dogument/shared";
import { MEDIA_TYPES } from "@dogument/shared";

/**
 * Fixed badge icon per medium. Used for LevelBadge so the icon stays the same when
 * the user levels up; only the level number (Roman numeral) changes.
 */
export const MEDIA_BADGE_ICONS: Record<MediaType, string> = {
  movies: "🎬",
  tv: "📺",
  anime: "🌸",
  manga: "📖",
  comics: "🦸",
  books: "📚",
  games: "🎮",
  boardgames: "🎲",
};

export function getMediaBadgeIcon(mediaType: string): string {
  return MEDIA_TYPES.includes(mediaType as MediaType)
    ? MEDIA_BADGE_ICONS[mediaType as MediaType]
    : "📌";
}
