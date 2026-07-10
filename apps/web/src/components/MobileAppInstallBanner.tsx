import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Share, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GooglePlayIcon } from "@/components/GooglePlayIcon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/contexts/LocaleContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { isCapacitorNative } from "@/lib/androidOverlayBack";
import { openAppStoreForUpdate } from "@/lib/appStoreLinks";
import { detectMobileWebPlatform, isStandaloneWebApp } from "@/lib/mobileWebPlatform";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "geeklogs-mobile-app-install-banner-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

type MobileAppInstallBannerProps = {
  variant?: "overlay" | "inline";
};

export function MobileAppInstallBanner({ variant = "overlay" }: MobileAppInstallBannerProps) {
  const { t } = useLocale();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const inline = variant === "inline";
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<ReturnType<typeof detectMobileWebPlatform>>(null);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const [openingStore, setOpeningStore] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isCapacitorNative()) {
      setVisible(false);
      setPlatform(null);
      return;
    }
    if (!inline && pathname === "/") {
      setVisible(false);
      setPlatform(null);
      return;
    }
    if (!isMobile) {
      setVisible(false);
      setPlatform(null);
      return;
    }
    if (isStandaloneWebApp()) {
      setVisible(false);
      setPlatform(null);
      return;
    }
    if (readDismissed()) {
      setVisible(false);
      setPlatform(null);
      return;
    }
    const detected = detectMobileWebPlatform();
    if (!detected) {
      setVisible(false);
      setPlatform(null);
      return;
    }
    setPlatform(detected);
    setVisible(true);
  }, [inline, isMobile, pathname]);

  const dismiss = useCallback(() => {
    writeDismissed();
    setVisible(false);
    setIosHelpOpen(false);
  }, []);

  const handleAndroidAction = useCallback(async () => {
    if (openingStore) return;
    setOpeningStore(true);
    try {
      await openAppStoreForUpdate();
    } finally {
      setOpeningStore(false);
    }
  }, [openingStore]);

  const handleIosAction = useCallback(() => {
    setIosHelpOpen(true);
  }, []);

  if (!platform) return null;

  const body = (
    <div className="mx-auto flex max-w-lg items-start gap-3">
      <img
        src="/logo.png"
        alt=""
        width={40}
        height={40}
        className="mt-0.5 h-10 w-10 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-lightest)]">
          {platform === "android"
            ? t("mobileAppBanner.androidTitle")
            : t("mobileAppBanner.iosTitle")}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-light)]">
          {platform === "android"
            ? t("mobileAppBanner.androidMessage")
            : t("mobileAppBanner.iosMessage")}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {platform === "android" ? (
            <Button
              type="button"
              size="sm"
              className="h-9 gap-2 rounded-full bg-[#01875f] px-4 text-xs font-medium text-white hover:bg-[#016b4a]"
              disabled={openingStore}
              onClick={() => void handleAndroidAction()}
            >
              {!openingStore && <GooglePlayIcon className="h-4 w-4" />}
              {openingStore
                ? t("mobileAppBanner.openingStore")
                : t("mobileAppBanner.androidAction")}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-9 rounded-full px-4 text-xs"
              onClick={handleIosAction}
            >
              {t("mobileAppBanner.iosAction")}
            </Button>
          )}
        </div>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-full p-1.5 text-[var(--color-light)] transition-colors hover:bg-[var(--color-mid)]/30 hover:text-[var(--color-lightest)]"
        onClick={dismiss}
        aria-label={t("common.close")}
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            role={inline ? "region" : "dialog"}
            aria-label={t("mobileAppBanner.ariaLabel")}
            initial={{ y: "-100%", opacity: 0.85 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0.85 }}
            transition={{ type: "spring", damping: 30, stiffness: 340 }}
            className={cn(
              "border-b border-[var(--color-surface-border)] bg-[var(--color-dark)]/95 px-3 backdrop-blur-md",
              inline
                ? "overflow-hidden py-3 md:hidden"
                : "fixed inset-x-0 top-0 z-[56] pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-lg"
            )}
          >
            {body}
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={iosHelpOpen} onOpenChange={setIosHelpOpen}>
        <DialogContent variant="compact" className="max-w-sm border-[var(--color-surface-border)] bg-[var(--color-dark)]">
          <DialogHeader>
            <DialogTitle>{t("mobileAppBanner.iosHelpTitle")}</DialogTitle>
          </DialogHeader>
          <ol className="m-0 list-none space-y-4 p-0 text-sm text-[var(--color-light)]">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-mid)]/30 text-xs font-semibold text-[var(--color-lightest)]">
                1
              </span>
              <span className="pt-0.5 leading-relaxed">
                {t("mobileAppBanner.iosHelpStep1")}
                <Share className="mx-1 inline h-4 w-4 align-text-bottom text-[var(--color-lightest)]" aria-hidden />
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-mid)]/30 text-xs font-semibold text-[var(--color-lightest)]">
                2
              </span>
              <span className="pt-0.5 leading-relaxed">{t("mobileAppBanner.iosHelpStep2")}</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-mid)]/30 text-xs font-semibold text-[var(--color-lightest)]">
                3
              </span>
              <span className="pt-0.5 leading-relaxed">{t("mobileAppBanner.iosHelpStep3")}</span>
            </li>
          </ol>
          <Button type="button" className="mt-2 w-full" onClick={() => setIosHelpOpen(false)}>
            {t("mobileAppBanner.iosHelpDone")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
