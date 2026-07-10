import { isCapacitorNative } from "@/lib/androidOverlayBack";

/** Where to send signed-out users: marketing landing on web, login on native. */
export function getUnauthenticatedEntryPath(): string {
  return isCapacitorNative() ? "/login" : "/";
}
