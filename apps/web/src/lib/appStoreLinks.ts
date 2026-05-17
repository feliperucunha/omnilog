import { Capacitor } from "@capacitor/core";
import { openExternalUrl } from "@/lib/openExternalUrl";

export const ANDROID_APP_ID = "com.geeklogs.app";

export const PLAY_STORE_WEB_URL =
  "https://play.google.com/store/apps/details?id=com.geeklogs.app";

const PLAY_STORE_MARKET_URL = `market://details?id=${ANDROID_APP_ID}`;

export async function openAppStoreForUpdate(): Promise<void> {
  if (Capacitor.getPlatform() === "android") {
    try {
      await openExternalUrl(PLAY_STORE_MARKET_URL);
      return;
    } catch {
      /* fall through to web URL */
    }
  }
  await openExternalUrl(PLAY_STORE_WEB_URL);
}
