export interface ProfileVisibility {
  /** When false, public profile URL returns not found. */
  showPublicProfile: boolean;
  showLogCount: boolean;
  showPinnedBadges: boolean;
  showMilestoneBadges: boolean;
  showStatus: boolean;
  showRatings: boolean;
  showReviews: boolean;
  showGenres: boolean;
  /** TMDB / MAL / RAWG scores on posters. */
  showApiScores: boolean;
  /** Season & episode, chapter & volume, etc. */
  showProgress: boolean;
  /** “Finished in …” from started/completed dates. */
  showCompletionTime: boolean;
  /** Own, want to buy, matches played. */
  showCollectionTags: boolean;
  /** Networks, ongoing/ended badges (TV). */
  showTvMetadata: boolean;
  /** Page count (books), player counts (board games). */
  showEnrichmentDetails: boolean;
  /** Active market listings on the public profile. */
  showMarketListings: boolean;
  /** Board game sessions logged by others where this user is tagged as a player. */
  showTaggedBoardGameMatches: boolean;
}

export const DEFAULT_PROFILE_VISIBILITY: ProfileVisibility = {
  showPublicProfile: true,
  showLogCount: true,
  showPinnedBadges: true,
  showMilestoneBadges: true,
  showStatus: true,
  showRatings: true,
  showReviews: true,
  showGenres: true,
  showApiScores: true,
  showProgress: true,
  showCompletionTime: true,
  showCollectionTags: true,
  showTvMetadata: true,
  showEnrichmentDetails: true,
  showMarketListings: true,
  showTaggedBoardGameMatches: false,
};

const VISIBILITY_KEYS = Object.keys(DEFAULT_PROFILE_VISIBILITY) as (keyof ProfileVisibility)[];

export function mergeProfileVisibility(
  partial: Partial<ProfileVisibility> | null | undefined
): ProfileVisibility {
  if (!partial) return { ...DEFAULT_PROFILE_VISIBILITY };
  const out = { ...DEFAULT_PROFILE_VISIBILITY };
  for (const key of VISIBILITY_KEYS) {
    if (typeof partial[key] === "boolean") {
      out[key] = partial[key];
    }
  }
  return out;
}

export function parseProfileVisibilityJson(
  json: string | null | undefined
): ProfileVisibility {
  if (!json || json.trim() === "") return { ...DEFAULT_PROFILE_VISIBILITY };
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_PROFILE_VISIBILITY };
    return mergeProfileVisibility(parsed as Partial<ProfileVisibility>);
  } catch {
    return { ...DEFAULT_PROFILE_VISIBILITY };
  }
}
