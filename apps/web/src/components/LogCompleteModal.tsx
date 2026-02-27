import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { ItemImage } from "@/components/ItemImage";
import { useLocale } from "@/contexts/LocaleContext";
import { overlayVariants, modalContentVariants } from "@/lib/animations";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, STATUS_I18N_KEYS } from "@logeverything/shared";

function statusColor(status: string | null | undefined): string {
  if (!status) return "text-[var(--color-light)]";
  if ((COMPLETED_STATUSES as readonly string[]).includes(status)) return "text-emerald-400";
  if ((IN_PROGRESS_STATUSES as readonly string[]).includes(status)) return "text-amber-400";
  return "text-red-400";
}

interface LogCompleteModalProps {
  state: LogCompleteState;
  onClose: () => void;
}

export function LogCompleteModal({ state, onClose }: LogCompleteModalProps) {
  const { t } = useLocale();
  const { image, title, grade, status } = state;
  const stars = grade != null ? gradeToStars(grade) : 0;
  const statusLabel = status ? t(`status.${STATUS_I18N_KEYS[status] ?? status}`) : t("logComplete.logged");

  return (
    <motion.div
      className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center bg-black/70 p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-complete-title"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={overlayVariants}
      onClick={onClose}
    >
      <motion.div
        className="flex h-full w-full min-h-[100dvh] flex-col overflow-hidden rounded-none bg-[var(--color-dark)] md:h-auto md:min-h-0 md:max-h-[90vh] md:w-full md:max-w-[380px] md:overflow-auto md:rounded-xl md:border md:border-[var(--color-dark)] md:shadow-[var(--shadow-modal)]"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "max(env(safe-area-inset-left), 1rem)",
          paddingRight: "max(env(safe-area-inset-right), 1rem)",
        }}
        variants={modalContentVariants}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-shrink-0 items-center justify-end pb-2 pt-1 md:pb-4 md:pt-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 min-h-11 w-11 min-w-11 shrink-0 rounded-full text-[var(--color-light)] hover:bg-[var(--color-mid)]/30 hover:text-[var(--color-lightest)] active:bg-[var(--color-mid)]/40 md:h-9 md:min-h-0 md:w-9 md:min-w-0"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        {/* Mobile: container wraps image (same size); desktop: fixed size */}
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center md:flex-initial md:justify-start md:pb-10 md:pt-0">
          <div className="flex flex-col items-center justify-center md:mb-5">
            <img src="/logo.png" alt="" className="mb-4 h-9 w-auto opacity-90 md:h-10" aria-hidden />
            <ItemImage
              src={image}
              className="max-w-full rounded-xl shadow-lg md:max-w-none md:h-40 md:w-28 md:flex-none"
              imgClassName="object-contain object-center max-h-[50vh] max-w-full md:max-h-full md:h-full md:w-full md:object-cover"
              fitContent
              loading="eager"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-shrink-0 flex-col items-center px-2 pb-6 pt-4 text-center md:px-0 md:pb-0 md:pt-0">
            <p
              className={`mb-2 text-sm font-medium uppercase tracking-wide ${statusColor(status)} md:mb-4`}
              id="log-complete-status"
            >
              {statusLabel}
            </p>
            <h1 id="log-complete-title" className="mb-3 line-clamp-2 text-lg font-bold text-[var(--color-lightest)] md:text-xl">
              {title}
            </h1>
            {grade != null && (
              <div className="flex justify-center">
                <StarRating value={stars} readOnly size="lg" />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
