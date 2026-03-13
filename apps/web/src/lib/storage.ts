/**
 * Persistent key-value storage. On Capacitor native (Android/iOS) uses
 * Preferences API so data survives app restarts; on web uses localStorage.
 * Use this instead of localStorage for anything that must persist on mobile.
 */

const w = typeof window !== "undefined" ? (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }) : null;
const isNative = (): boolean => Boolean(w?.Capacitor?.isNativePlatform?.());

/** In-memory cache for native so getItemSync() can return last known value (e.g. for api.ts getAuthHeaders). */
const cache = new Map<string, string>();

async function getPreferences(): Promise<typeof import("@capacitor/preferences").Preferences | null> {
  if (!isNative()) return null;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    return Preferences;
  } catch {
    return null;
  }
}

/** Get a value (async). On native uses Preferences; on web uses localStorage. */
export async function getItem(key: string): Promise<string | null> {
  const prefs = await getPreferences();
  if (prefs) {
    try {
      const { value } = await prefs.get({ key });
      if (value != null) cache.set(key, value);
      return value;
    } catch {
      return cache.get(key) ?? null;
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Set a value (async). On native uses Preferences; on web uses localStorage. */
export async function setItem(key: string, value: string): Promise<void> {
  const prefs = await getPreferences();
  if (prefs) {
    try {
      await prefs.set({ key, value });
      cache.set(key, value);
    } catch {
      cache.set(key, value);
    }
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** Remove a value (async). */
export async function removeItem(key: string): Promise<void> {
  const prefs = await getPreferences();
  if (prefs) {
    try {
      await prefs.remove({ key });
    } catch {
      // ignore
    }
    cache.delete(key);
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Synchronous get. On web returns localStorage. On native returns in-memory cache
 * (populated by getItem/setItem). Use for callers that must read sync (e.g. getAuthHeaders).
 * After app load, AuthContext loads token via getItem() so the cache is filled.
 */
export function getItemSync(key: string): string | null {
  if (!isNative()) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return cache.get(key) ?? null;
}
