import { Capacitor } from "@capacitor/core";

export type ImpactKind = "light" | "medium" | "heavy";

/**
 * Best-effort haptic on native; no-op on web.
 */
export function triggerImpact(kind: ImpactKind = "light"): void {
  if (!Capacitor.isNativePlatform()) return;
  void (async () => {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      const style =
        kind === "heavy"
          ? ImpactStyle.Heavy
          : kind === "medium"
            ? ImpactStyle.Medium
            : ImpactStyle.Light;
      await Haptics.impact({ style });
    } catch {
      // ignore unsupported / simulator
    }
  })();
}
