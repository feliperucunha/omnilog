import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { NumberCombobox } from "@/components/ui/number-combobox";
import type { LogAffinityContext, MediaType, Log, ScopedReview } from "@geeklogs/shared";
import { COMPLETED_STATUSES, LOG_STATUS_OPTIONS } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { apiFetch, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { useProgressOptions } from "@/hooks/useProgressOptions";
import { decodeLogForDisplay } from "@/lib/decodeDisplayFields";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import {
  episodeFieldUnchanged,
  episodePayloadValue,
  gradeForPayload,
  gradeStarsUnchanged,
  logDateInputMatchesStored,
} from "@/lib/logFormEquality";
import { BoardGameOwnershipSwitch } from "@/components/BoardGameOwnershipSwitch";
import { boardGameOwnershipFromBooleans, boardGameOwnershipToBooleans } from "@/lib/boardGameOwnership";
import {
  mediaTypeHasBoardGameOnlyFields,
  mediaTypeHasCollectionOwnership,
  mediaTypeHasMarketTab,
  mediaTypeHasPurchaseAmount,
  spendFieldsIncludePurchase,
} from "@/lib/mediaTypeFeatures";
import { MoneyAmountInput } from "@/components/MoneyAmountInput";
import { DEFAULT_PURCHASE_CURRENCY, normalizeCurrencyCode } from "@/lib/currencies";
import {
  BoardGameMatchesSection,
  type BoardGameMatchesSectionHandle,
} from "@/components/BoardGameMatchesSection";
import {
  canSavePartialReview,
  resolvePartialReviewTarget,
  reviewDraftForSeasonEpisodeChange,
  savePartialScopedReview,
  showReviewDraftFromLog,
} from "@/lib/partialTvReview";
import { ReviewPartialSaveButtons } from "@/components/ReviewPartialSaveButtons";
import { SavedTvReviewsSection } from "@/components/SavedTvReviewsSection";
import { GameLogFields } from "@/components/GameLogFields";
import { ReadingProgressFields } from "@/components/ReadingProgressFields";
import { MarketListingSection } from "@/components/MarketListingSection";
import { dateInputToIso, isoToDateInput } from "@/lib/readingDates";
import { cn } from "@/lib/utils";

const HAS_SEASON_EPISODE: MediaType[] = ["tv", "anime"];
const HAS_SEASON_FIELD: MediaType[] = ["tv"];
const HAS_CHAPTER_VOLUME: MediaType[] = ["comics", "manga"];
const HAS_READING_PROGRESS: MediaType[] = ["books", "manga", "comics"];
const HAS_GAME_LOG_FIELDS: MediaType[] = ["games"];

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
  /** Sold / no longer owned (spend-tracked categories). */
  sold?: boolean | null;
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
  /** Books: total page count from item detail (for progress hint). */
  pagesCount?: number | null;
  /** Games: platform names from item detail (for console picker). */
  platforms?: string[] | null;
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
  pagesCount,
  platforms,
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
  const [pagesRead, setPagesRead] = useState<number | "">("");
  const [gamePlatform, setGamePlatform] = useState("");
  const [startedAtInput, setStartedAtInput] = useState("");
  const [completedAtInput, setCompletedAtInput] = useState("");
  const [hoursToBeat, setHoursToBeat] = useState<number | "">("");
  const [own, setOwn] = useState(false);
  const [wantToBuy, setWantToBuy] = useState(false);
  const [sold, setSold] = useState(false);
  const [matchesPlayed, setMatchesPlayed] = useState<number | "">("");
  const [purchaseCurrency, setPurchaseCurrency] = useState(DEFAULT_PURCHASE_CURRENCY);
  const [purchaseAmountMinor, setPurchaseAmountMinor] = useState<number | null>(null);
  const [saleCurrency, setSaleCurrency] = useState(DEFAULT_PURCHASE_CURRENCY);
  const [saleAmountMinor, setSaleAmountMinor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [itemMainTab, setItemMainTab] = useState<"review" | "matches" | "market">("review");
  const [searchParams] = useSearchParams();
  const boardMatchesRef = useRef<BoardGameMatchesSectionHandle>(null);
  const prevSeasonEpisodeRef = useRef<{ season: number | ""; episode: number | "" } | null>(null);
  const [scopedReviews, setScopedReviews] = useState<ScopedReview[]>([]);

  /** When the log has no saved currency for a field, use account default (not only when state is still USD). */
  useEffect(() => {
    if (loadingLog) return;
    const d = normalizeCurrencyCode(me?.defaultPurchaseCurrency);
    const logPc = normalizeCurrencyCode(myLog?.purchaseCurrency);
    const logSc = normalizeCurrencyCode(myLog?.saleCurrency);
    if (logPc) {
      setPurchaseCurrency(logPc);
    } else if (d) {
      setPurchaseCurrency(d);
    } else {
      setPurchaseCurrency(DEFAULT_PURCHASE_CURRENCY);
    }
    if (logSc) {
      setSaleCurrency(logSc);
    } else if (d) {
      setSaleCurrency(d);
    } else {
      setSaleCurrency(DEFAULT_PURCHASE_CURRENCY);
    }
  }, [loadingLog, myLog?.id, myLog?.purchaseCurrency, myLog?.saleCurrency, me?.defaultPurchaseCurrency]);

  const statusOptions = LOG_STATUS_OPTIONS[mediaType];
  const showSeasonEpisode = HAS_SEASON_EPISODE.includes(mediaType);
  const hasPartialReviews = showSeasonEpisode;
  const showSeasonField = HAS_SEASON_FIELD.includes(mediaType);
  const showChapterVolume = HAS_CHAPTER_VOLUME.includes(mediaType);
  const showReadingProgress = HAS_READING_PROGRESS.includes(mediaType);
  const showGameLogFields = HAS_GAME_LOG_FIELDS.includes(mediaType);
  const showHoursToBeat = mediaType === "games";
  const showBoardGameFields = mediaTypeHasBoardGameOnlyFields(mediaType);
  const showMarketTab = mediaTypeHasMarketTab(mediaType);
  const showPurchaseAmount = mediaTypeHasPurchaseAmount(mediaType);
  const showCollectionOwnership = mediaTypeHasCollectionOwnership(mediaType);
  /** Purchase when owned or sold (cost + sale for net balance). */
  const showPurchaseAmountField =
    showPurchaseAmount && spendFieldsIncludePurchase(showCollectionOwnership, own, sold);
  const showSaleAmountField = showPurchaseAmount && (!showCollectionOwnership || sold);
  const { progressOptions, progressOptionsLoading } = useProgressOptions(
    mediaType,
    externalId,
    showSeasonEpisode || showChapterVolume
  );

  useEffect(() => {
    setLoadingLog(true);
    apiFetch<Log[]>(`/logs?mediaType=${mediaType}&externalId=${encodeURIComponent(externalId)}`)
      .then((logs) => {
        const log = logs[0] != null ? decodeLogForDisplay(logs[0]) : null;
        setMyLog(log);
        if (log) {
          if (HAS_SEASON_EPISODE.includes(mediaType)) {
            const draft = showReviewDraftFromLog(log);
            setStars(draft.stars);
            setReview(draft.review);
          } else {
            setStars(log.grade != null ? gradeToStars(log.grade) : null);
            setReview(log.review ?? "");
          }
          setStatus(log.status ?? log.listType ?? null);
          setSeason(log.season ?? "");
          setEpisode(log.episode ?? "");
          setChapter(log.chapter ?? "");
          setVolume(log.volume ?? "");
          setPagesRead(log.pagesRead ?? "");
          setGamePlatform(log.gamePlatform ?? "");
          setStartedAtInput(isoToDateInput(log.startedAt));
          setCompletedAtInput(isoToDateInput(log.completedAt));
          setHoursToBeat(log.hoursToBeat != null ? log.hoursToBeat : "");
          setOwn(log.own ?? false);
          setWantToBuy(log.wantToBuy ?? false);
          setSold(log.sold ?? false);
          const defaultMatches = showBoardGameFields
            ? (log.status === "played" ? 1 : log.status === "plan to play" ? 0 : "")
            : "";
          setMatchesPlayed(log.matchesPlayed != null ? log.matchesPlayed : defaultMatches);
          setPurchaseCurrency(
            normalizeCurrencyCode(log.purchaseCurrency) ??
              normalizeCurrencyCode(meRef.current?.defaultPurchaseCurrency) ??
              DEFAULT_PURCHASE_CURRENCY
          );
          setPurchaseAmountMinor(log.purchaseAmountMinor ?? null);
          setSaleCurrency(
            normalizeCurrencyCode(log.saleCurrency) ??
              normalizeCurrencyCode(meRef.current?.defaultPurchaseCurrency) ??
              DEFAULT_PURCHASE_CURRENCY
          );
          setSaleAmountMinor(log.saleAmountMinor ?? null);
        } else {
          setStars(null);
          setReview("");
          setStatus(LOG_STATUS_OPTIONS[mediaType][0]);
          setSeason("");
          setEpisode("");
          setChapter("");
          setVolume("");
          setPagesRead("");
          setGamePlatform("");
          setStartedAtInput("");
          setCompletedAtInput("");
          setHoursToBeat("");
          setOwn(false);
          setWantToBuy(false);
          setSold(false);
          setMatchesPlayed(showBoardGameFields ? 1 : "");
          setPurchaseCurrency(
            normalizeCurrencyCode(meRef.current?.defaultPurchaseCurrency) ??
              DEFAULT_PURCHASE_CURRENCY
          );
          setPurchaseAmountMinor(null);
          setSaleCurrency(
            normalizeCurrencyCode(meRef.current?.defaultPurchaseCurrency) ??
              DEFAULT_PURCHASE_CURRENCY
          );
          setSaleAmountMinor(null);
        }
      })
      .catch(() => {
        setMyLog(null);
        setStars(null);
        setReview("");
      })
      .finally(() => setLoadingLog(false));
  }, [mediaType, externalId]);

  useEffect(() => {
    if (!myLog?.id || !hasPartialReviews) {
      setScopedReviews([]);
      return;
    }
    apiFetch<{ data: ScopedReview[] }>(`/logs/${myLog.id}/scoped-reviews`)
      .then((res) => setScopedReviews(res.data ?? []))
      .catch(() => setScopedReviews([]));
  }, [myLog?.id, hasPartialReviews]);

  useEffect(() => {
    prevSeasonEpisodeRef.current = null;
  }, [myLog?.id, mediaType]);

  useEffect(() => {
    if (!hasPartialReviews) return;
    const prev = prevSeasonEpisodeRef.current;
    prevSeasonEpisodeRef.current = { season, episode };
    if (prev === null) return;
    if (prev.season === season && prev.episode === episode) return;
    const draft = reviewDraftForSeasonEpisodeChange(
      mediaType,
      season,
      episode,
      showSeasonField,
      myLog
    );
    setStars(draft.stars);
    setReview(draft.review);
  }, [season, episode, hasPartialReviews, mediaType, showSeasonField, myLog]);

  const resetReviewDraft = useCallback(
    (log: Log | null | undefined = myLog) => {
      if (!hasPartialReviews || !log) {
        setStars(null);
        setReview("");
        return;
      }
      const draft = showReviewDraftFromLog(log);
      setStars(draft.stars);
      setReview(draft.review);
    },
    [hasPartialReviews, myLog]
  );

  useEffect(() => {
    if (searchParams.get("market") === "1" && showMarketTab) {
      setItemMainTab("market");
      return;
    }
    if (!showBoardGameFields) {
      setItemMainTab("review");
      return;
    }
    if (!myLog) {
      setItemMainTab("review");
      return;
    }
    setItemMainTab(searchParams.get("matches") === "1" ? "matches" : "review");
  }, [myLog?.id, showBoardGameFields, showMarketTab, searchParams]);

  useEffect(() => {
    if (!myLog || !showBoardGameFields) return;
    const defaultMatches =
      myLog.status === "played" ? 1 : myLog.status === "plan to play" ? 0 : "";
    setMatchesPlayed(myLog.matchesPlayed != null ? myLog.matchesPlayed : defaultMatches);
  }, [myLog?.id, myLog?.matchesPlayed, myLog?.status, showBoardGameFields]);

  const toNum = (v: number | ""): number | null => (v === "" ? null : v);

  const sameStringList = (a: string[], b: string[] | null | undefined): boolean => {
    if (a.length !== (b?.length ?? 0)) return false;
    return a.every((x, i) => x === b![i]);
  };

  const affinityJsonStable = (v: LogAffinityContext | null | undefined) => JSON.stringify(v ?? null);

  const ensureTvLog = useCallback(async (): Promise<string> => {
    if (myLog?.id) return myLog.id;
    const gradeNum = gradeForPayload(stars);
    const createBody: Record<string, unknown> = {
      mediaType,
      externalId,
      title,
      image: image ?? null,
      grade: gradeNum,
      review: review.trim() || null,
      status: status || LOG_STATUS_OPTIONS[mediaType][0],
      season: toNum(season),
      episode: toNum(episode),
    };
    const created = await apiFetch<Log>("/logs", {
      method: "POST",
      body: JSON.stringify(createBody),
    });
    setMyLog(created);
    invalidateLogsAndItemsCache();
    return created.id;
  }, [
    myLog?.id,
    mediaType,
    externalId,
    title,
    image,
    stars,
    review,
    status,
    season,
    episode,
  ]);

  const clearReviewDraft = useCallback(() => {
    resetReviewDraft(myLog);
  }, [resetReviewDraft, myLog]);

  const ensureMarketLog = useCallback(async (): Promise<Log | null> => {
    if (myLog) return myLog;
    const created = await apiFetch<Log>("/logs", {
      method: "POST",
      body: JSON.stringify({
        mediaType,
        externalId,
        title,
        image: image ?? null,
        grade: null,
        review: null,
        status: null,
        own: true,
        wantToBuy: false,
        sold: false,
      }),
    });
    setMyLog(created);
    setOwn(true);
    setWantToBuy(false);
    setSold(false);
    invalidateLogsAndItemsCache();
    onSaved();
    return created;
  }, [myLog, mediaType, externalId, title, image, onSaved]);

  const ensureBoardGameLog = useCallback(async (): Promise<string> => {
    if (myLog?.id) return myLog.id;
    const genreList = (genres ?? []).slice(0, 20);
    const mechanicList = (mechanics ?? []).slice(0, 20);
    const createBody: Record<string, unknown> = {
      mediaType,
      externalId,
      title,
      image: image ?? null,
      grade: null,
      review: null,
      status: "played",
      matchesPlayed: 0,
    };
    if (genreList.length > 0) createBody.genres = genreList;
    if (mechanicList.length > 0) createBody.mechanics = mechanicList;
    if (affinityContextDraft != null && Object.keys(affinityContextDraft).length > 0) {
      createBody.affinityContext = affinityContextDraft;
    }
    const provider = meRef.current?.boardGameProvider;
    if (provider === "bgg" || provider === "ludopedia") {
      createBody.boardGameSource = provider;
    }
    const created = await apiFetch<Log>("/logs", {
      method: "POST",
      body: JSON.stringify(createBody),
    });
    setMyLog(created);
    setStatus("played");
    setMatchesPlayed(created.matchesPlayed ?? 0);
    invalidateLogsAndItemsCache();
    onSaved();
    return created.id;
  }, [
    myLog?.id,
    genres,
    mechanics,
    affinityContextDraft,
    mediaType,
    externalId,
    title,
    image,
    onSaved,
  ]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const gradeNum = gradeForPayload(stars);
    setSaving(true);
    try {
      const isCompleted = status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
      const contentHours =
        isCompleted && runtimeMinutes != null && runtimeMinutes > 0
          ? Math.round((runtimeMinutes / 60) * 10) / 10
          : null;
      const episodeForPayload = episodePayloadValue(
        episode,
        status,
        episodesCount,
        showSeasonEpisode
      );
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
      if (showReadingProgress) {
        payload.pagesRead = toNum(pagesRead);
        payload.startedAt = startedAtInput.trim() ? dateInputToIso(startedAtInput) : null;
        payload.completedAt = completedAtInput.trim() ? dateInputToIso(completedAtInput) : null;
      }
      if (showGameLogFields) {
        payload.gamePlatform = gamePlatform.trim() || null;
        payload.startedAt = startedAtInput.trim() ? dateInputToIso(startedAtInput) : null;
        payload.completedAt = completedAtInput.trim() ? dateInputToIso(completedAtInput) : null;
      }
      if (showHoursToBeat) payload.hoursToBeat = toNum(hoursToBeat);
      if (showCollectionOwnership) {
        payload.own = own;
        payload.wantToBuy = wantToBuy;
        payload.sold = sold;
      }
      if (showBoardGameFields) {
        payload.matchesPlayed = toNum(matchesPlayed);
      }
      if (showPurchaseAmount) {
        const includePurchase = spendFieldsIncludePurchase(showCollectionOwnership, own, sold);
        if (!includePurchase || purchaseAmountMinor == null) {
          payload.purchaseAmountMinor = null;
          payload.purchaseCurrency = null;
        } else {
          payload.purchaseAmountMinor = purchaseAmountMinor;
          payload.purchaseCurrency = purchaseCurrency || DEFAULT_PURCHASE_CURRENCY;
        }
        const includeSale = !showCollectionOwnership || sold;
        if (!includeSale || saleAmountMinor == null) {
          payload.saleAmountMinor = null;
          payload.saleCurrency = null;
        } else {
          payload.saleAmountMinor = saleAmountMinor;
          payload.saleCurrency = saleCurrency || DEFAULT_PURCHASE_CURRENCY;
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
        const mechanicsMatch =
          !showBoardGameFields || sameStringList(mechanicList, myLog.mechanics ?? []);
        const affinityMatch =
          mediaType !== "boardgames" && mediaType !== "books" && mediaType !== "manga"
            ? true
            : affinityJsonStable(myLog.affinityContext) === affinityJsonStable(affinityContextDraft);
        const noChange =
          gradeStarsUnchanged(stars, myLog.grade) &&
          (review.trim() || null) === (myLog.review ?? null) &&
          (status ?? null) === currentStatus &&
          toNum(season) === (myLog.season ?? null) &&
          episodeFieldUnchanged(episode, myLog.episode) &&
          toNum(chapter) === (myLog.chapter ?? null) &&
          toNum(volume) === (myLog.volume ?? null) &&
          contentHours === (myLog.contentHours ?? null) &&
          (!showReadingProgress ||
            (toNum(pagesRead) === (myLog.pagesRead ?? null) &&
              logDateInputMatchesStored(myLog.startedAt, startedAtInput) &&
              logDateInputMatchesStored(myLog.completedAt, completedAtInput))) &&
          (!showGameLogFields ||
            ((gamePlatform.trim() || null) === (myLog.gamePlatform ?? null) &&
              logDateInputMatchesStored(myLog.startedAt, startedAtInput) &&
              logDateInputMatchesStored(myLog.completedAt, completedAtInput))) &&
          (!showHoursToBeat || toNum(hoursToBeat) === (myLog.hoursToBeat ?? null)) &&
          sameStringList(genreList, myLog.genres ?? []) &&
          mechanicsMatch &&
          affinityMatch &&
          (!showCollectionOwnership ||
            (own === (myLog.own ?? false) &&
              wantToBuy === (myLog.wantToBuy ?? false) &&
              sold === (myLog.sold ?? false))) &&
          (!showBoardGameFields || toNum(matchesPlayed) === (myLog.matchesPlayed ?? null)) &&
          (!showPurchaseAmount ||
            (() => {
              const includePurchase = spendFieldsIncludePurchase(showCollectionOwnership, own, sold);
              if (!includePurchase) {
                return (myLog.purchaseAmountMinor ?? null) == null;
              }
              return (
                purchaseAmountMinor === (myLog.purchaseAmountMinor ?? null) &&
                (purchaseCurrency || DEFAULT_PURCHASE_CURRENCY) ===
                  (myLog.purchaseCurrency ?? DEFAULT_PURCHASE_CURRENCY)
              );
            })()) &&
          (!showPurchaseAmount ||
            (() => {
              const includeSale = !showCollectionOwnership || sold;
              if (!includeSale) {
                return (myLog.saleAmountMinor ?? null) == null;
              }
              return (
                saleAmountMinor === (myLog.saleAmountMinor ?? null) &&
                (saleCurrency || DEFAULT_PURCHASE_CURRENCY) ===
                  (myLog.saleCurrency ?? DEFAULT_PURCHASE_CURRENCY)
              );
            })());
        if (noChange) {
          setSaving(false);
          return;
        }
        const updated = await apiFetch<Log>(
          `/logs/${myLog.id}`,
          { method: "PATCH", body: JSON.stringify(payload) }
        );
        setMyLog(updated);
        if (hasPartialReviews) resetReviewDraft(updated);
        toast.success(t("toast.reviewUpdated"));
        invalidateLogsAndItemsCache();
        if (
          showPurchaseAmount &&
          ((spendFieldsIncludePurchase(showCollectionOwnership, own, sold) && purchaseAmountMinor != null) ||
            ((!showCollectionOwnership || sold) && saleAmountMinor != null))
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
          ...(showCollectionOwnership && { own, wantToBuy, sold }),
          ...(showBoardGameFields && {
            matchesPlayed:
              mediaType === "boardgames" ? (updated.matchesPlayed ?? null) : toNum(matchesPlayed),
          }),
        });
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
        const created = await apiFetch<Log>(
          "/logs",
          { method: "POST", body: JSON.stringify(createBody) }
        );
        setMyLog(created);
        if (hasPartialReviews) resetReviewDraft(created);
        toast.success(t("toast.reviewSaved"));
        invalidateLogsAndItemsCache();
        if (
          showPurchaseAmount &&
          ((spendFieldsIncludePurchase(showCollectionOwnership, own, sold) && purchaseAmountMinor != null) ||
            ((!showCollectionOwnership || sold) && saleAmountMinor != null))
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
          ...(showCollectionOwnership && { own, wantToBuy, sold }),
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

  const handlePartialSave = async () => {
    if (!canSavePartialReview(mediaType, season, episode, showSeasonField)) return;
    const target = resolvePartialReviewTarget(mediaType, season, episode, showSeasonField);
    if (!target) return;
    setSaving(true);
    try {
      const logId = await ensureTvLog();
      await savePartialScopedReview(logId, target, stars, review);
      const res = await apiFetch<{ data: ScopedReview[] }>(`/logs/${logId}/scoped-reviews`);
      setScopedReviews(res.data ?? []);
      clearReviewDraft();
      toast.success(t("toast.reviewSaved"));
      invalidateLogsAndItemsCache();
      onSaved();
    } catch (err) {
      showErrorToast(t, "E012", { originalError: err });
    } finally {
      setSaving(false);
    }
  };

  const handlePrimarySave = async (e?: FormEvent) => {
    e?.preventDefault();
    if (showBoardGameFields && itemMainTab === "matches") {
      setSaving(true);
      try {
        await boardMatchesRef.current?.saveNewMatch();
      } finally {
        setSaving(false);
      }
      return;
    }
    if (itemMainTab === "market") return;
    await handleSubmit(e);
  };

  const handleSaveMatchAndShowBanner = async () => {
    if (!showBoardGameFields || itemMainTab !== "matches") return;
    setSaving(true);
    try {
      await boardMatchesRef.current?.saveNewMatchAndShowBanner();
    } finally {
      setSaving(false);
    }
  };

  const saveButtonLabel = saving
    ? t("common.saving")
    : showBoardGameFields && itemMainTab === "matches"
      ? t("boardGameMatches.saveMatch")
      : myLog
        ? t("common.update")
        : t("common.save");

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
        {(showBoardGameFields || showMarketTab) && (
          <motion.div className="mb-3 flex gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-1">
            <button
              type="button"
              onClick={() => setItemMainTab("review")}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                itemMainTab === "review"
                  ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
                  : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
              )}
            >
              {t("boardGameMatches.tabReview")}
            </button>
            {showBoardGameFields && (
              <button
                type="button"
                onClick={() => setItemMainTab("matches")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  itemMainTab === "matches"
                    ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
                    : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
                )}
              >
                {t("boardGameMatches.tabMatches")}
              </button>
            )}
            {showMarketTab && (
              <button
                type="button"
                onClick={() => setItemMainTab("market")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  itemMainTab === "market"
                    ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
                    : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
                )}
              >
                {t("market.tabList")}
              </button>
            )}
          </motion.div>
        )}
        {showMarketTab && (
          <div className={cn(itemMainTab !== "market" && "hidden")} aria-hidden={itemMainTab !== "market"}>
            <MarketListingSection
              mediaType={mediaType}
              externalId={externalId}
              title={title}
              image={image}
              myLog={myLog}
              onEnsureLog={ensureMarketLog}
            />
          </div>
        )}
        {showBoardGameFields && itemMainTab === "matches" ? (
          <BoardGameMatchesSection
            ref={boardMatchesRef}
            embedded
            logId={myLog?.id ?? null}
            onEnsureLog={ensureBoardGameLog}
            onLogUpdated={(log) => {
              setMyLog(log);
              setStatus(log.status ?? log.listType ?? status);
              if (log.matchesPlayed != null) setMatchesPlayed(log.matchesPlayed);
            }}
            onMatchSaved={() => onSaved()}
          />
        ) : itemMainTab !== "market" ? (
        <>
        <form onSubmit={(e) => void handlePrimarySave(e)}>
          <motion.div className="flex flex-col gap-4">
            <div>
              <Label className="mb-2 block text-sm font-medium text-[var(--color-lightest)]">
                {t("itemReviewForm.status")}
              </Label>
              <Select
                value={status ?? ""}
                onValueChange={(v) => {
                  const next = v || null;
                  setStatus(next);
                  if (showBoardGameFields && !myLog) {
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
              <div
                className={
                  showSeasonField ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"
                }
              >
                {showSeasonField && (
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
                )}
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
                    contentScrollable
                  />
                </div>
              </div>
            )}

            {showReadingProgress && (
              <ReadingProgressFields
                pagesRead={pagesRead}
                onPagesReadChange={setPagesRead}
                pagesCount={pagesCount ?? myLog?.pagesCount ?? null}
                startedAt={startedAtInput}
                onStartedAtChange={setStartedAtInput}
                completedAt={completedAtInput}
                onCompletedAtChange={setCompletedAtInput}
                disabled={saving}
              />
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

            {showGameLogFields && (
              <GameLogFields
                gamePlatform={gamePlatform}
                onGamePlatformChange={setGamePlatform}
                platformOptions={platforms}
                startedAt={startedAtInput}
                onStartedAtChange={setStartedAtInput}
                completedAt={completedAtInput}
                onCompletedAtChange={setCompletedAtInput}
                disabled={saving}
              />
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
                  value={boardGameOwnershipFromBooleans(own, wantToBuy, sold)}
                  onChange={(mode) => {
                    const next = boardGameOwnershipToBooleans(mode);
                    setOwn(next.own);
                    setWantToBuy(next.wantToBuy);
                    setSold(next.sold);
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
                  disabled={saving}
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
            {showSaleAmountField && (
              <MoneyAmountInput
                label={t("money.saleProceeds")}
                currency={saleCurrency}
                onCurrencyChange={setSaleCurrency}
                amountMinor={saleAmountMinor}
                onAmountMinorChange={setSaleAmountMinor}
                disabled={saving}
                t={t}
                className="w-full max-w-full sm:max-w-md"
              />
            )}

            {hasPartialReviews && myLog && (
              <SavedTvReviewsSection
                log={myLog}
                scopedReviews={scopedReviews}
                mediaType={mediaType}
                showSeasonField={showSeasonField}
                disabled={saving}
                t={t}
                onLogUpdated={(log) => {
                  const decoded = decodeLogForDisplay(log);
                  setMyLog(decoded);
                  resetReviewDraft(decoded);
                  onSaved();
                }}
                onScopedReviewsChange={setScopedReviews}
              />
            )}

            <div className="w-full min-w-0 max-w-full">
              <Label className="mb-2 block text-sm font-medium text-[var(--color-lightest)]">
                {t("itemReviewForm.rating")}
              </Label>
              <StarRating
                value={stars}
                onChange={setStars}
                size="xl"
                fullWidth
                showGradeText={false}
                className="w-full"
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
          </motion.div>
        </form>
        </>
        ) : null}
        {itemMainTab !== "market" && (
        <motion.div whileTap={tapScale} transition={tapTransition} className="mt-4">
          {showBoardGameFields && itemMainTab === "matches" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="w-full sm:flex-1"
                disabled={saving}
                onClick={(e) => void handlePrimarySave(e)}
              >
                {saveButtonLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                disabled={saving}
                onClick={() => void handleSaveMatchAndShowBanner()}
              >
                {saving ? t("common.saving") : t("boardGameMatches.saveMatchAndShowBanner")}
              </Button>
            </div>
          ) : hasPartialReviews && itemMainTab === "review" ? (
            <ReviewPartialSaveButtons
              saving={saving}
              isUpdate={!!myLog}
              partialDisabled={!canSavePartialReview(mediaType, season, episode, showSeasonField)}
              onPartialSave={() => void handlePartialSave()}
              onPrimarySave={() => void handlePrimarySave()}
              t={t}
            />
          ) : (
            <Button
              type="button"
              className="w-full"
              disabled={saving}
              onClick={(e) => void handlePrimarySave(e)}
            >
              {saveButtonLabel}
            </Button>
          )}
        </motion.div>
        )}
      </Card>
    </motion.div>
  );
}
