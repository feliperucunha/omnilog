import { useCallback, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { GooglePlayIcon } from "@/components/GooglePlayIcon";
import { useAppVersion } from "@/contexts/AppVersionContext";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useLocale } from "@/contexts/LocaleContext";
import { APP_VERSION } from "@geeklogs/shared";
import { openAppStoreForUpdate } from "@/lib/appStoreLinks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function VersionCard({
  label,
  version,
  variant,
}: {
  label: string;
  version: string;
  variant: "current" | "required";
}) {
  const isRequired = variant === "required";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1 rounded-xl px-3 py-2.5 text-left",
        isRequired
          ? "bg-[var(--btn-gradient-start)]/12 ring-1 ring-[var(--btn-gradient-start)]/35"
          : "bg-[var(--color-darkest)]/90 ring-1 ring-[var(--color-surface-border)]"
      )}
    >
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.12em]",
          isRequired ? "text-[var(--btn-gradient-start)]" : "text-[var(--color-mid)]"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "truncate text-base font-semibold tabular-nums tracking-tight",
          isRequired ? "text-[var(--color-lightest)]" : "text-[var(--color-light)]"
        )}
      >
        v{version}
      </span>
    </div>
  );
}

export function AppVersionModal() {
  const { t } = useLocale();
  const ctx = useAppVersion();
  const showVersionModal = ctx?.showVersionModal ?? false;
  const setShowVersionModal = ctx?.setShowVersionModal;
  const isNative = ctx?.isNative ?? false;
  const requiredVersion = ctx?.requiredVersion;
  const [isOpening, setIsOpening] = useState(false);

  const handleClose = useCallback(() => {
    setShowVersionModal?.(false);
  }, [setShowVersionModal]);

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
        if (!open) handleClose();
      }}
    >
      <DrawerContent
        onClose={handleClose}
        overlayClassName="z-[300] bg-black/85 backdrop-blur-md"
        mobileHeight="auto"
        className="z-[300] flex max-w-[24rem] flex-col gap-0 overflow-hidden p-0 md:max-w-[24rem]"
      >
        <div className="border-b border-[var(--color-surface-border)]/60 px-6 pb-6 pt-4 md:pt-6">
          <div className="mx-auto flex w-fit flex-col items-center">
            <img
              src="/logo.png"
              alt=""
              className="h-16 w-16 object-contain"
              width={64}
              height={64}
            />
            <div className="mt-4 flex items-center gap-2 text-[var(--color-light)]">
              <GooglePlayIcon className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium">{t("appVersion.playStoreBadge")}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col px-6 pb-2 pt-6 text-center">
          <DialogTitle className="min-w-0 text-[1.35rem] font-semibold leading-tight text-[var(--color-lightest)]">
            <OverflowMarquee>{t("appVersion.title")}</OverflowMarquee>
          </DialogTitle>

          <p className="mt-3 text-sm leading-relaxed text-[var(--color-light)]">
            {t("appVersion.message")}
          </p>

          {requiredVersion ? (
            <div className="mt-5 flex items-stretch gap-2">
              <VersionCard
                label={t("appVersion.currentShort")}
                version={APP_VERSION}
                variant="current"
              />
              <div
                className="flex shrink-0 items-center justify-center text-[var(--color-mid)]"
                aria-hidden
              >
                <ArrowRight className="h-4 w-4" />
              </div>
              <VersionCard
                label={t("appVersion.requiredShort")}
                version={requiredVersion}
                variant="required"
              />
            </div>
          ) : null}
        </div>

        <DrawerFooter className="flex-col gap-2 border-t border-[var(--color-surface-border)]/80 px-6 py-5">
          <Button
            type="button"
            className="btn-gradient w-full"
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
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isOpening}
            onClick={handleClose}
          >
            {t("common.close")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
