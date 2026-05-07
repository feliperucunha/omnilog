import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppVersion } from "@/contexts/AppVersionContext";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useLocale } from "@/contexts/LocaleContext";

/**
 * Native-only modal when the bundled APP_VERSION is older than the API’s release.
 * Admin feature flag “Ignore native app version gate” disables both this UI and API enforcement.
 */
export function AppVersionModal() {
  const { t } = useLocale();
  const { showVersionModal, isMobile } = useAppVersion() ?? {
    showVersionModal: false,
    isMobile: false,
  };

  if (!isMobile || !showVersionModal) return null;

  return (
    <Dialog open>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onClose={undefined}
        className="max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="min-w-0 text-[var(--color-lightest)]">
            <OverflowMarquee>{t("appVersion.title")}</OverflowMarquee>
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-light)]">
          {t("appVersion.message")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
