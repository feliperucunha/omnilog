import { Capacitor } from "@capacitor/core";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { PlayBilling } from "@/lib/playBilling";

export const ANDROID_APP_ID = "com.geeklogs.app";

export const PLAY_STORE_WEB_URL =
  "https://play.google.com/store/apps/details?id=com.geeklogs.app";

export async function openAppStoreForUpdate(): Promise<void> {
  if (Capacitor.getPlatform() === "android") {
    await PlayBilling.openPlayStoreListing({ packageId: ANDROID_APP_ID });
    return;
  }
  await openExternalUrl(PLAY_STORE_WEB_URL);
}
