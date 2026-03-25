import { useEffect, useRef } from "react";
import { isCapacitorAndroid, registerAndroidOverlayClose } from "@/lib/androidOverlayBack";

/**
 * While `enabled`, registers `onClose` for Android hardware/gesture back (see consumeAndroidOverlayBack).
 * The latest `onClose` is always called; the native registration only updates when `enabled` changes.
 */
export function useAndroidOverlayBack(enabled: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isCapacitorAndroid() || !enabled) return;
    return registerAndroidOverlayClose(() => {
      onCloseRef.current();
    });
  }, [enabled]);
}
