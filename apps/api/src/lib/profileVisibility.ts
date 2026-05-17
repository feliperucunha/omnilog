import {
  DEFAULT_PROFILE_VISIBILITY,
  mergeProfileVisibility,
  parseProfileVisibilityJson,
  type ProfileVisibility,
} from "@geeklogs/shared";

export { DEFAULT_PROFILE_VISIBILITY, mergeProfileVisibility, parseProfileVisibilityJson };
export type { ProfileVisibility };

export function getProfileVisibilityFromUser(user: {
  profileVisibility: string | null;
}): ProfileVisibility {
  return parseProfileVisibilityJson(user.profileVisibility);
}

export function applyProfileVisibilityToPublicLog(
  log: Record<string, unknown>,
  visibility: ProfileVisibility
): Record<string, unknown> {
  const out = { ...log };
  if (!visibility.showRatings) out.grade = null;
  if (!visibility.showReviews) out.review = null;
  if (!visibility.showStatus) out.status = null;
  if (!visibility.showGenres) {
    out.genres = null;
    out.mechanics = null;
  }
  if (!visibility.showApiScores) out.apiScore = null;
  if (!visibility.showProgress) {
    out.season = null;
    out.episode = null;
    out.chapter = null;
    out.volume = null;
    out.pagesRead = null;
    out.gamePlatform = null;
  }
  if (!visibility.showCompletionTime) {
    out.startedAt = null;
    out.completedAt = null;
  }
  if (!visibility.showCollectionTags) {
    out.own = null;
    out.wantToBuy = null;
    out.sold = null;
    out.matchesPlayed = null;
  }
  if (!visibility.showTvMetadata) {
    out.networks = null;
    out.tvStatus = null;
  }
  if (!visibility.showEnrichmentDetails) {
    out.pagesCount = null;
    out.playersMin = null;
    out.playersMax = null;
  }
  out.purchaseAmountMinor = null;
  out.purchaseCurrency = null;
  out.saleAmountMinor = null;
  out.saleCurrency = null;
  out.spendFieldsAt = null;
  out.affinityContext = null;
  return out;
}
