import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { ItemImage } from "@/components/ItemImage";
import { useLocale } from "@/contexts/LocaleContext";
import { Logo } from "@/components/Logo";
import { getHeroImageUrl } from "@/lib/getHeroImageUrl";
import { overlayVariants, modalContentVariants } from "@/lib/animations";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES } from "@dogument/shared";
import { getStatusLabel } from "@/lib/statusLabel";

function statusColor(status: string | null | undefined): string {
  if (!status) return "bg-[var(--color-mid)]/40 text-[var(--color-light)]";
  if ((COMPLETED_STATUSES as readonly string[]).includes(status))
    return "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30";
  if ((IN_PROGRESS_STATUSES as readonly string[]).includes(status))
    return "bg-amber-500/20 text-amber-400 border border-amber-400/30";
  return "bg-red-500/20 text-red-400 border border-red-400/30";
}

interface LogCompleteModalProps {
  state: LogCompleteState;
  onClose: () => void;
}

export function LogCompleteModal({ state, onClose }: LogCompleteModalProps) {
  const { t } = useLocale();
  const { image, title, grade, status, review, own, matchesPlayed, mediaType } = state;
  const showBoardGameMeta = mediaType === "boardgames";
  const stars = grade != null ? gradeToStars(grade) : 0;
  const statusLabel = status ? getStatusLabel(t, status, state.mediaType) : t("logComplete.logged");
  const heroImageUrl = getHeroImageUrl(image) ?? image;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex min-h-[100dvh] min-h-dvh-fallback items-center justify-center bg-black/90 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:bg-transparent md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-complete-title"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={overlayVariants}
      onClick={onClose}
    >
      {/* Full-bleed blurred background: same image; on mobile stronger blur + dark scrim so app UI is hidden */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: heroImageUrl ? `url(${heroImageUrl})` : undefined,
          backgroundSize: "cover",
          filter: "blur(10px)",
          WebkitFilter: "blur(10px)",
          transform: "scale(1.25)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-black/70 md:bg-black/55"
        aria-hidden
      />

      {/* Rounded container: horizontal and vertical margin from wrapper; on mobile content is taller */}
      <motion.article
        className="relative flex max-h-full w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--color-dark)] shadow-[0_24px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] md:rounded-3xl"
        variants={modalContentVariants}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close: top-right inside card — strong contrast on any background */}
        <div className="absolute right-2 top-2 z-10 md:right-4 md:top-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-black/75 text-white shadow-lg ring-1 ring-white/20 hover:bg-black/90 hover:text-white hover:ring-white/30 md:h-10 md:w-10"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Hero image: on mobile taller with fixed height; desktop keeps aspect */}
        <div className="relative flex-shrink-0 overflow-hidden rounded-t-2xl md:rounded-t-3xl">
          <div className="relative h-[40vh] w-full min-h-[160px] md:h-auto md:min-h-0 md:aspect-[2/3]">
            <ItemImage
              src={heroImageUrl}
              className="absolute inset-0 h-full w-full"
              imgClassName="object-cover object-center"
              fitContent={false}
              loading="eager"
              referrerPolicy="no-referrer"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, var(--color-dark) 0%, transparent 40%, transparent 100%)",
              }}
            />
          </div>
        </div>

        {/* Content: scrollable on mobile so everything fits */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-5">
          <span
            className={`mb-2 inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider md:mb-3 md:px-3 md:py-1 md:text-xs ${statusColor(status)}`}
            id="log-complete-status"
          >
            {statusLabel}
          </span>
          <h1
            id="log-complete-title"
            className="mb-2 line-clamp-2 text-lg font-bold leading-tight text-[var(--color-lightest)] md:mb-4 md:line-clamp-3 md:text-[1.75rem]"
          >
            {title}
          </h1>
          {grade != null && (
            <div className="mb-2 flex items-center gap-1 md:mb-3">
              <StarRating value={stars} readOnly size="lg" />
            </div>
          )}
          {showBoardGameMeta && (own != null || (matchesPlayed != null && matchesPlayed > 0)) && (
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-light)] md:mb-3">
              {own != null && (
                <span>{t("itemReviewForm.own")}: {own ? t("common.yes") : t("common.no")}</span>
              )}
              {matchesPlayed != null && matchesPlayed > 0 && (
                <span>{t("itemReviewForm.matchesPlayed")}: {matchesPlayed}</span>
              )}
            </div>
          )}
          {review != null && review.trim() !== "" && (
            <p className="mb-3 line-clamp-3 text-[11px] leading-snug text-[var(--color-light)] whitespace-pre-wrap md:mb-4 md:line-clamp-4 md:text-[0.8125rem] md:leading-relaxed">
              {review.trim()}
            </p>
          )}

          <div className="mt-auto flex shrink-0 items-center gap-1.5 pt-3 border-t border-[var(--color-mid)]/30 md:gap-2 md:pt-4">
            <Logo alt="" className="h-7 w-auto shrink-0 opacity-90 md:h-8" aria-hidden />
            <span className="text-xs font-medium text-[var(--color-light)] md:text-sm">
              {t("logComplete.loggedWith", { app: t("app.name") })}
            </span>
          </div>
        </div>
      </motion.article>
    </motion.div>
  );
}
