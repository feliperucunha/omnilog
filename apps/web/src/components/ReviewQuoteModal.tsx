import { Quote } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/contexts/LocaleContext";

type ReviewQuoteModalProps = {
  open: boolean;
  review: string | null;
  title?: string | null;
  onClose: () => void;
};

export function ReviewQuoteModal({ open, review, title, onClose }: ReviewQuoteModalProps) {
  const { t } = useLocale();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        variant="compact"
        onClose={onClose}
        overlayClassName="bg-black/45 backdrop-blur-md"
        className="max-w-2xl overflow-y-auto border-0 bg-transparent p-0 shadow-none"
      >
        <DialogTitle className="sr-only">{t("social.viewReview")}</DialogTitle>
        <div className="relative rounded-[1.75rem] border border-white/10 bg-[var(--color-dark)]/85 p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
          <div className="mb-4 flex min-w-0 items-center gap-3 pr-10">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--btn-gradient-start)]/30 bg-[var(--btn-gradient-start)]/10 text-[var(--btn-gradient-start)]"
            >
              <Quote className="size-5 fill-current" />
            </span>
            {title ? (
              <p className="line-clamp-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-light)]">
                {title}
              </p>
            ) : null}
          </div>
          <blockquote className="max-h-[60dvh] overflow-y-auto rounded-2xl border-l-2 border-[var(--btn-gradient-start)]/60 bg-[var(--color-darkest)]/55 px-4 py-4 sm:px-6 sm:py-5">
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-[var(--color-lightest)] sm:text-lg">
              {review}
            </p>
          </blockquote>
        </div>
      </DialogContent>
    </Dialog>
  );
}
