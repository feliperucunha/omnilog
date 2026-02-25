import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { MediaType, Log } from "@logeverything/shared";
import { COMPLETED_STATUSES, LOG_STATUS_OPTIONS, STATUS_I18N_KEYS } from "@logeverything/shared";
import { apiFetch, apiFetchCached, invalidateLogsAndItemsCache } from "@/lib/api";
import { toast } from "sonner";
import { tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { StarRating } from "@/components/StarRating";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";

const HAS_SEASON_EPISODE: MediaType[] = ["tv", "anime"];
const HAS_CHAPTER_VOLUME: MediaType[] = ["comics"];

export interface LogCompleteState {
  image: string | null;
  title: string;
  grade: number | null;
  mediaType?: MediaType;
  id?: string;
}

interface ItemReviewFormProps {
  mediaType: MediaType;
  externalId: string;
  title: string;
  image: string | null;
  /** Runtime in minutes (for content-hours when marking completed) */
  runtimeMinutes?: number | null;
  onSaved: () => void;
  onSavedComplete?: (data: LogCompleteState) => void;
}

export function ItemReviewForm({
  mediaType,
  externalId,
  title,
  image,
  runtimeMinutes,
  onSaved,
  onSavedComplete,
}: ItemReviewFormProps) {
  const { t } = useLocale();
  const [myLog, setMyLog] = useState<Log | null>(null);
  const [loadingLog, setLoadingLog] = useState(true);
  const [stars, setStars] = useState(2.5);
  const [review, setReview] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [season, setSeason] = useState<number | "">("");
  const [episode, setEpisode] = useState<number | "">("");
  const [chapter, setChapter] = useState<number | "">("");
  const [volume, setVolume] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const statusOptions = LOG_STATUS_OPTIONS[mediaType];
  const showSeasonEpisode = HAS_SEASON_EPISODE.includes(mediaType);
  const showChapterVolume = HAS_CHAPTER_VOLUME.includes(mediaType);

  useEffect(() => {
    apiFetchCached<Log[]>(
      `/logs?mediaType=${mediaType}&externalId=${encodeURIComponent(externalId)}`,
      { ttlMs: 2 * 60 * 1000 }
    )
      .then((logs) => {
        const log = logs[0] ?? null;
        setMyLog(log);
        if (log) {
          setStars(gradeToStars(log.grade ?? undefined));
          setReview(log.review ?? "");
          setStatus(log.status ?? log.listType ?? null);
          setSeason(log.season ?? "");
          setEpisode(log.episode ?? "");
          setChapter(log.chapter ?? "");
          setVolume(log.volume ?? "");
        }
      })
      .catch(() => setMyLog(null))
      .finally(() => setLoadingLog(false));
  }, [mediaType, externalId]);

  const toNum = (v: number | ""): number | null => (v === "" ? null : v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const gradeNum = starsToGrade(stars);
    setSaving(true);
    try {
      const isCompleted = status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
      const contentHours =
        isCompleted && runtimeMinutes != null && runtimeMinutes > 0
          ? Math.round((runtimeMinutes / 60) * 10) / 10
          : null;
      const payload = {
        grade: gradeNum,
        review: review.trim() || null,
        status: status || null,
        season: toNum(season),
        episode: toNum(episode),
        chapter: toNum(chapter),
        volume: toNum(volume),
        contentHours,
      };
      if (myLog) {
        const updated = await apiFetch<Log>(`/logs/${myLog.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMyLog(updated);
        toast.success(t("toast.reviewUpdated"));
      } else {
        const created = await apiFetch<Log>("/logs", {
          method: "POST",
          body: JSON.stringify({
            mediaType,
            externalId,
            title,
            image: image ?? null,
            ...payload,
          }),
        });
        setMyLog(created);
        toast.success(t("toast.reviewSaved"));
      }
      invalidateLogsAndItemsCache();
      onSaved();
      onSavedComplete?.({
        image,
        title,
        grade: gradeNum,
        mediaType,
        id: externalId,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.failedToSaveReview"));
    } finally {
      setSaving(false);
    }
  };

  if (loadingLog) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="h-24 animate-pulse rounded-md bg-[var(--color-mid)]/50" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-xl font-semibold text-[var(--color-lightest)]">
          {myLog ? t("itemReviewForm.yourReview") : t("itemReviewForm.addReview")}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-2 block text-sm font-medium text-[var(--color-lightest)]">
                {t("itemReviewForm.status")}
              </Label>
              <select
                value={status ?? ""}
                onChange={(e) => setStatus(e.target.value || null)}
                className="flex h-10 w-full max-w-xs rounded-md border border-[var(--color-mid)] bg-[var(--color-darkest)] px-3 py-2 text-sm text-[var(--color-lightest)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)]"
              >
                <option value="">—</option>
                {statusOptions.map((value) => (
                  <option key={value} value={value}>
                    {t(`status.${STATUS_I18N_KEYS[value] ?? value}`)}
                  </option>
                ))}
              </select>
            </div>

            {showSeasonEpisode && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.season")}</Label>
                  <Input
                    type="number"
                    min={0}
                    className="bg-[var(--color-darkest)]"
                    value={season === "" ? "" : season}
                    onChange={(e) => setSeason(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="—"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.episode")}</Label>
                  <Input
                    type="number"
                    min={0}
                    className="bg-[var(--color-darkest)]"
                    value={episode === "" ? "" : episode}
                    onChange={(e) => setEpisode(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="—"
                  />
                </div>
              </div>
            )}

            {showChapterVolume && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.chapter")}</Label>
                  <Input
                    type="number"
                    min={0}
                    className="bg-[var(--color-darkest)]"
                    value={chapter === "" ? "" : chapter}
                    onChange={(e) => setChapter(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="—"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.volume")}</Label>
                  <Input
                    type="number"
                    min={0}
                    className="bg-[var(--color-darkest)]"
                    value={volume === "" ? "" : volume}
                    onChange={(e) => setVolume(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="—"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="mb-2 block text-sm font-medium text-[var(--color-lightest)]">
                {t("itemReviewForm.rating")}
              </Label>
              <StarRating value={stars} onChange={setStars} size="lg" />
            </div>
            <div className="space-y-2">
              <Label>{t("logForm.review")}</Label>
              <Textarea
                placeholder={t("itemReviewForm.reviewPlaceholder")}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
                className="min-h-[80px]"
              />
            </div>
            <motion.div whileTap={tapScale} transition={tapTransition}>
              <Button
                type="submit"
                className="w-full"
                disabled={saving}
              >
                {saving ? t("common.saving") : myLog ? t("itemReviewForm.updateReview") : t("itemReviewForm.saveReview")}
              </Button>
            </motion.div>
          </div>
        </form>
      </Card>
    </motion.div>
  );
}
