import { useEffect } from "react";
import type { MediaType, ScopedReview } from "@geeklogs/shared";
import type { ReviewScope } from "@geeklogs/shared";
import { Label } from "@/components/ui/label";
import { NumberCombobox } from "@/components/ui/number-combobox";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/StarRating";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";
import { apiFetch } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";

type ProgressOptions = {
  seasons?: number[];
  episodesBySeason?: Record<string, number[]>;
  episodes?: number[];
};

export type TvReviewTabDraft = {
  stars: number | null;
  review: string;
  season: number | "";
  episode: number | "";
};

export const emptyTvReviewDraft = (): TvReviewTabDraft => ({
  stars: null,
  review: "",
  season: "",
  episode: "",
});

function draftFromScoped(row: ScopedReview | undefined): TvReviewTabDraft {
  if (!row) return emptyTvReviewDraft();
  return {
    stars: row.grade != null ? gradeToStars(row.grade) : null,
    review: row.review ?? "",
    season: row.season ?? "",
    episode: row.episode ?? "",
  };
}

export function TvGranularReviewSection({
  mediaType,
  progressOptions,
  progressOptionsLoading,
  showSeasonField,
  scopedReviews,
  activeTab,
  seasonDraft,
  onSeasonDraftChange,
  episodeDraft,
  onEpisodeDraftChange,
}: {
  mediaType: MediaType;
  progressOptions: ProgressOptions | null;
  progressOptionsLoading: boolean;
  showSeasonField: boolean;
  scopedReviews: ScopedReview[];
  activeTab: ReviewScope;
  seasonDraft: TvReviewTabDraft;
  onSeasonDraftChange: (d: TvReviewTabDraft) => void;
  episodeDraft: TvReviewTabDraft;
  onEpisodeDraftChange: (d: TvReviewTabDraft) => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    const seasonRows = scopedReviews.filter((r) => r.scope === "season");
    const latestSeason =
      seasonRows.length > 0
        ? [...seasonRows].sort((a, b) => (b.season ?? 0) - (a.season ?? 0))[0]
        : undefined;
    const episodeRows = scopedReviews.filter((r) => r.scope === "episode");
    const latestEpisode =
      episodeRows.length > 0
        ? [...episodeRows].sort((a, b) => {
            const ds = (b.season ?? 0) - (a.season ?? 0);
            if (ds !== 0) return ds;
            return (b.episode ?? 0) - (a.episode ?? 0);
          })[0]
        : undefined;
    onSeasonDraftChange(draftFromScoped(latestSeason));
    if (latestEpisode) {
      onEpisodeDraftChange({
        ...draftFromScoped(latestEpisode),
        season: latestEpisode.season ?? "",
        episode: latestEpisode.episode ?? "",
      });
    }
  }, [scopedReviews, onSeasonDraftChange, onEpisodeDraftChange]);

  if (activeTab === "show") return null;

  return (
    <div className="flex flex-col gap-4">
      {activeTab === "season" && (
        <>
          <div className="space-y-2">
            <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.season")}</Label>
            <NumberCombobox
              value={seasonDraft.season}
              onChange={(next) => onSeasonDraftChange({ ...seasonDraft, season: next })}
              options={progressOptions?.seasons ?? []}
              placeholder="—"
              aria-label={t("itemReviewForm.season")}
              optionsLoading={progressOptionsLoading}
            />
          </div>
          <RatingReviewFields
            stars={seasonDraft.stars}
            review={seasonDraft.review}
            onStars={(s) => onSeasonDraftChange({ ...seasonDraft, stars: s })}
            onReview={(v) => onSeasonDraftChange({ ...seasonDraft, review: v })}
            t={t}
          />
        </>
      )}

      {activeTab === "episode" && (
        <>
          <div className={showSeasonField ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
            {showSeasonField && (
              <div className="space-y-2">
                <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.season")}</Label>
                <NumberCombobox
                  value={episodeDraft.season}
                  onChange={(next) => onEpisodeDraftChange({ ...episodeDraft, season: next })}
                  options={progressOptions?.seasons ?? []}
                  placeholder="—"
                  aria-label={t("itemReviewForm.season")}
                  optionsLoading={progressOptionsLoading}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.episode")}</Label>
              <NumberCombobox
                value={episodeDraft.episode}
                onChange={(next) => onEpisodeDraftChange({ ...episodeDraft, episode: next })}
                options={
                  mediaType === "tv" && episodeDraft.season !== ""
                    ? (progressOptions?.episodesBySeason?.[String(episodeDraft.season)] ?? [])
                    : (progressOptions?.episodes ?? [])
                }
                placeholder="—"
                aria-label={t("itemReviewForm.episode")}
                optionsLoading={progressOptionsLoading}
                contentScrollable
              />
            </div>
          </div>
          <RatingReviewFields
            stars={episodeDraft.stars}
            review={episodeDraft.review}
            onStars={(s) => onEpisodeDraftChange({ ...episodeDraft, stars: s })}
            onReview={(v) => onEpisodeDraftChange({ ...episodeDraft, review: v })}
            t={t}
          />
        </>
      )}
    </div>
  );
}

function RatingReviewFields({
  stars,
  review,
  onStars,
  onReview,
  t,
}: {
  stars: number | null;
  review: string;
  onStars: (s: number | null) => void;
  onReview: (v: string) => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <div className="w-full min-w-0 max-w-full">
        <Label className="mb-2 block text-sm font-medium text-[var(--color-lightest)]">
          {t("itemReviewForm.rating")}
        </Label>
        <StarRating value={stars} onChange={onStars} size="xl" fullWidth showGradeText={false} className="w-full" />
      </div>
      <div className="space-y-2">
        <Label>{t("logForm.review")}</Label>
        <Textarea
          placeholder={t("itemReviewForm.reviewPlaceholder")}
          value={review}
          onChange={(e) => onReview(e.target.value)}
          rows={4}
          className="min-h-[80px]"
        />
      </div>
    </>
  );
}

export async function saveScopedReviewTab(
  logId: string,
  scope: "season" | "episode",
  draft: TvReviewTabDraft
): Promise<ScopedReview | null> {
  const season = draft.season === "" ? null : draft.season;
  const episode = draft.episode === "" ? null : draft.episode;
  const grade = draft.stars == null ? null : starsToGrade(draft.stars);
  const res = await apiFetch<{ data: ScopedReview | null }>(`/logs/${logId}/scoped-reviews`, {
    method: "PUT",
    body: JSON.stringify({
      scope,
      season,
      episode,
      grade,
      review: draft.review.trim() || null,
    }),
  });
  return res.data;
}
