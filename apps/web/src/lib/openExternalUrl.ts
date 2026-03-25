import { Capacitor } from "@capacitor/core";

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Opens a URL in the system browser (Custom Tabs on Android, Safari on iOS).
 * Web: `window.open` with noopener.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isNative()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}
