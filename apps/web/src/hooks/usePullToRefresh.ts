import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { APP_PTR_REFRESH_EVENT } from "@/lib/appPtrRefresh";

/** Finger travel required to trigger refresh (matches prior behavior). */
export const PULL_TO_REFRESH_THRESHOLD_PX = 72;

function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform();
}

export type PullToRefreshVisualState = {
  pullRawDy: number;
  isRefreshing: boolean;
  thresholdPx: number;
};

/**
 * When the scroll container is at the top, a downward pull dispatches {@link APP_PTR_REFRESH_EVENT}.
 * Tracks pull distance for UI (ring / spinner). Intended for main list routes; native-only.
 */
export function usePullToRefresh(opts: {
  enabled: boolean;
  scrollRef: React.RefObject<HTMLElement | null>;
}): PullToRefreshVisualState {
  const { enabled, scrollRef } = opts;
  const [pullRawDy, setPullRawDy] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const trackingRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !isNativeMobile()) {
      setPullRawDy(0);
      setIsRefreshing(false);
      return;
    }

    const el = scrollRef.current;
    if (!el) return;

    const clearRefreshTimer = () => {
      if (refreshTimerRef.current != null) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };

    const onStart = (e: TouchEvent) => {
      if (el.scrollTop > 2) return;
      startYRef.current = e.touches[0].clientY;
      trackingRef.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!trackingRef.current) return;
      if (el.scrollTop > 2) {
        trackingRef.current = false;
        setPullRawDy(0);
        return;
      }
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        setPullRawDy(0);
        return;
      }
      setPullRawDy(Math.min(dy, 140));
    };

    const finishPull = (clientY: number) => {
      if (!trackingRef.current) return;
      trackingRef.current = false;
      const dy = clientY - startYRef.current;
      setPullRawDy(0);

      if (el.scrollTop > 2) return;

      if (dy >= PULL_TO_REFRESH_THRESHOLD_PX) {
        clearRefreshTimer();
        setIsRefreshing(true);
        window.dispatchEvent(new CustomEvent(APP_PTR_REFRESH_EVENT));
        refreshTimerRef.current = setTimeout(() => {
          setIsRefreshing(false);
          refreshTimerRef.current = null;
        }, 1000);
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!trackingRef.current) return;
      finishPull(e.changedTouches[0].clientY);
    };

    const onCancel = () => {
      if (!trackingRef.current) return;
      trackingRef.current = false;
      setPullRawDy(0);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });

    return () => {
      clearRefreshTimer();
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [enabled, scrollRef]);

  if (!enabled || !isNativeMobile()) {
    return { pullRawDy: 0, isRefreshing: false, thresholdPx: PULL_TO_REFRESH_THRESHOLD_PX };
  }

  return {
    pullRawDy,
    isRefreshing,
    thresholdPx: PULL_TO_REFRESH_THRESHOLD_PX,
  };
}
