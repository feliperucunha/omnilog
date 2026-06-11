import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "@/contexts/LocaleContext";
import { isCapacitorNative } from "@/lib/androidOverlayBack";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "geeklogs-cookie-notice-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function CookieConsentBanner() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isCapacitorNative()) return;
    setVisible(!readDismissed());
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[55] flex justify-center px-2.5 max-md:bottom-[max(5.5rem,calc(5rem+env(safe-area-inset-bottom,0px)))] md:bottom-8 md:px-6"
      role="dialog"
      aria-label={t("cookies.ariaLabel")}
    >
      <div
        className="pointer-events-auto flex max-w-md flex-col gap-3 rounded-2xl border border-[var(--color-mid)]/25 bg-[var(--color-dark)]/90 px-4 py-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:gap-4"
      >
        <p className="text-xs leading-relaxed text-[var(--color-light)] sm:flex-1">
          {t("cookies.banner")}{" "}
          <Link
            to="/privacy"
            className="font-medium text-[var(--color-lightest)] underline decoration-[var(--color-mid)] underline-offset-2 transition-colors hover:decoration-[var(--color-light)]"
          >
            {t("cookies.learnMore")}
          </Link>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-[var(--color-mid)]/40 text-xs"
          onClick={dismiss}
        >
          {t("cookies.accept")}
        </Button>
      </div>
    </div>
  );
}
