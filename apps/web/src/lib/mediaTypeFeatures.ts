import type { MediaType } from "@geeklogs/shared";
import { SPEND_TRACKED_MEDIA_TYPES } from "@geeklogs/shared";

/** Own / want-to-buy triple switch and list filters (same categories as optional spend). */
export const mediaTypeHasCollectionOwnership = (m: MediaType): boolean =>
  (SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(m);

export const mediaTypeHasBoardGameOnlyFields = (m: MediaType): boolean => m === "boardgames";

/** Optional purchase price / spend field (currency + amount). */
export const mediaTypeHasPurchaseAmount = (m: MediaType): boolean =>
  (SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(m);
