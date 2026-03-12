import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppVersion } from "@/contexts/AppVersionContext";
import { useLocale } from "@/contexts/LocaleContext";

/**
 * Unclosable modal shown on mobile when the app version is behind the API.
 * Prevents Android/iOS users from using an outdated app. API also returns 401
 * for version mismatch so bypassing the modal still blocks requests.
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
          <DialogTitle className="text-[var(--color-lightest)]">
            {t("appVersion.title")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-light)]">
          {t("appVersion.message")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
