import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { useAppVersion } from "@/contexts/AppVersionContext";
import { useLocale } from "@/contexts/LocaleContext";
import { openAppStoreForUpdate } from "@/lib/appStoreLinks";
import { toast } from "sonner";

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
        overlayClassName="z-[300]"
        mobileHeight="auto"
        className="z-[300] flex flex-col gap-0 px-5 pb-0 pt-0 max-md:px-5 md:max-w-md"
      >
        <div className="flex min-w-0 gap-4 px-1 pb-1 pt-1">
          <img
            src="/logo.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-[1.125rem] object-cover shadow-sm"
          />
          <div className="min-w-0 flex-1 pb-4 pt-0.5">
            <p className="text-[15px] font-medium leading-tight text-[var(--color-lightest)]">
              {t("appVersion.appName")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--color-lightest)]">
              {t("appVersion.title")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-light)]">
              {t("appVersion.message")}
            </p>
            {latestVersion ? (
              <p className="mt-2 text-xs text-[var(--color-mid)]">
                {t("appVersion.versionAvailable", { version: latestVersion })}
              </p>
            ) : null}
          </div>
        </div>

        <DrawerFooter className="flex-col items-stretch gap-0 border-t border-[var(--color-surface-border)] px-1 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            disabled={isOpening}
            onClick={() => void handleUpdate()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#01875f] text-[15px] font-medium text-white transition-colors hover:bg-[#016b4a] active:bg-[#015a40] disabled:opacity-60"
          >
            {isOpening ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                {t("appVersion.openingStore")}
              </>
            ) : (
              t("appVersion.updateButton")
            )}
          </button>
          <button
            type="button"
            className="mt-3 w-full py-3 text-center text-sm font-medium text-[var(--color-light)] transition-colors hover:text-[var(--color-lightest)] disabled:opacity-50"
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
