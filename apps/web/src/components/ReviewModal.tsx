import { Link } from "react-router-dom";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ItemImage } from "@/components/ItemImage";
import { useLocale } from "@/contexts/LocaleContext";
import type { Log } from "@dogument/shared";

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  log: Log;
  /** When provided (e.g. on feed), show "by {username}" with link to profile. */
  user?: { id: string; username: string | null };
}

export function ReviewModal({ open, onClose, log, user }: ReviewModalProps) {
  const { t } = useLocale();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent onClose={onClose} className="max-h-[85vh] flex flex-col max-w-md">
        <DialogHeader className="relative">
          <DialogTitle className="text-[var(--color-lightest)] sr-only">
            {t("social.viewFullReview")}
          </DialogTitle>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-8 w-8 text-[var(--color-light)] hover:bg-[var(--color-mid)]/30 hover:text-[var(--color-lightest)]"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4 overflow-y-auto">
          <Link
            to={`/item/${log.mediaType}/${log.externalId}`}
            className="flex min-w-0 gap-3 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-darkest)]/50 p-3 text-inherit no-underline transition-colors hover:bg-[var(--color-mid)]/15"
            onClick={onClose}
          >
            <ItemImage
              src={log.image}
              className="h-14 w-10 shrink-0 rounded"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="line-clamp-2 font-medium text-[var(--color-lightest)]">
                {log.title}
              </span>
              <span className="text-xs text-[var(--color-light)]">
                {t(`nav.${log.mediaType}`)}
              </span>
            </div>
          </Link>
          {user?.username != null && (
            <p className="text-sm text-[var(--color-light)]">
              <Link
                to={`/${user.username}`}
                className="text-[var(--color-lightest)] underline hover:no-underline"
                onClick={onClose}
              >
                {t("social.reviewBy", { name: user.username })}
              </Link>
            </p>
          )}
          {log.mediaType === "boardgames" && (log.own != null || (log.matchesPlayed != null && log.matchesPlayed > 0)) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-light)]">
              {log.own != null && (
                <span>{t("itemReviewForm.own")}: {log.own ? t("common.yes") : t("common.no")}</span>
              )}
              {log.matchesPlayed != null && log.matchesPlayed > 0 && (
                <span>{t("itemReviewForm.matchesPlayed")}: {log.matchesPlayed}</span>
              )}
            </div>
          )}
          <div className="min-w-0">
            <p className="whitespace-pre-wrap text-sm text-[var(--color-light)]">
              {log.review ?? ""}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
