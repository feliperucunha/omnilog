import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { APP_PTR_REFRESH_EVENT } from "@/lib/appPtrRefresh";

const PULL_THRESHOLD_PX = 72;

function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * When the scroll container is at the top, a downward pull dispatches {@link APP_PTR_REFRESH_EVENT}.
 * Intended for main list routes; native-only.
 */
export function usePullToRefresh(opts: {
  enabled: boolean;
  scrollRef: React.RefObject<HTMLElement | null>;
}): void {
  const { enabled, scrollRef } = opts;
  const startYRef = useRef(0);
  const trackingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isNativeMobile()) return;
    const el = scrollRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (el.scrollTop > 2) return;
      startYRef.current = e.touches[0].clientY;
      trackingRef.current = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!trackingRef.current) return;
      trackingRef.current = false;
      if (el.scrollTop > 2) return;
      const dy = e.changedTouches[0].clientY - startYRef.current;
      if (dy >= PULL_THRESHOLD_PX) {
        window.dispatchEvent(new CustomEvent(APP_PTR_REFRESH_EVENT));
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [enabled, scrollRef]);
}
