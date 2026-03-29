import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { NumberCombobox } from "@/components/ui/number-combobox";
import type { LogAffinityContext, MediaType, Log } from "@geeklogs/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, LOG_STATUS_OPTIONS } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { apiFetch, apiFetchCached, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { showAchievementToasts, type NewBadge } from "@/lib/achievementToast";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { StarRating } from "@/components/StarRating";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";
import { BoardGameOwnershipSwitch } from "@/components/BoardGameOwnershipSwitch";
import { boardGameOwnershipFromBooleans, boardGameOwnershipToBooleans } from "@/lib/boardGameOwnership";
import {
  mediaTypeHasBoardGameOnlyFields,
  mediaTypeHasCollectionOwnership,
  mediaTypeHasPurchaseAmount,
} from "@/lib/mediaTypeFeatures";
import { MoneyAmountInput } from "@/components/MoneyAmountInput";
import { DEFAULT_PURCHASE_CURRENCY } from "@/lib/currencies";

const HAS_SEASON_EPISODE: MediaType[] = ["tv", "anime"];
const HAS_CHAPTER_VOLUME: MediaType[] = ["comics", "manga"];

export interface LogCompleteState {
  image: string | null;
  title: string;
  grade: number | null;
  status?: string | null;
  mediaType?: MediaType;
  id?: string;
  /** User's review/comment when available (for complete modal). */
  review?: string | null;
  /** Games, board games, books, manga, comics: user owns a copy. */
  own?: boolean | null;
  /** Same categories: user wants to buy a copy. */
  wantToBuy?: boolean | null;
  /** Board games only: number of matches/sessions played. */
  matchesPlayed?: number | null;
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
  /** Genre/category names from item (stored with log for stats and recommendations). */
  genres?: string[] | null;
  /** Board games: mechanic names from item detail. */
  mechanics?: string[] | null;
  /** Snapshot from item detail for affinity-based recommendations (board games, books, manga). */
  affinityContextDraft?: LogAffinityContext | null;
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
  mechanics,
  affinityContextDraft,
  onSaved,
  onSavedComplete,
}: ItemReviewFormProps) {
  const { t } = useLocale();
  const { me, refetch: refetchMe } = useMe();
  const meRef = useRef(me);
  meRef.current = me;
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
  const [own, setOwn] = useState(false);
  const [wantToBuy, setWantToBuy] = useState(false);
  const [matchesPlayed, setMatchesPlayed] = useState<number | "">("");
  const [purchaseCurrency, setPurchaseCurrency] = useState(DEFAULT_PURCHASE_CURRENCY);
  const [purchaseAmountMinor, setPurchaseAmountMinor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loadingLog || myLog != null) return;
    const d = me?.defaultPurchaseCurrency;
    if (!d) return;
    setPurchaseCurrency((prev) => (prev === DEFAULT_PURCHASE_CURRENCY ? d : prev));
  }, [loadingLog, myLog, me?.defaultPurchaseCurrency]);

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
  const showBoardGameFields = mediaTypeHasBoardGameOnlyFields(mediaType);
  const showPurchaseAmount = mediaTypeHasPurchaseAmount(mediaType);
  const showCollectionOwnership = mediaTypeHasCollectionOwnership(mediaType);
  /** Spend field only when "Own" is selected (games / board games); manga & comics have no ownership switch. */
  const showPurchaseAmountField = showPurchaseAmount && (!showCollectionOwnership || own);

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
          setOwn(log.own ?? false);
          setWantToBuy(log.wantToBuy ?? false);
          const defaultMatches = showBoardGameFields
            ? (log.status === "played" ? 1 : log.status === "plan to play" ? 0 : "")
            : "";
          setMatchesPlayed(log.matchesPlayed != null ? log.matchesPlayed : defaultMatches);
          setPurchaseCurrency(log.purchaseCurrency ?? DEFAULT_PURCHASE_CURRENCY);
          setPurchaseAmountMinor(log.purchaseAmountMinor ?? null);
        } else {
          setStars(null);
          setReview("");
          setStatus(LOG_STATUS_OPTIONS[mediaType][0]);
          setSeason("");
          setEpisode("");
          setChapter("");
          setVolume("");
          setHoursToBeat("");
          setOwn(false);
          setWantToBuy(false);
          setMatchesPlayed(showBoardGameFields ? 1 : "");
          setPurchaseCurrency(meRef.current?.defaultPurchaseCurrency ?? DEFAULT_PURCHASE_CURRENCY);
          setPurchaseAmountMinor(null);
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

  const sameStringList = (a: string[], b: string[] | null | undefined): boolean => {
    if (a.length !== (b?.length ?? 0)) return false;
    return a.every((x, i) => x === b![i]);
  };

  const affinityJsonStable = (v: LogAffinityContext | null | undefined) => JSON.stringify(v ?? null);

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
      const genreList = (genres ?? myLog?.genres ?? []).slice(0, 20);
      const mechanicList = (mechanics ?? myLog?.mechanics ?? []).slice(0, 20);
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
      if (showCollectionOwnership) {
        payload.own = own;
        payload.wantToBuy = wantToBuy;
      }
      if (showBoardGameFields) {
        payload.matchesPlayed = toNum(matchesPlayed);
      }
      if (showPurchaseAmount) {
        const includePurchase = !showCollectionOwnership || own;
        if (!includePurchase || purchaseAmountMinor == null) {
          payload.purchaseAmountMinor = null;
          payload.purchaseCurrency = null;
        } else {
          payload.purchaseAmountMinor = purchaseAmountMinor;
          payload.purchaseCurrency = purchaseCurrency || DEFAULT_PURCHASE_CURRENCY;
        }
      }
      if (genreList.length > 0) payload.genres = genreList;
      if (showBoardGameFields && mechanicList.length > 0) payload.mechanics = mechanicList;
      if (
        (mediaType === "boardgames" || mediaType === "books" || mediaType === "manga") &&
        affinityContextDraft != null &&
        Object.keys(affinityContextDraft).length > 0
      ) {
        payload.affinityContext = affinityContextDraft;
      }
      if (myLog) {
        const currentStatus = myLog.status ?? myLog.listType ?? null;
        const statusChanged = (status ?? null) !== currentStatus;
        const mechanicsMatch =
          !showBoardGameFields || sameStringList(mechanicList, myLog.mechanics ?? []);
        const affinityMatch =
          mediaType !== "boardgames" && mediaType !== "books" && mediaType !== "manga"
            ? true
            : affinityJsonStable(myLog.affinityContext) === affinityJsonStable(affinityContextDraft);
        const noChange =
          gradeNum === (myLog.grade ?? null) &&
          (review.trim() || null) === (myLog.review ?? null) &&
          (status ?? null) === currentStatus &&
          toNum(season) === (myLog.season ?? null) &&
          episodeForPayload === (myLog.episode ?? null) &&
          toNum(chapter) === (myLog.chapter ?? null) &&
          toNum(volume) === (myLog.volume ?? null) &&
          (!showHoursToBeat || toNum(hoursToBeat) === (myLog.hoursToBeat ?? null)) &&
          sameStringList(genreList, myLog.genres ?? []) &&
          mechanicsMatch &&
          affinityMatch &&
          (!showCollectionOwnership ||
            (own === (myLog.own ?? false) && wantToBuy === (myLog.wantToBuy ?? false))) &&
          (!showBoardGameFields || toNum(matchesPlayed) === (myLog.matchesPlayed ?? null)) &&
          (!showPurchaseAmount ||
            (() => {
              const includePurchase = !showCollectionOwnership || own;
              if (!includePurchase) {
                return (myLog.purchaseAmountMinor ?? null) == null;
              }
              return (
                purchaseAmountMinor === (myLog.purchaseAmountMinor ?? null) &&
                (purchaseCurrency || DEFAULT_PURCHASE_CURRENCY) ===
                  (myLog.purchaseCurrency ?? DEFAULT_PURCHASE_CURRENCY)
              );
            })());
        if (noChange) {
          setSaving(false);
          return;
        }
        const updated = await apiFetch<Log & { newBadges?: Array<{ id: string; name: string; icon: string }> }>(
          `/logs/${myLog.id}`,
          { method: "PATCH", body: JSON.stringify(payload) }
        );
        setMyLog(updated);
        if (updated.newBadges?.length) showAchievementToasts(updated.newBadges, t("dashboard.badgesAchievementUnlocked"));
        toast.success(t("toast.reviewUpdated"));
        invalidateLogsAndItemsCache();
        if (
          showPurchaseAmount &&
          (!showCollectionOwnership || own) &&
          purchaseAmountMinor != null
        ) {
          void refetchMe();
        }
        onSaved();
        if (statusChanged) {
          onSavedComplete?.({
            image,
            title,
            grade: gradeNum ?? null,
            status: status ?? undefined,
            mediaType,
            id: externalId,
            review: review.trim() || null,
            ...(showCollectionOwnership && { own, wantToBuy }),
            ...(showBoardGameFields && { matchesPlayed: toNum(matchesPlayed) }),
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
        const created = await apiFetch<Log & { newBadges?: NewBadge[] }>(
          "/logs",
          { method: "POST", body: JSON.stringify(createBody) }
        );
        setMyLog(created);
        if (created.newBadges?.length) showAchievementToasts(created.newBadges, t("dashboard.badgesAchievementUnlocked"));
        toast.success(t("toast.reviewSaved"));
        invalidateLogsAndItemsCache();
        if (
          showPurchaseAmount &&
          (!showCollectionOwnership || own) &&
          purchaseAmountMinor != null
        ) {
          void refetchMe();
        }
        onSaved();
        onSavedComplete?.({
          image,
          title,
          grade: gradeNum ?? null,
          status: status ?? undefined,
          mediaType,
          id: externalId,
          review: review.trim() || null,
          ...(showCollectionOwnership && { own, wantToBuy }),
          ...(showBoardGameFields && { matchesPlayed: toNum(matchesPlayed) }),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === LOG_LIMIT_REACHED_CODE) {
        showErrorToast(t, "E011");
      } else {
        showErrorToast(t, "E012", { originalError: err });
      }
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
      <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 min-w-0 text-xl font-semibold text-[var(--color-lightest)]">
          {myLog ? t("itemReviewForm.yourReview") : t("itemReviewForm.addReview")}
        </h2>
        {showCollectionOwnership &&
          myLog &&
          (myLog.own === true ||
            myLog.wantToBuy === true ||
            (showBoardGameFields && myLog.matchesPlayed != null && myLog.matchesPlayed > 0)) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {myLog.own === true && (
              <span className="rounded-md bg-[var(--color-darkest)]/80 px-2 py-1 text-xs text-[var(--color-light)]">
                {t("itemReviewForm.own")}
              </span>
            )}
            {myLog.wantToBuy === true && (
              <span className="rounded-md bg-[var(--color-darkest)]/80 px-2 py-1 text-xs text-[var(--color-light)]">
                {t("itemReviewForm.wantToBuy")}
              </span>
            )}
            {showBoardGameFields && myLog.matchesPlayed != null && myLog.matchesPlayed > 0 && (
              <span className="rounded-md bg-[var(--color-darkest)]/80 px-2 py-1 text-xs text-[var(--color-light)]">
                {t("itemReviewForm.matchesPlayed")}: {myLog.matchesPlayed}
              </span>
            )}
          </div>
        )}
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
                  if (showBoardGameFields) {
                    setMatchesPlayed(next === "played" ? 1 : next === "plan to play" ? 0 : matchesPlayed);
                  }
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

            {showCollectionOwnership && (
              <>
                <BoardGameOwnershipSwitch
                  value={boardGameOwnershipFromBooleans(own, wantToBuy)}
                  onChange={(mode) => {
                    const next = boardGameOwnershipToBooleans(mode);
                    setOwn(next.own);
                    setWantToBuy(next.wantToBuy);
                  }}
                  disabled={saving}
                />
              </>
            )}
            {showBoardGameFields && (
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-lightest)]">
                    {t("itemReviewForm.matchesPlayed")}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={matchesPlayed === "" ? "" : matchesPlayed}
                    onChange={(e) => {
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

            {showPurchaseAmountField && (
              <MoneyAmountInput
                label={t("money.spentOnItem")}
                currency={purchaseCurrency}
                onCurrencyChange={setPurchaseCurrency}
                amountMinor={purchaseAmountMinor}
                onAmountMinorChange={setPurchaseAmountMinor}
                disabled={saving}
                t={t}
                className="w-full max-w-full sm:max-w-md"
              />
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
