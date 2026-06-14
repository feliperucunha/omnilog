import type { MediaType } from "@geeklogs/shared";
import { MARKET_MEDIA_TYPES, SPEND_TRACKED_MEDIA_TYPES } from "@geeklogs/shared";

/** Own / want-to-buy triple switch and list filters (same categories as optional spend). */
export const mediaTypeHasCollectionOwnership = (m: MediaType): boolean =>
  (SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(m);

export const mediaTypeHasBoardGameOnlyFields = (m: MediaType): boolean => m === "boardgames";

export const mediaTypeHasMarketTab = (m: MediaType): boolean =>
  (MARKET_MEDIA_TYPES as readonly string[]).includes(m);

/** Optional purchase price / spend field (currency + amount). */
export const mediaTypeHasPurchaseAmount = (m: MediaType): boolean =>
  (SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(m);

/**
 * Whether to show and persist purchase amount for spend-tracked categories with collection ownership.
 * Include when the user owns the copy or marked it sold (cost basis is kept with sale proceeds for net P&L).
 */
export const spendFieldsIncludePurchase = (
  showCollectionOwnership: boolean,
  own: boolean,
  sold: boolean
): boolean => !showCollectionOwnership || own || sold;
