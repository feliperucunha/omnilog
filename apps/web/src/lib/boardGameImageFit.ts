import type { BoardGameProvider, MediaType } from "@geeklogs/shared";
import { coerceImageUrlString } from "@/lib/getHeroImageUrl";

/** BGG serves box art from this CDN; images are typically landscape (not poster-shaped). */
export function isBggGeekdoImageUrl(url: string | null | undefined): boolean {
  const s = coerceImageUrlString(url);
  if (!s) return false;
  return /geekdo-image\.com/i.test(s);
}

/**
 * True when this board-game row should use BGG-oriented framing (landscape art in portrait UI).
 * Uses `boardGameSource` / `itemSource` when known; otherwise geekdo URL or active BGG provider.
 */
export function isBggBoardGameImageContext(
  mediaType: MediaType | undefined,
  imageUrl: string | null | undefined,
  boardGameSource?: BoardGameProvider | null,
  /** Board game search tab provider, or user default when creating a log. */
  activeBoardGameProvider?: BoardGameProvider | null
): boolean {
  if (mediaType !== "boardgames") return false;
  if (boardGameSource === "bgg") return true;
  if (isBggGeekdoImageUrl(imageUrl)) return true;
  if (activeBoardGameProvider === "bgg") return true;
  return false;
}

/** Back layer: scaled cover + blur so letterboxing isn’t empty flat color. */
export const BGG_BLUR_BACKDROP_IMG_CLASS =
  "pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover object-center blur-md opacity-[0.75]";

/** Front layer: full artwork at native aspect ratio inside the frame. */
export const BGG_CONTAIN_FOREGROUND_IMG_CLASS =
  "absolute inset-0 z-[1] h-full w-full object-contain object-center";
