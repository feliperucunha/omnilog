import * as storage from "@/lib/storage";

const PREFIX = "geeklogs-onboarding-spotlight-";

export const ONBOARDING_SPOTLIGHT_KEYS = {
  searchCategory: `${PREFIX}search-category`,
  dashboardImport: `${PREFIX}dashboard-import`,
  statisticsRecap: `${PREFIX}statistics-recap`,
} as const;

export type OnboardingSpotlightKey =
  (typeof ONBOARDING_SPOTLIGHT_KEYS)[keyof typeof ONBOARDING_SPOTLIGHT_KEYS];

function readWebLocal(key: OnboardingSpotlightKey): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeWebLocal(key: OnboardingSpotlightKey): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Web: synchronous localStorage.
 * Native (Capacitor): SharedPreferences via Preferences — survives Android app updates more reliably than WebView localStorage alone.
 */
export async function loadOnboardingSpotlightDismissed(key: OnboardingSpotlightKey): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (!storage.isNativePlatform()) {
    return readWebLocal(key);
  }
  try {
    const v = await storage.getItem(key);
    if (v === "1") return true;
    if (readWebLocal(key)) {
      await storage.setItem(key, "1");
      return true;
    }
  } catch {
    if (readWebLocal(key)) return true;
  }
  return false;
}

export async function saveOnboardingSpotlightDismissed(key: OnboardingSpotlightKey): Promise<void> {
  if (typeof window === "undefined") return;
  if (!storage.isNativePlatform()) {
    writeWebLocal(key);
    return;
  }
  try {
    await storage.setItem(key, "1");
  } catch {
    /* ignore */
  }
  writeWebLocal(key);
}

/** Sync read for web only; on native returns false (caller must load async). */
export function isOnboardingSpotlightDoneSync(key: OnboardingSpotlightKey): boolean {
  if (typeof window === "undefined") return true;
  if (storage.isNativePlatform()) return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

/** @deprecated Prefer saveOnboardingSpotlightDismissed — kept for call-site clarity */
export async function setOnboardingSpotlightDone(key: OnboardingSpotlightKey): Promise<void> {
  await saveOnboardingSpotlightDismissed(key);
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
