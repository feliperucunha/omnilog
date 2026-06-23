import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { Log, MediaType, ScopedReview } from "@geeklogs/shared";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { apiFetch, invalidateLogsAndItemsCache } from "@/lib/api";
import { decodeLogForDisplay } from "@/lib/decodeDisplayFields";
import {
  deletePartialScopedReview,
  listEpisodePartialReviews,
  partialReviewLabel,
} from "@/lib/partialTvReview";
import { cn } from "@/lib/utils";

type SavedTvReviewsSectionProps = {
  log: Log;
  scopedReviews: ScopedReview[];
  mediaType: MediaType;
  showSeasonField: boolean;
  disabled?: boolean;
  t: (key: string, vars?: Record<string, string>) => string;
  onLogUpdated: (log: Log) => void;
  onScopedReviewsChange: (reviews: ScopedReview[]) => void;
};

export function SavedTvReviewsSection({
  log,
  scopedReviews,
  mediaType,
  showSeasonField,
  disabled = false,
  t,
  onLogUpdated,
  onScopedReviewsChange,
}: SavedTvReviewsSectionProps) {
  const [open, setOpen] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const partials = listEpisodePartialReviews(scopedReviews);
  const hasShowReview = log.grade != null || (log.review != null && log.review.trim() !== "");
  const totalCount = partials.length + (hasShowReview ? 1 : 0);

  if (totalCount === 0) return null;

  const refreshScopedReviews = async () => {
    const res = await apiFetch<{ data: ScopedReview[] }>(`/logs/${log.id}/scoped-reviews`);
    onScopedReviewsChange(res.data ?? []);
  };

  const handleDeleteShowReview = async () => {
    setDeletingKey("show");
    try {
      const updated = await apiFetch<Log>(`/logs/${log.id}`, {
        method: "PATCH",
        body: JSON.stringify({ grade: null, review: null }),
      });
      onLogUpdated(decodeLogForDisplay(updated));
      invalidateLogsAndItemsCache();
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeletePartial = async (review: ScopedReview) => {
    const season = review.season ?? 0;
    const episode = review.episode ?? 0;
    const key = `ep:${season}:${episode}`;
    setDeletingKey(key);
    try {
      await deletePartialScopedReview(log.id, { season, episode });
      await refreshScopedReviews();
      invalidateLogsAndItemsCache();
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-[var(--color-lightest)]"
        aria-expanded={open}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="truncate">{t("itemReviewForm.savedReviews")}</span>
          <span className="rounded-md bg-[var(--color-mid)]/30 px-1.5 py-0.5 text-xs font-normal text-[var(--color-light)]">
            {totalCount}
          </span>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-mid)]/20 px-3 py-3">
          {hasShowReview && (
            <SavedReviewRow
              label={t("itemReviewForm.savedReviewShow")}
              grade={log.grade}
              review={log.review}
              deleting={deletingKey === "show"}
              disabled={disabled || deletingKey != null}
              deleteLabel={t("common.delete")}
              onDelete={() => void handleDeleteShowReview()}
            />
          )}
          {partials.map((partial) => {
            const key = `ep:${partial.season ?? 0}:${partial.episode ?? 0}`;
            return (
              <SavedReviewRow
                key={partial.id}
                label={partialReviewLabel(t, mediaType, showSeasonField, partial)}
                grade={partial.grade}
                review={partial.review}
                deleting={deletingKey === key}
                disabled={disabled || deletingKey != null}
                deleteLabel={t("common.delete")}
                onDelete={() => void handleDeletePartial(partial)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SavedReviewRow({
  label,
  grade,
  review,
  deleting,
  disabled,
  deleteLabel,
  onDelete,
}: {
  label: string;
  grade: number | null;
  review: string | null;
  deleting: boolean;
  disabled: boolean;
  deleteLabel: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2 rounded-md border border-[var(--color-surface-border)]/60 bg-[var(--color-dark)]/60 p-3">
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs font-medium text-[var(--color-light)]">{label}</p>
        {grade != null && (
          <StarRating value={gradeToStars(grade)} readOnly size="sm" />
        )}
        {review && (
          <p className="line-clamp-3 whitespace-pre-wrap text-sm text-[var(--color-lightest)]">
            {review}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 shrink-0 self-start px-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-400"
        )}
        disabled={disabled}
        onClick={onDelete}
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : deleteLabel}
      </Button>
    </div>
  );
}
