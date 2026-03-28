import { Capacitor } from "@capacitor/core";

type Entry = { id: number; close: () => void };

let nextId = 0;
const stack: Entry[] = [];

export function isCapacitorAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/** Any Capacitor native shell (Android or iOS). */
export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

/**
 * Register a dismiss callback for the top-most Android back handling. Unregister on cleanup.
 * Order follows mount order (last mounted = closed first).
 */
export function registerAndroidOverlayClose(close: () => void): () => void {
  const id = nextId++;
  stack.push({ id, close });
  return () => {
    const idx = stack.findIndex((e) => e.id === id);
    if (idx >= 0) stack.splice(idx, 1);
  };
}

/** Invokes the most recently registered overlay close. Returns true if one ran. */
export function consumeAndroidOverlayBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  stack.pop();
  top.close();
  return true;
}
