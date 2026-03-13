/**
 * Persistent key-value storage. Uses Capacitor Preferences API (SharedPreferences on Android,
 * UserDefaults on iOS, localStorage fallback on web). Use this instead of raw localStorage
 * so data persists on mobile and survives app restarts.
 */

import { Preferences } from "@capacitor/preferences";

/** In-memory cache so getItemSync() can return last known value (e.g. for api.ts getAuthHeaders). */
const cache = new Map<string, string>();

/** Get a value (async). Uses Preferences everywhere so Android/iOS get native persistence. */
export async function getItem(key: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key });
    if (value != null) cache.set(key, value);
    return value;
  } catch {
    return cache.get(key) ?? null;
  }
}

/** Set a value (async). Ensures persistence on Android (SharedPreferences). */
export async function setItem(key: string, value: string): Promise<void> {
  try {
    await Preferences.set({ key, value });
    cache.set(key, value);
  } catch {
    cache.set(key, value);
  }
}

/** Remove a value (async). */
export async function removeItem(key: string): Promise<void> {
  try {
    await Preferences.remove({ key });
  } catch {
    // ignore
  }
  cache.delete(key);
}

/**
 * Synchronous get. Returns in-memory cache (populated by getItem/setItem).
 * Use for callers that must read sync (e.g. getAuthHeaders). After app load,
 * AuthContext loads token via getItem() so the cache is filled.
 */
export function getItemSync(key: string): string | null {
  return cache.get(key) ?? null;
}
