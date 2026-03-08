import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { NumberCombobox } from "@/components/ui/number-combobox";
import type { MediaType, Log } from "@logeverything/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, LOG_STATUS_OPTIONS } from "@logeverything/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { apiFetch, apiFetchCached, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { toast } from "sonner";
import { tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { StarRating } from "@/components/StarRating";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";

const HAS_SEASON_EPISODE: MediaType[] = ["tv", "anime"];
const HAS_CHAPTER_VOLUME: MediaType[] = ["comics", "manga"];

export interface LogCompleteState {
  image: string | null;
  title: string;
  grade: number | null;
  status?: string | null;
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
  /** TV/Anime: total episodes (used to set episode when user selects completed status) */
  episodesCount?: number | null;
  /** Genre names from item (stored with log for stats). Up to 2 sent to API. */
  genres?: string[] | null;
  onSaved: () => void;
  onSavedComplete?: (data: LogCompleteState) => void;
}

export function ItemReviewForm({
  mediaType,
  externalId,
  title,
  image,
  runtimeMinutes,
  episodesCount,
  genres,
  onSaved,
  onSavedComplete,
}: ItemReviewFormProps) {
  const { t } = useLocale();
  const { me } = useMe();
  const [myLog, setMyLog] = useState<Log | null>(null);
  const [loadingLog, setLoadingLog] = useState(true);
  const [stars, setStars] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [status, setStatus] = useState<string | null>(LOG_STATUS_OPTIONS[mediaType][0]);
  const [season, setSeason] = useState<number | "">("");
  const [episode, setEpisode] = useState<number | "">("");
  const [chapter, setChapter] = useState<number | "">("");
  const [volume, setVolume] = useState<number | "">("");
  const [hoursToBeat, setHoursToBeat] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  type ProgressOptions = {
    seasons?: number[];
    episodesBySeason?: Record<string, number[]>;
    episodes?: number[];
    chapters?: number[];
    volumes?: number[];
  };
  const [progressOptions, setProgressOptions] = useState<ProgressOptions | null>(null);
  const [progressOptionsLoading, setProgressOptionsLoading] = useState(false);

  const statusOptions = LOG_STATUS_OPTIONS[mediaType];
  const showSeasonEpisode = HAS_SEASON_EPISODE.includes(mediaType);
  const showChapterVolume = HAS_CHAPTER_VOLUME.includes(mediaType);
  const showHoursToBeat = mediaType === "games";

  useEffect(() => {
    if (!showSeasonEpisode && !showChapterVolume) return;
    setProgressOptionsLoading(true);
    apiFetchCached<ProgressOptions>(
      `/items/${mediaType}/${encodeURIComponent(externalId)}/progress-options`,
      { ttlMs: 5 * 60 * 1000 }
    )
      .then(setProgressOptions)
      .catch(() => setProgressOptions(null))
      .finally(() => setProgressOptionsLoading(false));
  }, [mediaType, externalId, showSeasonEpisode, showChapterVolume]);

  useEffect(() => {
    apiFetchCached<Log[]>(
      `/logs?mediaType=${mediaType}&externalId=${encodeURIComponent(externalId)}`,
      { ttlMs: 2 * 60 * 1000 }
    )
      .then((logs) => {
        const log = logs[0] ?? null;
        setMyLog(log);
        if (log) {
          const isInProgressLog = log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status);
          setStars(isInProgressLog ? null : (log.grade != null ? gradeToStars(log.grade) : null));
          setReview(log.review ?? "");
          setStatus(log.status ?? log.listType ?? null);
          setSeason(log.season ?? "");
          setEpisode(log.episode ?? "");
          setChapter(log.chapter ?? "");
          setVolume(log.volume ?? "");
          setHoursToBeat(log.hoursToBeat != null ? log.hoursToBeat : "");
        } else {
          setStars(null);
          setReview("");
          setStatus(LOG_STATUS_OPTIONS[mediaType][0]);
          setSeason("");
          setEpisode("");
          setChapter("");
          setVolume("");
          setHoursToBeat("");
        }
      })
      .catch(() => {
        setMyLog(null);
        setStars(null);
        setReview("");
      })
      .finally(() => setLoadingLog(false));
  }, [mediaType, externalId]);

  const toNum = (v: number | ""): number | null => (v === "" ? null : v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isInProgress = status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
    const gradeNum = isInProgress ? null : (stars == null ? null : starsToGrade(stars));
    setSaving(true);
    try {
      const isCompleted = status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
      const contentHours =
        isCompleted && runtimeMinutes != null && runtimeMinutes > 0
          ? Math.round((runtimeMinutes / 60) * 10) / 10
          : null;
      const episodeForPayload =
        isCompleted && showSeasonEpisode && episodesCount != null && episodesCount > 0
          ? episodesCount
          : toNum(episode);
      const genreList = (genres ?? myLog?.genres ?? []).slice(0, 2);
      const payload: Record<string, unknown> = {
        grade: gradeNum,
        review: review.trim() || null,
        status: status || null,
        season: toNum(season),
        episode: episodeForPayload,
        chapter: toNum(chapter),
        volume: toNum(volume),
        contentHours,
      };
      if (showHoursToBeat) payload.hoursToBeat = toNum(hoursToBeat);
      if (genreList.length > 0) payload.genres = genreList;
      if (myLog) {
        const currentStatus = myLog.status ?? myLog.listType ?? null;
        const statusChanged = (status ?? null) !== currentStatus;
        const noChange =
          gradeNum === (myLog.grade ?? null) &&
          (review.trim() || null) === (myLog.review ?? null) &&
          (status ?? null) === currentStatus &&
          toNum(season) === (myLog.season ?? null) &&
          episodeForPayload === (myLog.episode ?? null) &&
          toNum(chapter) === (myLog.chapter ?? null) &&
          toNum(volume) === (myLog.volume ?? null) &&
          (!showHoursToBeat || toNum(hoursToBeat) === (myLog.hoursToBeat ?? null));
        if (noChange) {
          setSaving(false);
          return;
        }
        const updated = await apiFetch<Log>(`/logs/${myLog.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMyLog(updated);
        toast.success(t("toast.reviewUpdated"));
        invalidateLogsAndItemsCache();
        onSaved();
        if (statusChanged) {
          onSavedComplete?.({
            image,
            title,
            grade: gradeNum ?? null,
            status: status ?? undefined,
            mediaType,
            id: externalId,
          });
        }
      } else {
        const createBody: Record<string, unknown> = {
          mediaType,
          externalId,
          title,
          image: image ?? null,
          ...payload,
        };
        if (mediaType === "boardgames" && (me?.boardGameProvider === "bgg" || me?.boardGameProvider === "ludopedia"))
          createBody.boardGameSource = me.boardGameProvider;
        const created = await apiFetch<Log>("/logs", {
          method: "POST",
          body: JSON.stringify(createBody),
        });
        setMyLog(created);
        toast.success(t("toast.reviewSaved"));
        invalidateLogsAndItemsCache();
        onSaved();
        onSavedComplete?.({
          image,
          title,
          grade: gradeNum ?? null,
          status: status ?? undefined,
          mediaType,
          id: externalId,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("toast.failedToSaveReview");
      toast.error(message === LOG_LIMIT_REACHED_CODE ? t("tiers.logLimitReached") : message);
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
              <Select
                value={status ?? ""}
                onValueChange={(v) => {
                  const next = v || null;
                  setStatus(next);
                  if (next != null && (COMPLETED_STATUSES as readonly string[]).includes(next) && showSeasonEpisode && episodesCount != null && episodesCount > 0) {
                    setEpisode(episodesCount);
                  }
                }}
                options={[
                  { value: "", label: "—" },
                  ...statusOptions.map((value) => ({
                    value,
                    label: getStatusLabel(t, value, mediaType),
                  })),
                ]}
                placeholder="—"
                aria-label={t("itemReviewForm.status")}
              />
            </div>

            {showSeasonEpisode && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.season")}</Label>
                  <NumberCombobox
                    value={season}
                    onChange={(next) => {
                      setSeason(next);
                      if (next !== "" && status != null && (COMPLETED_STATUSES as readonly string[]).includes(status))
                        setStatus("watching");
                    }}
                    options={progressOptions?.seasons ?? []}
                    placeholder="—"
                    aria-label={t("itemReviewForm.season")}
                    optionsLoading={progressOptionsLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.episode")}</Label>
                  <NumberCombobox
                    value={episode}
                    onChange={(next) => {
                      setEpisode(next);
                      if (next !== "" && status != null && (COMPLETED_STATUSES as readonly string[]).includes(status))
                        setStatus("watching");
                    }}
                    options={
                      mediaType === "tv" && season !== ""
                        ? (progressOptions?.episodesBySeason?.[String(season)] ?? [])
                        : (progressOptions?.episodes ?? [])
                    }
                    placeholder="—"
                    aria-label={t("itemReviewForm.episode")}
                    optionsLoading={progressOptionsLoading}
                  />
                </div>
              </div>
            )}

            {showChapterVolume && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.chapter")}</Label>
                  <NumberCombobox
                    value={chapter}
                    onChange={setChapter}
                    options={progressOptions?.chapters ?? []}
                    placeholder="—"
                    aria-label={t("itemReviewForm.chapter")}
                    optionsLoading={progressOptionsLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.volume")}</Label>
                  <NumberCombobox
                    value={volume}
                    onChange={setVolume}
                    options={progressOptions?.volumes ?? []}
                    placeholder="—"
                    aria-label={t("itemReviewForm.volume")}
                    optionsLoading={progressOptionsLoading}
                  />
                </div>
              </div>
            )}

            {showHoursToBeat && (
              <div className="space-y-2">
                <Label className="text-sm text-[var(--color-lightest)]">
                  {t("itemReviewForm.hoursToBeat")}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="—"
                  value={hoursToBeat === "" ? "" : hoursToBeat}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") setHoursToBeat("");
                    else {
                      const n = parseFloat(v);
                      if (Number.isFinite(n)) setHoursToBeat(n);
                    }
                  }}
                  className="w-full max-w-[8rem]"
                  aria-label={t("itemReviewForm.hoursToBeat")}
                />
              </div>
            )}

            <div>
              <Label className="mb-2 block text-sm font-medium text-[var(--color-lightest)]">
                {t("itemReviewForm.rating")}
              </Label>
              <StarRating
                value={stars}
                onChange={(s) => setStars(s)}
                size="lg"
              />
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
