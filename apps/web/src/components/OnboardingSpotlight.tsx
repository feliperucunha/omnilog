import { useCallback, useEffect, useId, useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import {
  isOnboardingSpotlightDoneSync,
  loadOnboardingSpotlightDismissed,
  saveOnboardingSpotlightDismissed,
  type OnboardingSpotlightKey,
} from "@/lib/onboardingSpotlightStorage";
import { isNativePlatform } from "@/lib/storage";
import { cn } from "@/lib/utils";

const PAD = 8;
const Z_BASE = 500;
const Z_DIM = 501;
const Z_POP = 502;

export interface OnboardingSpotlightProps {
  /** Dismissal key; each screen uses a different key from `ONBOARDING_SPOTLIGHT_KEYS`. */
  storageKey: OnboardingSpotlightKey;
  /** When false, the spotlight never mounts. */
  enabled?: boolean;
  /**
   * Find the element to frame. Return null if not ready.
   * Common pattern: `getFirstVisibleByIds([...])` for responsive duplicate ids.
   */
  getTarget: () => HTMLElement | null;
  /** Localized message body. */
  message: string;
  className?: string;
}

type Rect = { left: number; top: number; width: number; height: number };

function rectFromEl(el: HTMLElement, pad: number): Rect {
  const r = el.getBoundingClientRect();
  return {
    left: r.left - pad,
    top: r.top - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export function OnboardingSpotlight({
  storageKey,
  enabled = true,
  getTarget,
  message,
  className,
}: OnboardingSpotlightProps) {
  const { t } = useLocale();
  const titleId = useId().replace(/:/g, "");
  const maskId = useId().replace(/:/g, "");
  const [dismissed, setDismissed] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return true;
    if (isNativePlatform()) return null;
    return isOnboardingSpotlightDoneSync(storageKey);
  });
  const [active, setActive] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const [arrow, setArrow] = useState<"top" | "bottom" | null>(null);

  useEffect(() => {
    if (!enabled || !isNativePlatform()) return;
    if (dismissed !== null) return;
    let cancelled = false;
    void loadOnboardingSpotlightDismissed(storageKey).then((done) => {
      if (!cancelled) setDismissed(done);
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey, enabled, dismissed]);

  const updateLayout = useCallback(() => {
    if (dismissed !== false || !enabled) {
      setActive(false);
      setTargetRect(null);
      return;
    }
    const el = getTarget();
    if (!el) {
      setTargetRect(null);
      setActive(false);
      return;
    }
    const r = rectFromEl(el, PAD);
    setTargetRect(r);
    setActive(true);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 16;
    const cardW = Math.min(320, vw - margin * 2);
    const approxCardH = 120;
    const gap = 16;
    const spaceBelow = vh - (r.top + r.height) - margin;
    const spaceAbove = r.top - margin;
    const placeBelow = spaceBelow >= approxCardH + 40 || spaceBelow >= spaceAbove;
    setArrow(placeBelow ? "top" : "bottom");

    const centerX = r.left + r.width / 2;
    let top: number;
    if (placeBelow) {
      top = Math.min(r.top + r.height + gap, vh - approxCardH - margin);
    } else {
      top = Math.max(margin, r.top - approxCardH - gap);
    }

    let left = centerX - cardW / 2;
    left = Math.max(margin, Math.min(left, vw - cardW - margin));

    setCardStyle({
      position: "fixed",
      top,
      left,
      width: cardW,
      zIndex: Z_POP,
    });
  }, [dismissed, enabled, getTarget]);

  useLayoutEffect(() => {
    if (dismissed !== false || !enabled) return;
    let cancelled = false;
    let raf = 0;
    const run = (n: number) => {
      if (cancelled) return;
      if (getTarget()) {
        updateLayout();
        return;
      }
      if (n < 60) {
        raf = requestAnimationFrame(() => run(n + 1));
      }
    };
    raf = requestAnimationFrame(() => run(0));
    const t2 = window.setTimeout(() => {
      if (cancelled) return;
      if (getTarget()) updateLayout();
    }, 400);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(t2);
    };
  }, [dismissed, enabled, getTarget, updateLayout]);

  useLayoutEffect(() => {
    if (!active || !enabled || dismissed !== false) return;
    const on = () => updateLayout();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [active, enabled, dismissed, updateLayout]);

  const close = useCallback(() => {
    void saveOnboardingSpotlightDismissed(storageKey).finally(() => {
      setDismissed(true);
      setActive(false);
    });
  }, [storageKey]);

  useEffect(() => {
    if (!active || !enabled || dismissed !== false) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [active, close, enabled, dismissed]);

  if (typeof document === "undefined" || !enabled || dismissed !== false || !active || !targetRect) {
    return null;
  }

  const w = document.documentElement.clientWidth;
  const h = document.documentElement.clientHeight;

  const content = (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: Z_BASE, background: "transparent" }}
        role="presentation"
        onClick={close}
        aria-hidden
      />
      <svg
        className="pointer-events-none fixed left-0 top-0 h-full w-full"
        style={{ zIndex: Z_DIM }}
        width={w}
        height={h}
        aria-hidden
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect x={0} y={0} width={w} height={h} fill="white" />
            <rect
              x={targetRect.left}
              y={targetRect.top}
              width={targetRect.width}
              height={targetRect.height}
              rx={8}
              ry={8}
              fill="black"
            />
          </mask>
        </defs>
        <rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.55)" mask={`url(#${maskId})`} />
      </svg>
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        className={cn(
          "relative flex flex-col gap-3 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 text-sm text-[var(--color-light)] shadow-2xl",
          className
        )}
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {arrow === "top" && (
          <div
            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full border-8 border-transparent border-b-[var(--color-surface-border)]"
            style={{ marginTop: 1 }}
            aria-hidden
          />
        )}
        {arrow === "top" && (
          <div
            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full border-8 border-transparent border-b-[var(--color-dark)]"
            style={{ marginTop: 2 }}
            aria-hidden
          />
        )}
        <p id={titleId} className="m-0 text-[var(--color-lightest)]">
          {message}
        </p>
        <div className="flex justify-end">
          <Button type="button" size="sm" className="btn-gradient" onClick={close}>
            {t("onboarding.spotlightOk")}
          </Button>
        </div>
        {arrow === "bottom" && (
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-8 border-transparent border-t-[var(--color-surface-border)]"
            style={{ marginBottom: 1 }}
            aria-hidden
          />
        )}
        {arrow === "bottom" && (
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-8 border-transparent border-t-[var(--color-dark)]"
            style={{ marginBottom: 2 }}
            aria-hidden
          />
        )}
      </div>
    </>
  );

  return createPortal(content, document.body);
}
