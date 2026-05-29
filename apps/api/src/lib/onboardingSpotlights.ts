import {
  mergeOnboardingSpotlightDismissed,
  parseOnboardingSpotlightsDismissedJson,
  type OnboardingSpotlightId,
} from "@geeklogs/shared";

export function getOnboardingSpotlightsDismissed(
  raw: string | null | undefined
): OnboardingSpotlightId[] {
  return parseOnboardingSpotlightsDismissedJson(raw);
}

export function serializeOnboardingSpotlightsDismissed(ids: OnboardingSpotlightId[]): string {
  return JSON.stringify(ids);
}

export function addDismissedOnboardingSpotlight(
  raw: string | null | undefined,
  spotlight: OnboardingSpotlightId
): OnboardingSpotlightId[] {
  return mergeOnboardingSpotlightDismissed(getOnboardingSpotlightsDismissed(raw), spotlight);
}
