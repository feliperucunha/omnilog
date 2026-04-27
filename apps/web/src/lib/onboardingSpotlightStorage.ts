const PREFIX = "geeklogs-onboarding-spotlight-";

export const ONBOARDING_SPOTLIGHT_KEYS = {
  searchCategory: `${PREFIX}search-category`,
  dashboardImport: `${PREFIX}dashboard-import`,
  statisticsRecap: `${PREFIX}statistics-recap`,
} as const;

export type OnboardingSpotlightKey =
  (typeof ONBOARDING_SPOTLIGHT_KEYS)[keyof typeof ONBOARDING_SPOTLIGHT_KEYS];

export function isOnboardingSpotlightDone(key: OnboardingSpotlightKey): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

export function setOnboardingSpotlightDone(key: OnboardingSpotlightKey): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

/** Find the first element with a non-zero layout box (e.g. desktop vs mobile duplicate targets). */
export function getFirstVisibleByIds(ids: string[]): HTMLElement | null {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return el;
    }
  }
  return null;
}
