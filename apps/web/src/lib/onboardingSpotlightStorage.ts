import type { OnboardingSpotlightId } from "@geeklogs/shared";
import { apiFetch } from "@/lib/api";
import * as storage from "@/lib/storage";

const PREFIX = "geeklogs-onboarding-spotlight-";

export const ONBOARDING_SPOTLIGHT_KEYS = {
  searchCategory: "searchCategory",
  dashboardImport: "dashboardImport",
  statisticsRecap: "statisticsRecap",
} as const satisfies Record<string, OnboardingSpotlightId>;

export type OnboardingSpotlightKey =
  (typeof ONBOARDING_SPOTLIGHT_KEYS)[keyof typeof ONBOARDING_SPOTLIGHT_KEYS];

const LEGACY_LOCAL_KEYS: Record<OnboardingSpotlightId, string> = {
  searchCategory: `${PREFIX}search-category`,
  dashboardImport: `${PREFIX}dashboard-import`,
  statisticsRecap: `${PREFIX}statistics-recap`,
};

function storageKey(id: OnboardingSpotlightId): string {
  return `${PREFIX}${id}`;
}

function readWebLocal(id: OnboardingSpotlightId): boolean {
  try {
    if (localStorage.getItem(storageKey(id)) === "1") return true;
    if (localStorage.getItem(LEGACY_LOCAL_KEYS[id]) === "1") return true;
  } catch {
    return false;
  }
  return false;
}

function writeWebLocal(id: OnboardingSpotlightId): void {
  try {
    localStorage.setItem(storageKey(id), "1");
  } catch {
    /* ignore */
  }
}

export function isOnboardingSpotlightDismissedForAccount(
  id: OnboardingSpotlightId,
  dismissedFromServer: string[] | undefined
): boolean {
  return dismissedFromServer?.includes(id) ?? false;
}

export async function loadOnboardingSpotlightDismissed(
  id: OnboardingSpotlightId,
  options?: { dismissedFromServer?: string[]; hasToken?: boolean }
): Promise<boolean> {
  if (options?.hasToken) {
    if (isOnboardingSpotlightDismissedForAccount(id, options.dismissedFromServer ?? [])) {
      return true;
    }
    return readWebLocal(id);
  }

  if (typeof window === "undefined") return true;
  if (!storage.isNativePlatform()) {
    return readWebLocal(id);
  }
  try {
    const v = await storage.getItem(storageKey(id));
    if (v === "1") return true;
    if (readWebLocal(id)) {
      await storage.setItem(storageKey(id), "1");
      return true;
    }
  } catch {
    if (readWebLocal(id)) return true;
  }
  return false;
}

export async function saveOnboardingSpotlightDismissed(
  id: OnboardingSpotlightId,
  options?: {
    hasToken?: boolean;
    onServerDismissed?: (next: string[]) => void;
  }
): Promise<void> {
  writeWebLocal(id);
  if (storage.isNativePlatform()) {
    try {
      await storage.setItem(storageKey(id), "1");
    } catch {
      /* ignore */
    }
  }

  if (options?.hasToken) {
    const res = await apiFetch<{ onboardingSpotlightsDismissed: string[] }>(
      "/me/onboarding-spotlights/dismiss",
      {
        method: "POST",
        body: JSON.stringify({ spotlight: id }),
      }
    );
    options.onServerDismissed?.(res.onboardingSpotlightsDismissed ?? []);
  }
}

export function isOnboardingSpotlightDoneSync(
  id: OnboardingSpotlightId,
  dismissedFromServer?: string[]
): boolean {
  if (dismissedFromServer) {
    return isOnboardingSpotlightDismissedForAccount(id, dismissedFromServer);
  }
  if (typeof window === "undefined") return true;
  if (storage.isNativePlatform()) return false;
  return readWebLocal(id);
}

export async function setOnboardingSpotlightDone(
  id: OnboardingSpotlightId,
  options?: Parameters<typeof saveOnboardingSpotlightDismissed>[1]
): Promise<void> {
  await saveOnboardingSpotlightDismissed(id, options);
}

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
