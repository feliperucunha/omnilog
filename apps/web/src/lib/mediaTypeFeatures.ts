import type { MediaType } from "@geeklogs/shared";

/** Own / want-to-buy triple switch and list filters (not matches played). */
export const mediaTypeHasCollectionOwnership = (m: MediaType): boolean =>
  m === "boardgames" || m === "games";

export const mediaTypeHasBoardGameOnlyFields = (m: MediaType): boolean => m === "boardgames";
