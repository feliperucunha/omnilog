import { useState } from "react";
import { ArrowUpCircle, Loader2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { GooglePlayIcon } from "@/components/GooglePlayIcon";
import { useAppVersion } from "@/contexts/AppVersionContext";
import { useLocale } from "@/contexts/LocaleContext";
import { APP_VERSION } from "@geeklogs/shared";
import { openAppStoreForUpdate } from "@/lib/appStoreLinks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AppVersionModal() {
  const { t } = useLocale();
  const ctx = useAppVersion();
  const showVersionModal = ctx?.showVersionModal ?? false;
  const isNative = ctx?.isNative ?? false;
  const latestVersion = ctx?.latestVersion;
  const dismissUpdatePrompt = ctx?.dismissUpdatePrompt;
  const [isOpening, setIsOpening] = useState(false);

  const handleDismiss = () => {
    dismissUpdatePrompt?.();
  };

  const handleUpdate = async () => {
    if (isOpening) return;
    setIsOpening(true);
    try {
      await openAppStoreForUpdate();
    } catch {
      toast.error(t("appVersion.openStoreFailed"));
    } finally {
      setIsOpening(false);
    }
  };

  if (!isNative) return null;

  return (
    <Drawer
      open={showVersionModal}
      onOpenChange={(open) => {
        if (!open) handleDismiss();
      }}
    >
      <DrawerContent
        onClose={handleDismiss}
        overlayClassName="z-[300] bg-black/60 backdrop-blur-sm"
        mobileHeight="auto"
        className="z-[300] max-w-[26rem] gap-0 overflow-hidden border-[var(--color-surface-border)]/50 bg-[var(--color-dark)] p-0 md:max-w-[26rem]"
      >
        <div className="relative overflow-hidden px-6 pb-1 pt-3">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[var(--btn-gradient-start)]/20 via-[var(--btn-gradient-end)]/8 to-transparent"
            aria-hidden
          />
          <div className="relative flex flex-col items-center text-center">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl",
                "bg-gradient-to-br from-[var(--btn-gradient-start)]/25 to-[var(--btn-gradient-end)]/15",
                "ring-1 ring-[var(--btn-gradient-start)]/30 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
              )}
            >
              <ArrowUpCircle
                className="h-7 w-7 text-[var(--btn-gradient-start)]"
                strokeWidth={1.75}
                aria-hidden
              />
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-[var(--color-lightest)]">
              {t("appVersion.title")}
            </h2>
            <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-[var(--color-light)]">
              {t("appVersion.message")}
            </p>
          </div>
        </div>

        {latestVersion ? (
          <div className="mx-6 mt-4 rounded-2xl bg-[var(--color-darkest)]/80 p-4 ring-1 ring-[var(--color-surface-border)]/80">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-mid)]">
                  {t("appVersion.currentShort")}
                </p>
                <p className="mt-0.5 text-base font-semibold tabular-nums text-[var(--color-light)]">
                  v{APP_VERSION}
                </p>
              </div>
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-mid)]/20 text-[var(--color-light)]"
                aria-hidden
              >
                →
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--btn-gradient-start)]">
                  {t("appVersion.latestShort")}
                </p>
                <p className="mt-0.5 text-base font-semibold tabular-nums text-[var(--color-lightest)]">
                  v{latestVersion}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[var(--color-light)]">
              <GooglePlayIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span>{t("appVersion.playStoreBadge")}</span>
            </div>
          </div>
        ) : (
          <div className="mx-6 mt-4 flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--color-darkest)]/60 px-4 py-3 text-xs text-[var(--color-light)] ring-1 ring-[var(--color-surface-border)]/60">
            <GooglePlayIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{t("appVersion.playStoreBadge")}</span>
          </div>
        )}

        <DrawerFooter className="mt-2 flex-col gap-2.5 border-0 bg-transparent px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
          <Button
            type="button"
            className="btn-gradient h-12 w-full rounded-xl text-base font-semibold shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
            disabled={isOpening}
            onClick={() => void handleUpdate()}
          >
            {isOpening ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("appVersion.openingStore")}
              </>
            ) : (
              <>
                <GooglePlayIcon className="h-4 w-4" />
                {t("appVersion.updateButton")}
              </>
            )}
          </Button>
          <button
            type="button"
            className="w-full py-2.5 text-sm font-medium text-[var(--color-light)] transition-colors hover:text-[var(--color-lightest)] disabled:opacity-50"
            disabled={isOpening}
            onClick={handleDismiss}
          >
            {t("appVersion.notNow")}
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
