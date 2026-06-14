import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";

type MarketDeleteListingConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  onDeleted: () => void | Promise<void>;
};

export function MarketDeleteListingConfirmDialog({
  open,
  onOpenChange,
  listingId,
  onDeleted,
}: MarketDeleteListingConfirmDialogProps) {
  const { t } = useLocale();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/market/listings/${encodeURIComponent(listingId)}`, {
        method: "DELETE",
      });
      toast.success(t("market.listingDeleted"));
      onOpenChange(false);
      await onDeleted();
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !deleting && onOpenChange(next)}>
      <DialogContent
        variant="compact"
        className="z-[60] sm:max-w-sm"
        overlayClassName="z-[60]"
        onClose={() => !deleting && onOpenChange(false)}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-[var(--color-lightest)]">
            {t("market.deleteListing")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-light)]">{t("market.deleteListingConfirm")}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t("common.deleting")}
              </>
            ) : (
              t("common.delete")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
