import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppVersion } from "@/contexts/AppVersionContext";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useLocale } from "@/contexts/LocaleContext";
import { APP_VERSION } from "@geeklogs/shared";
import { openAppStoreForUpdate } from "@/lib/appStoreLinks";
import { registerAndroidOverlayClose } from "@/lib/androidOverlayBack";

export function AppVersionModal() {
  const { t } = useLocale();
  const ctx = useAppVersion();
  const showVersionModal = ctx?.showVersionModal ?? false;
  const isNative = ctx?.isNative ?? false;
  const requiredVersion = ctx?.requiredVersion;

  useEffect(() => {
    if (!showVersionModal) return;
    return registerAndroidOverlayClose(() => {});
  }, [showVersionModal]);

  if (!isNative || !showVersionModal) return null;

  const handleUpdate = () => {
    void openAppStoreForUpdate();
  };

  return (
    <Dialog open>
      <DialogContent
        closeOnInteractOutside={false}
        overlayClassName="z-[300]"
        className="z-[300] sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="min-w-0 text-[var(--color-lightest)]">
            <OverflowMarquee>{t("appVersion.title")}</OverflowMarquee>
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-light)]">{t("appVersion.message")}</p>
        {requiredVersion ? (
          <p className="text-xs text-[var(--color-mid)]">
            {t("appVersion.versionHint", {
              current: APP_VERSION,
              required: requiredVersion,
            })}
          </p>
        ) : null}
        <DialogFooter className="mt-2 border-0 pt-0">
          <Button type="button" className="w-full" onClick={handleUpdate}>
            {t("appVersion.updateButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
