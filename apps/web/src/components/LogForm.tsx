import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { NumberCombobox } from "@/components/ui/number-combobox";
import type { MediaType, Log } from "@dogument/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, LOG_STATUS_OPTIONS } from "@dogument/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { apiFetch, apiFetchCached, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { showAchievementToasts } from "@/lib/achievementToast";
import { toast } from "sonner";
import { modalContentVariants, tapScale, tapTransition } from "@/lib/animations";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";
import type { LogCompleteState } from "@/components/ItemReviewForm";

const HAS_SEASON_EPISODE: MediaType[] = ["tv", "anime"];
const HAS_CHAPTER_VOLUME: MediaType[] = ["comics", "manga"];

interface LogFormCreateProps {
  mode: "create";
  mediaType: MediaType;
  externalId: string;
  title: string;
  image: string | null;
  onSaved: (completion?: LogCompleteState) => void;
  onCancel: () => void;
}

interface LogFormEditProps {
  mode: "edit";
  log: Log;
  /** TV/Anime: total episodes (set episode to this when user selects completed status). */
  episodesCount?: number | null;
  onSaved: (completion?: LogCompleteState) => void;
  onCancel: () => void;
  /** Called when user confirms delete; modal will close after. */
  onDelete?: (logId: string) => void | Promise<void>;
}

type LogFormProps = LogFormCreateProps | LogFormEditProps;

const toNum = (v: number | ""): number | null => (v === "" ? null : v);

export function LogForm(props: LogFormProps) {
  const { t } = useLocale();
  const isEdit = props.mode === "edit";
  const log = isEdit ? props.log : null;
  const mediaType = isEdit ? (log!.mediaType as MediaType) : (props as LogFormCreateProps).mediaType;

  const isInProgressInitial = isEdit && log!.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log!.status);
  const [stars, setStars] = useState<number | null>(
    isEdit ? (isInProgressInitial ? null : (log!.grade != null ? gradeToStars(log!.grade) : null)) : null
  );
  const [review, setReview] = useState(isEdit ? (log!.review ?? "") : "");
  const [status, setStatus] = useState<string | null>(
    isEdit ? (log!.status ?? log!.listType ?? null) : LOG_STATUS_OPTIONS[(props as LogFormCreateProps).mediaType][0]
  );
  const [season, setSeason] = useState<number | "">(isEdit ? (log!.season ?? "") : "");
  const [episode, setEpisode] = useState<number | "">(isEdit ? (log!.episode ?? "") : "");
  const [chapter, setChapter] = useState<number | "">(isEdit ? (log!.chapter ?? "") : "");
  const [volume, setVolume] = useState<number | "">(isEdit ? (log!.volume ?? "") : "");
  const [own, setOwn] = useState(isEdit ? (log!.own ?? false) : false);
  const [matchesPlayed, setMatchesPlayed] = useState<number | "">(
    isEdit ? (log!.matchesPlayed ?? (log!.status === "played" ? 1 : "")) : (mediaType === "boardgames" ? 1 : "")
  );
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
  const showBoardGameFields = mediaType === "boardgames";

  useEffect(() => {
    if (!isEdit || !log) return;
    const needOptions = showSeasonEpisode || showChapterVolume;
    if (!needOptions) return;
    const externalId = log.externalId;
    setProgressOptionsLoading(true);
    apiFetchCached<ProgressOptions>(`/items/${mediaType}/${encodeURIComponent(externalId)}/progress-options`, {
      ttlMs: 5 * 60 * 1000,
    })
      .then(setProgressOptions)
      .catch(() => setProgressOptions(null))
      .finally(() => setProgressOptionsLoading(false));
  }, [isEdit, log?.id, mediaType, log?.externalId, showSeasonEpisode, showChapterVolume]);

  useEffect(() => {
    if (isEdit && log) {
      const inProgress = log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status);
      setStars(inProgress ? null : (log.grade != null ? gradeToStars(log.grade) : null));
      setReview(log.review ?? "");
      setStatus(log.status ?? log.listType ?? null);
      setSeason(log.season ?? "");
      setEpisode(log.episode ?? "");
      setChapter(log.chapter ?? "");
      setVolume(log.volume ?? "");
      setOwn(log.own ?? false);
      const defaultMatches = log.status === "played" ? 1 : "";
      setMatchesPlayed(log.matchesPlayed ?? defaultMatches);
    }
  }, [isEdit, log?.id]);

  const title = isEdit ? log!.title : props.title;
  const image = isEdit ? (log!.image ?? null) : (props as LogFormCreateProps).image;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isInProgress = status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
    const grade = isInProgress ? null : (stars == null ? null : starsToGrade(stars));
    setLoading(true);
    try {
      if (isEdit) {
        const isCompleted = status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
        const episodesCount = "episodesCount" in props ? props.episodesCount : undefined;
        const episodeForPayload =
          isCompleted && showSeasonEpisode && episodesCount != null && episodesCount > 0
            ? episodesCount
            : toNum(episode);
        const payload: Record<string, unknown> = {
          grade,
          review: review.trim() || null,
          status: status || null,
          season: toNum(season),
          episode: episodeForPayload,
          chapter: toNum(chapter),
          volume: toNum(volume),
        };
        if (showBoardGameFields) {
          payload.own = own;
          payload.matchesPlayed = toNum(matchesPlayed);
        }
        const currentStatus = props.log.status ?? props.log.listType ?? null;
        const statusChanged = (status ?? null) !== currentStatus;
        const noChange =
          grade === (props.log.grade ?? null) &&
          (review.trim() || null) === (props.log.review ?? null) &&
          (status ?? null) === currentStatus &&
          toNum(season) === (props.log.season ?? null) &&
          episodeForPayload === (props.log.episode ?? null) &&
          toNum(chapter) === (props.log.chapter ?? null) &&
          toNum(volume) === (props.log.volume ?? null) &&
          (!showBoardGameFields ||
            (own === (props.log.own ?? false) && toNum(matchesPlayed) === (props.log.matchesPlayed ?? null)));
        if (noChange) {
          setLoading(false);
          props.onCancel();
          return;
        }
        const updated = await apiFetch<Log & { newBadges?: Array<{ id: string; name: string; icon: string }> }>(
          `/logs/${props.log.id}`,
          { method: "PATCH", body: JSON.stringify(payload) }
        );
        if (updated.newBadges?.length) showAchievementToasts(updated.newBadges, t("dashboard.badgesAchievementUnlocked"));
        toast.success(t("toast.logUpdated"));
        invalidateLogsAndItemsCache();
        if (statusChanged) {
          const completion: LogCompleteState = {
            image,
            title,
            grade: grade ?? null,
            status: status ?? undefined,
            mediaType: props.log.mediaType as MediaType,
            id: props.log.externalId,
            review: review.trim() || null,
            ...(showBoardGameFields && { own, matchesPlayed: toNum(matchesPlayed) }),
          };
          props.onSaved(completion);
        } else {
          props.onSaved();
        }
      } else {
        const created = await apiFetch<Log & { newBadges?: Array<{ id: string; name: string; icon: string }> }>(
          "/logs",
          {
            method: "POST",
            body: JSON.stringify({
              mediaType: props.mediaType,
              externalId: props.externalId,
              title: props.title,
              image: image ?? null,
              grade,
              review,
              status: status ?? null,
              ...(showBoardGameFields && { own, matchesPlayed: toNum(matchesPlayed) }),
            }),
          }
        );
        if (created.newBadges?.length) showAchievementToasts(created.newBadges, t("dashboard.badgesAchievementUnlocked"));
        toast.success(t("toast.logSaved"));
        invalidateLogsAndItemsCache();
        const completion: LogCompleteState = {
          image,
          title,
          grade: grade ?? null,
          status: status ?? undefined,
          mediaType: props.mediaType,
          id: props.externalId,
          review: review.trim() || null,
        };
        props.onSaved(completion);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("toast.failedToSave");
      toast.error(message === LOG_LIMIT_REACHED_CODE ? t("tiers.logLimitReached") : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open modal={false} onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent onClose={props.onCancel}>
        <motion.div initial="initial" animate="animate" variants={modalContentVariants}>
          <div className="mb-4 flex gap-4">
            <ItemImage src={image} className="h-20 w-14 rounded" />
            <h3 className="line-clamp-2 text-lg font-semibold text-[var(--color-lightest)]">
              {title}
            </h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4">
              {isEdit && (
                <>
                  <div>
                    <Label className="mb-2 block text-sm font-medium text-[var(--color-lightest)]">
                      {t("itemReviewForm.status")}
                    </Label>
                    <Select
                      value={status ?? ""}
                      onValueChange={(v) => {
                        const next = v || null;
                        setStatus(next);
                        if (next === "played" && showBoardGameFields) {
                          setMatchesPlayed(1);
                        }
                        if (isEdit && next != null && (COMPLETED_STATUSES as readonly string[]).includes(next) && showSeasonEpisode && "episodesCount" in props && props.episodesCount != null && props.episodesCount > 0) {
                          setEpisode(props.episodesCount);
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
                          dropdownInPortal
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
                          dropdownInPortal
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
                          dropdownInPortal
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
                          dropdownInPortal
                          optionsLoading={progressOptionsLoading}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              {showBoardGameFields && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="log-form-own"
                      checked={own}
                      onChange={(e) => setOwn(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--color-mid)] bg-[var(--color-darkest)] text-[var(--color-mid)] focus:ring-[var(--color-mid)]"
                      aria-describedby="log-form-own-desc"
                    />
                    <Label htmlFor="log-form-own" id="log-form-own-desc" className="cursor-pointer text-sm font-medium text-[var(--color-lightest)]">
                      {t("itemReviewForm.own")}
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.matchesPlayed")}</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={matchesPlayed === "" ? "" : matchesPlayed}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = e.target.value;
                        if (v === "") setMatchesPlayed("");
                        else {
                          const n = parseInt(v, 10);
                          if (Number.isInteger(n) && n >= 0) setMatchesPlayed(n);
                        }
                      }}
                      className="w-full max-w-[8rem]"
                      aria-label={t("itemReviewForm.matchesPlayed")}
                    />
                  </div>
                </>
              )}
              <div>
                <Label className="mb-1 block text-sm font-medium text-[var(--color-lightest)]">
                  {t("itemReviewForm.rating")}
                </Label>
                <StarRating value={stars} onChange={(s) => setStars(s)} size="lg" />
              </div>
              <div className="space-y-2">
                <Label>{t("logForm.review")}</Label>
                <Textarea
                  placeholder={t("logForm.reviewPlaceholder")}
                  value={review ?? ""}
                  onChange={(e) => setReview(e.target.value)}
                  rows={4}
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-4">
                  <motion.div
                    whileTap={tapScale}
                    transition={tapTransition}
                    className="flex-1"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={props.onCancel}
                    >
                      {t("common.cancel")}
                    </Button>
                  </motion.div>
                  <motion.div
                    whileTap={tapScale}
                    transition={tapTransition}
                    className="flex-1"
                  >
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
                    </Button>
                  </motion.div>
                </div>
                {isEdit && "onDelete" in props && props.onDelete && (
                  <div className="border-t border-[var(--color-surface-border)] pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-red-400 hover:bg-red-500/20 hover:text-red-400"
                      onClick={() => setConfirmDeleteOpen(true)}
                      disabled={loading || deleting}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>

    {/* Confirm delete: in-app modal above the edit dialog */}
    <Dialog open={confirmDeleteOpen} onOpenChange={(open) => !open && setConfirmDeleteOpen(false)}>
      <DialogContent
        className="z-[60] sm:max-w-sm"
        overlayClassName="z-[60]"
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--color-lightest)]">
            {t("common.delete")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-light)]">
          {t("common.deleteLogConfirm")}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmDeleteOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={async () => {
              if (!log || !("onDelete" in props) || !props.onDelete) return;
              setDeleting(true);
              try {
                await props.onDelete(log.id);
                setConfirmDeleteOpen(false);
                props.onCancel();
              } finally {
                setDeleting(false);
              }
            }}
          >
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
  </>
  );
}
