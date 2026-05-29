export const ONBOARDING_SPOTLIGHT_IDS = [
  "searchCategory",
  "dashboardImport",
  "statisticsRecap",
] as const;

export type OnboardingSpotlightId = (typeof ONBOARDING_SPOTLIGHT_IDS)[number];

const SPOTLIGHT_ID_SET = new Set<string>(ONBOARDING_SPOTLIGHT_IDS);

export function isOnboardingSpotlightId(value: string): value is OnboardingSpotlightId {
  return SPOTLIGHT_ID_SET.has(value);
}

export function parseOnboardingSpotlightsDismissedJson(raw: string | null | undefined): OnboardingSpotlightId[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is OnboardingSpotlightId => isOnboardingSpotlightId(String(id)));
  } catch {
    return [];
  }
}

export function mergeOnboardingSpotlightDismissed(
  existing: OnboardingSpotlightId[],
  spotlight: OnboardingSpotlightId
): OnboardingSpotlightId[] {
  if (existing.includes(spotlight)) return existing;
  return [...existing, spotlight];
}
