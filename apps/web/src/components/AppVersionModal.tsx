import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GooglePlayIcon } from "@/components/GooglePlayIcon";
import { GooglePlayUpdateButton } from "@/components/GooglePlayUpdateButton";
import { Logo } from "@/components/Logo";
import { useAppVersion } from "@/contexts/AppVersionContext";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useLocale } from "@/contexts/LocaleContext";
import { APP_VERSION } from "@geeklogs/shared";
import { openAppStoreForUpdate } from "@/lib/appStoreLinks";
import { registerAndroidOverlayClose } from "@/lib/androidOverlayBack";
import { toast } from "sonner";
import { paperShadow } from "@/lib/paperShadow";
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
  const isNative = ctx?.isNative ?? false;
  const requiredVersion = ctx?.requiredVersion;
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    if (!showVersionModal) return;
    return registerAndroidOverlayClose(() => {});
  }, [showVersionModal]);

  if (!isNative || !showVersionModal) return null;

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

  return (
    <Dialog open>
      <DialogContent
        closeOnInteractOutside={false}
        overlayClassName="z-[300] bg-black/85 backdrop-blur-md"
        className={cn(
          "z-[300] gap-0 overflow-hidden border-[var(--color-surface-border)] p-0 sm:max-w-[24rem]",
          "sm:rounded-2xl"
        )}
        style={paperShadow}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="relative overflow-hidden border-b border-[var(--color-surface-border)]/60 px-6 pb-8 pt-10">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#00F076]/12 via-[#4285F4]/6 to-transparent" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#FFBA00]/10 blur-2xl" />
          <div className="pointer-events-none absolute -left-12 top-8 h-32 w-32 rounded-full bg-[#00D6FF]/10 blur-2xl" />

          <div className="relative mx-auto flex w-fit flex-col items-center">
            <div className="relative">
              <div className="flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-[1.35rem] bg-[var(--color-darkest)] shadow-[0_12px_32px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
                <Logo className="h-[3.25rem] w-[3.25rem] object-contain" alt="" />
              </div>
              <div
                className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#0d0d0d] shadow-lg ring-2 ring-[var(--color-dark)]"
                title="Google Play"
              >
                <GooglePlayIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-full bg-[var(--color-darkest)]/80 px-3 py-1.5 ring-1 ring-[var(--color-surface-border)] backdrop-blur-sm">
              <GooglePlayIcon className="h-4 w-4" />
              <span className="text-xs font-medium text-[var(--color-lightest)]">
                {t("appVersion.playStoreBadge")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col px-6 pb-2 pt-6 text-center">
          <DialogHeader className="w-full space-y-2">
            <DialogTitle className="min-w-0 text-[1.35rem] font-semibold leading-tight text-[var(--color-lightest)]">
              <OverflowMarquee>{t("appVersion.title")}</OverflowMarquee>
            </DialogTitle>
          </DialogHeader>

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

        <DialogFooter className="border-t border-[var(--color-surface-border)]/80 px-6 py-5">
          <GooglePlayUpdateButton
            topLabel={t("appVersion.updateOn")}
            storeLabel={t("appVersion.googlePlay")}
            loadingLabel={t("appVersion.openingStore")}
            isLoading={isOpening}
            onClick={() => void handleUpdate()}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
