import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { NumberCombobox } from "@/components/ui/number-combobox";
import type { MediaType, Log } from "@geeklogs/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, LOG_STATUS_OPTIONS } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { apiFetch, apiFetchCached, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { showAchievementToasts, type NewBadge } from "@/lib/achievementToast";
import { triggerImpact } from "@/lib/capacitorHaptics";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { modalContentVariants, tapScale, tapTransition } from "@/lib/animations";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { BoardGameOwnershipSwitch } from "@/components/BoardGameOwnershipSwitch";
import { boardGameOwnershipFromBooleans, boardGameOwnershipToBooleans } from "@/lib/boardGameOwnership";
import { mediaTypeHasBoardGameOnlyFields, mediaTypeHasCollectionOwnership } from "@/lib/mediaTypeFeatures";

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
  const { me } = useMe();
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
  const [hoursToBeat, setHoursToBeat] = useState<number | "">(isEdit ? (log!.hoursToBeat ?? "") : "");
  const [own, setOwn] = useState(isEdit ? (log!.own ?? false) : false);
  const [wantToBuy, setWantToBuy] = useState(isEdit ? (log!.wantToBuy ?? false) : false);
  const [matchesPlayed, setMatchesPlayed] = useState<number | "">(
    isEdit
      ? (log!.matchesPlayed ?? (log!.status === "played" ? 1 : mediaType === "boardgames" ? 0 : ""))
      : (mediaType === "boardgames" ? 1 : "")
  );
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const isMobile = useIsMobile();

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
  const showBoardGameFields = mediaTypeHasBoardGameOnlyFields(mediaType);
  const showCollectionOwnership = mediaTypeHasCollectionOwnership(mediaType);
  const showHoursToBeat = mediaType === "games";

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
      setHoursToBeat(log.hoursToBeat ?? "");
      setOwn(log.own ?? false);
      setWantToBuy(log.wantToBuy ?? false);
      const defaultMatches = showBoardGameFields
        ? (log.status === "played" ? 1 : log.status === "plan to play" ? 0 : "")
        : "";
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
        if (showHoursToBeat) payload.hoursToBeat = toNum(hoursToBeat);
        if (showCollectionOwnership) {
          payload.own = own;
          payload.wantToBuy = wantToBuy;
        }
        if (showBoardGameFields) {
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
          (!showHoursToBeat || toNum(hoursToBeat) === (props.log.hoursToBeat ?? null)) &&
          (!showCollectionOwnership ||
            (own === (props.log.own ?? false) && wantToBuy === (props.log.wantToBuy ?? false))) &&
          (!showBoardGameFields || toNum(matchesPlayed) === (props.log.matchesPlayed ?? null));
        if (noChange) {
          setLoading(false);
          props.onCancel();
          return;
        }
        const updated = await apiFetch<Log & { newBadges?: NewBadge[] }>(
          `/logs/${props.log.id}`,
          { method: "PATCH", body: JSON.stringify(payload) }
        );
        if (updated.newBadges?.length) showAchievementToasts(updated.newBadges, t("dashboard.badgesAchievementUnlocked"));
        toast.success(t("toast.logUpdated"));
        triggerImpact("medium");
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
            ...(showCollectionOwnership && { own, wantToBuy }),
            ...(showBoardGameFields && { matchesPlayed: toNum(matchesPlayed) }),
          };
          props.onSaved(completion);
        } else {
          props.onSaved();
        }
      } else {
        const created = await apiFetch<Log & { newBadges?: NewBadge[] }>(
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
              ...(showHoursToBeat && { hoursToBeat: toNum(hoursToBeat) }),
              ...(showCollectionOwnership && { own, wantToBuy }),
              ...(showBoardGameFields && { matchesPlayed: toNum(matchesPlayed) }),
            }),
          }
        );
        if (created.newBadges?.length) showAchievementToasts(created.newBadges, t("dashboard.badgesAchievementUnlocked"));
        toast.success(t("toast.logSaved"));
        triggerImpact("medium");
        invalidateLogsAndItemsCache();
        const completion: LogCompleteState = {
          image,
          title,
          grade: grade ?? null,
          status: status ?? undefined,
          mediaType: props.mediaType,
          id: props.externalId,
          review: review.trim() || null,
          ...(showCollectionOwnership && { own, wantToBuy }),
          ...(showBoardGameFields && { matchesPlayed: toNum(matchesPlayed) }),
        };
        props.onSaved(completion);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === LOG_LIMIT_REACHED_CODE) {
        showErrorToast(t, "E011");
      } else {
        showErrorToast(t, "E013", { originalError: err });
      }
    } finally {
      setLoading(false);
    }
  };

  const formId = "log-form-drawer";
  const includeButtonsInForm = !isMobile;

  const formContent = (
    <motion.div initial="initial" animate="animate" variants={modalContentVariants}>
      <div className="mb-4 flex gap-4">
        <ItemImage
          src={image}
          className="h-20 w-14 rounded"
          mediaType={mediaType}
          boardGameSource={isEdit ? log?.boardGameSource : undefined}
          activeBoardGameProvider={!isEdit && mediaType === "boardgames" ? (me?.boardGameProvider ?? null) : undefined}
        />
        <h3 className="line-clamp-2 text-lg font-semibold text-[var(--color-lightest)]">
          {title}
        </h3>
      </div>
      <form id={isMobile ? formId : undefined} onSubmit={handleSubmit}>
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
                        if (showBoardGameFields) {
                          setMatchesPlayed(next === "played" ? 1 : next === "plan to play" ? 0 : matchesPlayed);
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
              {showHoursToBeat && (
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-lightest)]">{t("itemReviewForm.hoursToBeat")}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="—"
                    value={hoursToBeat === "" ? "" : hoursToBeat}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
              {showCollectionOwnership && (
                <>
                  <BoardGameOwnershipSwitch
                    value={boardGameOwnershipFromBooleans(own, wantToBuy)}
                    onChange={(mode) => {
                      const next = boardGameOwnershipToBooleans(mode);
                      setOwn(next.own);
                      setWantToBuy(next.wantToBuy);
                    }}
                    disabled={loading || deleting}
                  />
                </>
              )}
              {showBoardGameFields && (
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
              {includeButtonsInForm && (
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
              )}
            </div>
          </form>
    </motion.div>
  );

  const drawerFooterContent = (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex w-full min-w-0 gap-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={props.onCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          form={formId}
          className="flex-1"
          disabled={loading}
        >
          {loading ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
        </Button>
      </div>
      {isEdit && "onDelete" in props && props.onDelete && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-red-400 hover:bg-red-500/20 hover:text-red-400"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={loading || deleting}
        >
          {t("common.delete")}
        </Button>
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Drawer
          open
          modal={false}
          onOpenChange={(open) => !open && !confirmDeleteOpen && props.onCancel()}
        >
          <DrawerContent
            onClose={props.onCancel}
            closeOnInteractOutside={!confirmDeleteOpen}
            mobileHeight="95%"
            className="flex max-h-[85dvh] w-full max-w-lg flex-col p-4 sm:p-6"
          >
            <div className="mt-6">{formContent}</div>
            <DrawerFooter>{drawerFooterContent}</DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog
          open
          modal={false}
          onOpenChange={(open) => !open && !confirmDeleteOpen && props.onCancel()}
        >
          <DialogContent onClose={props.onCancel} closeOnInteractOutside={!confirmDeleteOpen}>
            {formContent}
          </DialogContent>
        </Dialog>
      )}

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
                } catch {
                  // Parent (e.g. MediaLogs) shows toast and rethrows on delete failure
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
