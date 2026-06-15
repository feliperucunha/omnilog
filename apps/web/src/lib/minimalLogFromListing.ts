import type { Log, MarketListing } from "@geeklogs/shared";

export function minimalLogFromListing(listing: MarketListing, userId: string): Log {
  return {
    id: listing.logId,
    userId,
    mediaType: listing.mediaType,
    externalId: listing.externalId,
    title: listing.title,
    image: listing.image,
    grade: null,
    review: null,
    listType: null,
    status: null,
    season: null,
    episode: null,
    chapter: null,
    volume: null,
    pagesRead: null,
    startedAt: null,
    completedAt: null,
    contentHours: null,
    hoursToBeat: null,
    gamePlatform: null,
    own: null,
    wantToBuy: null,
    sold: null,
    matchesPlayed: null,
    genres: null,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}
