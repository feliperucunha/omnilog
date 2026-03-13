/**
 * Persistent key-value storage.
 * - Web: localStorage + cookie backup for auth token (reliable, survives refresh and browser close).
 * - Native (Android/iOS): Capacitor Preferences (SharedPreferences/UserDefaults) with localStorage
 *   mirror for auth keys so we have a fallback if Preferences is cleared on app kill.
 */

const TOKEN_KEY = "dogument_token";
const USER_KEY = "dogument_user";
const COOKIE_NAME = "dogument_token";
const COOKIE_MAX_AGE_DAYS = 365;

function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(w?.Capacitor?.isNativePlatform?.());
}

/** In-memory cache for getItemSync (used by api.ts getAuthHeaders before async load). */
const cache = new Map<string, string>();

// ---------- Web: localStorage + cookie for token ----------
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  const prefix = name + "=";
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      const value = part.slice(prefix.length);
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

function setCookie(name: string, value: string, maxAgeDays: number): void {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  document.cookie =
    name +
    "=" +
    encodeURIComponent(value) +
    "; path=/; max-age=" +
    maxAgeDays * 24 * 60 * 60 +
    "; SameSite=Lax" +
    (secure ? "; Secure" : "");
}

function removeCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = name + "=; path=/; max-age=0";
}

function webGetItem(key: string): string | null {
  try {
    let value = localStorage.getItem(key);
    if (value == null && key === TOKEN_KEY) value = getCookie(COOKIE_NAME);
    return value;
  } catch {
    if (key === TOKEN_KEY) return getCookie(COOKIE_NAME);
    return null;
  }
}

function webSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota or disabled
  }
  if (key === TOKEN_KEY) setCookie(COOKIE_NAME, value, COOKIE_MAX_AGE_DAYS);
}

function webRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  if (key === TOKEN_KEY) removeCookie(COOKIE_NAME);
}

// ---------- Native: Capacitor Preferences + localStorage mirror for auth ----------
async function nativeGetItem(key: string): Promise<string | null> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    if (value != null) {
      cache.set(key, value);
      return value;
    }
  } catch {
    // Preferences may fail; try localStorage fallback for auth keys
  }
  if (key === TOKEN_KEY || key === USER_KEY) {
    try {
      const fallback = localStorage.getItem(key);
      if (fallback != null) {
        cache.set(key, fallback);
        return fallback;
      }
    } catch {
      // ignore
    }
  }
  return cache.get(key) ?? null;
}

async function nativeSetItem(key: string, value: string): Promise<void> {
  cache.set(key, value);
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch {
    // persist to localStorage as backup so next launch might recover
  }
  if (key === TOKEN_KEY || key === USER_KEY) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

async function nativeRemoveItem(key: string): Promise<void> {
  cache.delete(key);
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------- Public API ----------
export async function getItem(key: string): Promise<string | null> {
  if (isNativePlatform()) {
    return nativeGetItem(key);
  }
  const value = webGetItem(key);
  if (value != null) cache.set(key, value);
  return value;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isNativePlatform()) {
    await nativeSetItem(key, value);
    return;
  }
  cache.set(key, value);
  webSetItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (isNativePlatform()) {
    await nativeRemoveItem(key);
    return;
  }
  cache.delete(key);
  webRemoveItem(key);
}

/**
 * Synchronous get. On web uses localStorage (and cookie for token); on native uses in-memory cache.
 * After app load, AuthContext must call getItem(TOKEN_KEY) so the cache is filled on native.
 */
export function getItemSync(key: string): string | null {
  if (!isNativePlatform()) {
    const value = webGetItem(key);
    if (value != null) return value;
    return cache.get(key) ?? null;
  }
  return cache.get(key) ?? null;
}
