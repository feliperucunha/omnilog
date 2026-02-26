import type { MediaType } from "@logeverything/shared";
import type { BoardGameProvider } from "@logeverything/shared";
import type { ApiKeyProvider } from "@/lib/apiKeyMeta";

/** Media types that require a user/saved API key (anime & manga do not). */
const MEDIA_TYPE_TO_PROVIDER: Partial<Record<MediaType, ApiKeyProvider>> = {
  movies: "tmdb",
  tv: "tmdb",
  boardgames: "bgg",
  games: "rawg",
  comics: "comicvine",
};

/**
 * For boardgames, pass boardGameProvider to get the effective provider (bgg or ludopedia).
 * Otherwise returns the default provider for the media type.
 */
export function getApiKeyProviderForMediaType(
  mediaType: MediaType,
  boardGameProvider?: BoardGameProvider | null
): ApiKeyProvider | null {
  if (mediaType === "boardgames" && boardGameProvider === "ludopedia") return "ludopedia";
  return MEDIA_TYPE_TO_PROVIDER[mediaType] ?? null;
}

export function mediaTypeRequiresApiKey(mediaType: MediaType): boolean {
  return getApiKeyProviderForMediaType(mediaType) != null;
}
