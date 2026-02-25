import type { MediaType } from "@logeverything/shared";
import type { ApiKeyProvider } from "@/lib/apiKeyMeta";

/** Media types that require a user/saved API key (anime & manga do not). */
const MEDIA_TYPE_TO_PROVIDER: Partial<Record<MediaType, ApiKeyProvider>> = {
  movies: "tmdb",
  tv: "tmdb",
  boardgames: "bgg",
  games: "rawg",
  comics: "comicvine",
};

export function getApiKeyProviderForMediaType(mediaType: MediaType): ApiKeyProvider | null {
  return MEDIA_TYPE_TO_PROVIDER[mediaType] ?? null;
}

export function mediaTypeRequiresApiKey(mediaType: MediaType): boolean {
  return getApiKeyProviderForMediaType(mediaType) != null;
}
