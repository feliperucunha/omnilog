import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import type { MediaType, Log, ScopedReview } from "@geeklogs/shared";
import { BoardGameMatchesSection } from "@/components/BoardGameMatchesSection";
import {
  canSavePartialReview,
  partialReviewSaveKind,
  resolvePartialReviewTarget,
  reviewDraftForSeasonEpisodeChange,
  savePartialScopedReview,
  showReviewDraftFromLog,
} from "@/lib/partialTvReview";
import { ReviewPartialSaveButtons } from "@/components/ReviewPartialSaveButtons";
import { SavedTvReviewsSection } from "@/components/SavedTvReviewsSection";
import { GameLogFields } from "@/components/GameLogFields";
import { ReadingProgressFields } from "@/components/ReadingProgressFields";
import { dateInputToIso, isoToDateInput } from "@/lib/readingDates";
import { cn } from "@/lib/utils";
import { COMPLETED_STATUSES, LOG_STATUS_OPTIONS } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { apiFetch, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { decodeLogForDisplay } from "@/lib/decodeDisplayFields";
import { useProgressOptions } from "@/hooks/useProgressOptions";
import { trackProductEvent } from "@/lib/productAnalytics";
import { triggerImpact } from "@/lib/capacitorHaptics";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { modalContentVariants } from "@/lib/animations";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import {
  episodeFieldUnchanged,
  episodePayloadValue,
  gradeForPayload,
  gradeStarsUnchanged,
  logDateInputMatchesStored,
} from "@/lib/logFormEquality";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { BoardGameOwnershipSwitch } from "@/components/BoardGameOwnershipSwitch";
import { MoneyAmountInput } from "@/components/MoneyAmountInput";
import { boardGameOwnershipFromBooleans, boardGameOwnershipToBooleans } from "@/lib/boardGameOwnership";
import {
  mediaTypeHasBoardGameOnlyFields,
  mediaTypeHasCollectionOwnership,
  mediaTypeHasMarketTab,
  mediaTypeHasPurchaseAmount,
  spendFieldsIncludePurchase,
} from "@/lib/mediaTypeFeatures";
import { MarketListingSection } from "@/components/MarketListingSection";
import { DEFAULT_PURCHASE_CURRENCY, normalizeCurrencyCode } from "@/lib/currencies";

const HAS_SEASON_EPISODE: MediaType[] = ["tv", "anime"];
/** TV only; anime uses episode without season. */
const HAS_SEASON_FIELD: MediaType[] = ["tv"];
const HAS_CHAPTER_VOLUME: MediaType[] = ["comics", "manga"];
const HAS_READING_PROGRESS: MediaType[] = ["books", "manga", "comics"];
const HAS_GAME_LOG_FIELDS: MediaType[] = ["games"];

interface LogFormCreateProps {
  mode: "create";
  mediaType: MediaType;
  externalId: string;
  title: string;
  image: string | null;
  onSaved: (completion?: LogCompleteState, savedLog?: Log) => void;
  onCancel: () => void;
}

interface LogFormEditProps {
  mode: "edit";
  log: Log;
  /** TV/Anime: total episodes (set episode to this when user selects completed status). */
  episodesCount?: number | null;
  /** Board games / market: open a specific tab first (e.g. matches from list +). */
  initialBoardGameTab?: "review" | "matches" | "market";
  /** Board games: after a match is saved/deleted, parent should refresh `log` (e.g. matchesPlayed). */
  onLogRefreshed?: (log: Log) => void;
  /** Games: platform names from item detail (console picker suggestions). */
  platforms?: string[] | null;
  onSaved: (completion?: LogCompleteState, savedLog?: Log) => void;
  onCancel: () => void;
  /** Called when user confirms delete; modal will close after. */
  onDelete?: (logId: string) => void | Promise<void>;
}

type LogFormProps = LogFormCreateProps | LogFormEditProps;

const toNum = (v: number | ""): number | null => (v === "" ? null : v);

function logFromApiResponse(res: Log & { newBadges?: unknown[] }): Log {
  const { newBadges: _nb, ...rest } = res;
  void _nb;
  return rest;
}

export function LogForm(props: LogFormProps) {
  const { t } = useLocale();
  const { me, refetch: refetchMe } = useMe();
  const onCancel = props.onCancel;
  const isEdit = props.mode === "edit";
  const log = isEdit ? props.log : null;
  const mediaType = isEdit ? (log!.mediaType as MediaType) : (props as LogFormCreateProps).mediaType;

  const [stars, setStars] = useState<number | null>(
    isEdit ? (log!.grade != null ? gradeToStars(log!.grade) : null) : null
  );
  const [review, setReview] = useState(isEdit ? (log!.review ?? "") : "");
  const [status, setStatus] = useState<string | null>(
    isEdit ? (log!.status ?? log!.listType ?? null) : LOG_STATUS_OPTIONS[(props as LogFormCreateProps).mediaType][0]
  );
  const [season, setSeason] = useState<number | "">(isEdit ? (log!.season ?? "") : "");
  const [episode, setEpisode] = useState<number | "">(isEdit ? (log!.episode ?? "") : "");
  const [chapter, setChapter] = useState<number | "">(isEdit ? (log!.chapter ?? "") : "");
  const [volume, setVolume] = useState<number | "">(isEdit ? (log!.volume ?? "") : "");
  const [pagesRead, setPagesRead] = useState<number | "">(isEdit ? (log!.pagesRead ?? "") : "");
  const [gamePlatform, setGamePlatform] = useState(isEdit ? (log!.gamePlatform ?? "") : "");
  const [startedAtInput, setStartedAtInput] = useState(isEdit ? isoToDateInput(log!.startedAt) : "");
  const [completedAtInput, setCompletedAtInput] = useState(isEdit ? isoToDateInput(log!.completedAt) : "");
  const [hoursToBeat, setHoursToBeat] = useState<number | "">(isEdit ? (log!.hoursToBeat ?? "") : "");
  const [own, setOwn] = useState(isEdit ? (log!.own ?? false) : false);
  const [wantToBuy, setWantToBuy] = useState(isEdit ? (log!.wantToBuy ?? false) : false);
  const [sold, setSold] = useState(isEdit ? (log!.sold ?? false) : false);
  const [matchesPlayed, setMatchesPlayed] = useState<number | "">(
    isEdit
      ? (log!.matchesPlayed ?? (log!.status === "played" ? 1 : mediaType === "boardgames" ? 0 : ""))
      : (mediaType === "boardgames" ? 1 : "")
  );
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const isMobile = useIsMobile();
  const cancellingRef = useRef(false);
  const drawerRequestCloseRef = useRef<(() => void) | null>(null);
  const prevSeasonEpisodeRef = useRef<{ season: number | ""; episode: number | "" } | null>(null);

  const [itemMainTab, setItemMainTab] = useState<"review" | "matches" | "market">("review");
  const [scopedReviews, setScopedReviews] = useState<ScopedReview[]>([]);

  const statusOptions = LOG_STATUS_OPTIONS[mediaType];
  const showSeasonEpisode = HAS_SEASON_EPISODE.includes(mediaType);
  const showSeasonField = HAS_SEASON_FIELD.includes(mediaType);
  const showChapterVolume = HAS_CHAPTER_VOLUME.includes(mediaType);
  const showReadingProgress = HAS_READING_PROGRESS.includes(mediaType);
  const showGameLogFields = HAS_GAME_LOG_FIELDS.includes(mediaType);
  const platformOptions =
    isEdit && "platforms" in props ? (props.platforms ?? null) : null;
  const showBoardGameFields = mediaTypeHasBoardGameOnlyFields(mediaType);
  const showMarketTab = mediaTypeHasMarketTab(mediaType);
  const showCollectionOwnership = mediaTypeHasCollectionOwnership(mediaType);
  const showHoursToBeat = mediaType === "games";
  const showPurchaseAmount = mediaTypeHasPurchaseAmount(mediaType);
  /** Purchase price when owned or sold (kept with sale proceeds for balance). Hidden for wishlist / none. */
  const showPurchaseAmountField =
    showPurchaseAmount && spendFieldsIncludePurchase(showCollectionOwnership, own, sold);
  const showSaleAmountField = showPurchaseAmount && (!showCollectionOwnership || sold);
  const showItemTabs = isEdit && (showBoardGameFields || showMarketTab);
  const hasPartialReviews = isEdit && showSeasonEpisode;
  const initialBoardGameTab = isEdit && "initialBoardGameTab" in props ? props.initialBoardGameTab : undefined;
  const onLogRefreshed = isEdit && "onLogRefreshed" in props ? props.onLogRefreshed : undefined;
  const progressExternalId = isEdit ? log?.externalId : (props as LogFormCreateProps).externalId;
  const { progressOptions, progressOptionsLoading } = useProgressOptions(
    mediaType,
    progressExternalId,
    showSeasonEpisode || showChapterVolume
  );

  const [purchaseCurrency, setPurchaseCurrency] = useState(
    () =>
      isEdit && log?.purchaseCurrency
        ? (normalizeCurrencyCode(log.purchaseCurrency) ?? DEFAULT_PURCHASE_CURRENCY)
        : DEFAULT_PURCHASE_CURRENCY
  );
  const [purchaseAmountMinor, setPurchaseAmountMinor] = useState<number | null>(
    () => (isEdit && log?.purchaseAmountMinor != null ? log.purchaseAmountMinor : null)
  );
  const [saleCurrency, setSaleCurrency] = useState(
    () =>
      isEdit && log?.saleCurrency
        ? (normalizeCurrencyCode(log.saleCurrency) ?? DEFAULT_PURCHASE_CURRENCY)
        : DEFAULT_PURCHASE_CURRENCY
  );
  const [saleAmountMinor, setSaleAmountMinor] = useState<number | null>(
    () => (isEdit && log?.saleAmountMinor != null ? log.saleAmountMinor : null)
  );

  useEffect(() => {
    const d = normalizeCurrencyCode(me?.defaultPurchaseCurrency);
    if (!isEdit) {
      if (d) {
        setPurchaseCurrency(d);
        setSaleCurrency(d);
      }
      return;
    }
    if (!d) return;
    if (!normalizeCurrencyCode(log?.purchaseCurrency)) {
      setPurchaseCurrency(d);
    }
    if (!normalizeCurrencyCode(log?.saleCurrency)) {
      setSaleCurrency(d);
    }
  }, [isEdit, log?.purchaseCurrency, log?.saleCurrency, log?.id, me?.defaultPurchaseCurrency]);

  useEffect(() => {
    if (isEdit && log) {
      if (hasPartialReviews) {
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
      setHoursToBeat(log.hoursToBeat ?? "");
      setOwn(log.own ?? false);
      setWantToBuy(log.wantToBuy ?? false);
      setSold(log.sold ?? false);
      const defaultMatches = showBoardGameFields
        ? (log.status === "played" ? 1 : log.status === "plan to play" ? 0 : "")
        : "";
      setMatchesPlayed(log.matchesPlayed ?? defaultMatches);
      setPurchaseCurrency(
        normalizeCurrencyCode(log.purchaseCurrency) ??
          normalizeCurrencyCode(me?.defaultPurchaseCurrency) ??
          DEFAULT_PURCHASE_CURRENCY
      );
      setPurchaseAmountMinor(log.purchaseAmountMinor ?? null);
      setSaleCurrency(
        normalizeCurrencyCode(log.saleCurrency) ??
          normalizeCurrencyCode(me?.defaultPurchaseCurrency) ??
          DEFAULT_PURCHASE_CURRENCY
      );
      setSaleAmountMinor(log.saleAmountMinor ?? null);
    }
  }, [isEdit, log?.id, log?.matchesPlayed, me?.defaultPurchaseCurrency, showBoardGameFields, hasPartialReviews]);

  useEffect(() => {
    if (!showItemTabs) {
      setItemMainTab("review");
      return;
    }
    setItemMainTab(initialBoardGameTab ?? "review");
  }, [showItemTabs, log?.id, initialBoardGameTab]);

  useEffect(() => {
    if (!hasPartialReviews || !log?.id) {
      setScopedReviews([]);
      return;
    }
    apiFetch<{ data: ScopedReview[] }>(`/logs/${log.id}/scoped-reviews`)
      .then((res) => setScopedReviews(res.data ?? []))
      .catch(() => setScopedReviews([]));
  }, [hasPartialReviews, log?.id]);

  useEffect(() => {
    prevSeasonEpisodeRef.current = null;
  }, [log?.id, mediaType]);

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
      log ?? null
    );
    setStars(draft.stars);
    setReview(draft.review);
  }, [season, episode, hasPartialReviews, mediaType, showSeasonField, log]);

  const resetReviewDraft = useCallback(
    (source: Log | null | undefined = log) => {
      if (!hasPartialReviews || !source) {
        setStars(null);
        setReview("");
        return;
      }
      const draft = showReviewDraftFromLog(source);
      setStars(draft.stars);
      setReview(draft.review);
    },
    [hasPartialReviews, log]
  );

  const clearReviewDraft = useCallback(() => {
    resetReviewDraft(log);
  }, [resetReviewDraft, log]);

  const title = isEdit ? log!.title : props.title;
  const image = isEdit ? (log!.image ?? null) : (props as LogFormCreateProps).image;

  const isDirty = useMemo(() => {
    if (isEdit && log) {
      const currentStatus = log.status ?? log.listType ?? null;
      const noChange =
        gradeStarsUnchanged(stars, log.grade) &&
        (review.trim() || null) === (log.review ?? null) &&
        (status ?? null) === currentStatus &&
        toNum(season) === (log.season ?? null) &&
        episodeFieldUnchanged(episode, log.episode) &&
        toNum(chapter) === (log.chapter ?? null) &&
        toNum(volume) === (log.volume ?? null) &&
        (!showReadingProgress ||
          (toNum(pagesRead) === (log.pagesRead ?? null) &&
            logDateInputMatchesStored(log.startedAt, startedAtInput) &&
            logDateInputMatchesStored(log.completedAt, completedAtInput))) &&
        (!showGameLogFields ||
          ((gamePlatform.trim() || null) === (log.gamePlatform ?? null) &&
            logDateInputMatchesStored(log.startedAt, startedAtInput) &&
            logDateInputMatchesStored(log.completedAt, completedAtInput))) &&
        (!showHoursToBeat || toNum(hoursToBeat) === (log.hoursToBeat ?? null)) &&
        (!showCollectionOwnership ||
          (own === (log.own ?? false) &&
            wantToBuy === (log.wantToBuy ?? false) &&
            sold === (log.sold ?? false))) &&
        (!showBoardGameFields || toNum(matchesPlayed) === (log.matchesPlayed ?? null)) &&
        (!showPurchaseAmount ||
          (() => {
            const includePurchase = spendFieldsIncludePurchase(showCollectionOwnership, own, sold);
            if (!includePurchase) {
              return (log.purchaseAmountMinor ?? null) == null;
            }
            return (
              purchaseAmountMinor === (log.purchaseAmountMinor ?? null) &&
              (purchaseCurrency || DEFAULT_PURCHASE_CURRENCY) ===
                (log.purchaseCurrency ?? DEFAULT_PURCHASE_CURRENCY)
            );
          })()) &&
        (!showPurchaseAmount ||
          (() => {
            const includeSale = !showCollectionOwnership || sold;
            if (!includeSale) {
              return (log.saleAmountMinor ?? null) == null;
            }
            return (
              saleAmountMinor === (log.saleAmountMinor ?? null) &&
              (saleCurrency || DEFAULT_PURCHASE_CURRENCY) === (log.saleCurrency ?? DEFAULT_PURCHASE_CURRENCY)
            );
          })());
      return !noChange;
    }
    const p = props as LogFormCreateProps;
    const defaultStatus = LOG_STATUS_OPTIONS[p.mediaType][0];
    const defaultMatches = p.mediaType === "boardgames" ? 1 : "";
    return (
      stars !== null ||
      review.trim() !== "" ||
      (status ?? null) !== defaultStatus ||
      season !== "" ||
      episode !== "" ||
      chapter !== "" ||
      volume !== "" ||
      (showReadingProgress && (pagesRead !== "" || startedAtInput !== "" || completedAtInput !== "")) ||
      (showGameLogFields && (gamePlatform.trim() !== "" || startedAtInput !== "" || completedAtInput !== "")) ||
      (showHoursToBeat && hoursToBeat !== "") ||
      (showCollectionOwnership && (own || wantToBuy || sold)) ||
      (showBoardGameFields &&
        toNum(matchesPlayed) !== (typeof defaultMatches === "number" ? defaultMatches : null)) ||
      (showPurchaseAmountField && purchaseAmountMinor != null) ||
      (showSaleAmountField && saleAmountMinor != null)
    );
  }, [
    isEdit,
    log,
    stars,
    review,
    status,
    season,
    episode,
    chapter,
    volume,
    pagesRead,
    startedAtInput,
    completedAtInput,
    hoursToBeat,
    own,
    wantToBuy,
    sold,
    matchesPlayed,
    props,
    showSeasonEpisode,
    showReadingProgress,
    showGameLogFields,
    gamePlatform,
    showHoursToBeat,
    showCollectionOwnership,
    showBoardGameFields,
    showPurchaseAmount,
    showPurchaseAmountField,
    showSaleAmountField,
    purchaseAmountMinor,
    purchaseCurrency,
    saleAmountMinor,
    saleCurrency,
  ]);

  const performSave = useCallback(
    async (options?: {
      optimisticClose?: boolean;
      quiet?: boolean;
      skipCancelIfUnchanged?: boolean;
    }): Promise<boolean> => {
    const optimisticClose = options?.optimisticClose === true;
    const quiet = options?.quiet === true;
    const skipCancelIfUnchanged = options?.skipCancelIfUnchanged === true;
    const wasFirstLog = !isEdit && (me?.logCount ?? 0) === 0;
    const grade = gradeForPayload(stars);
    if (!optimisticClose && !quiet) setLoading(true);
    try {
      if (isEdit && log) {
        const episodesCount = "episodesCount" in props ? props.episodesCount : undefined;
        const episodeForPayload = episodePayloadValue(
          episode,
          status,
          episodesCount,
          showSeasonEpisode
        );
        const payload: Record<string, unknown> = {
          grade,
          review: review.trim() || null,
          status: status || null,
          season: toNum(season),
          episode: episodeForPayload,
          chapter: toNum(chapter),
          volume: toNum(volume),
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
        const currentStatus = props.log.status ?? props.log.listType ?? null;
        const statusChanged = (status ?? null) !== currentStatus;
        const noChange =
          gradeStarsUnchanged(stars, props.log.grade) &&
          (review.trim() || null) === (props.log.review ?? null) &&
          (status ?? null) === currentStatus &&
          toNum(season) === (props.log.season ?? null) &&
          episodeFieldUnchanged(episode, props.log.episode) &&
          toNum(chapter) === (props.log.chapter ?? null) &&
          toNum(volume) === (props.log.volume ?? null) &&
          (!showReadingProgress ||
            (toNum(pagesRead) === (props.log.pagesRead ?? null) &&
              logDateInputMatchesStored(props.log.startedAt, startedAtInput) &&
              logDateInputMatchesStored(props.log.completedAt, completedAtInput))) &&
          (!showGameLogFields ||
            ((gamePlatform.trim() || null) === (props.log.gamePlatform ?? null) &&
              logDateInputMatchesStored(props.log.startedAt, startedAtInput) &&
              logDateInputMatchesStored(props.log.completedAt, completedAtInput))) &&
          (!showHoursToBeat || toNum(hoursToBeat) === (props.log.hoursToBeat ?? null)) &&
          (!showCollectionOwnership ||
            (own === (props.log.own ?? false) &&
              wantToBuy === (props.log.wantToBuy ?? false) &&
              sold === (props.log.sold ?? false))) &&
          (!showBoardGameFields ||
            toNum(matchesPlayed) === (props.log.matchesPlayed ?? null)) &&
          (!showPurchaseAmount ||
            (() => {
              const includePurchase = spendFieldsIncludePurchase(showCollectionOwnership, own, sold);
              if (!includePurchase) {
                return (props.log.purchaseAmountMinor ?? null) == null;
              }
              return (
                purchaseAmountMinor === (props.log.purchaseAmountMinor ?? null) &&
                (purchaseCurrency || DEFAULT_PURCHASE_CURRENCY) ===
                  (props.log.purchaseCurrency ?? DEFAULT_PURCHASE_CURRENCY)
              );
            })()) &&
          (!showPurchaseAmount ||
            (() => {
              const includeSale = !showCollectionOwnership || sold;
              if (!includeSale) {
                return (props.log.saleAmountMinor ?? null) == null;
              }
              return (
                saleAmountMinor === (props.log.saleAmountMinor ?? null) &&
                (saleCurrency || DEFAULT_PURCHASE_CURRENCY) ===
                  (props.log.saleCurrency ?? DEFAULT_PURCHASE_CURRENCY)
              );
            })());
        if (noChange) {
          if (!optimisticClose && !quiet) setLoading(false);
          if (!skipCancelIfUnchanged) {
            onCancel();
          }
          return true;
        }
        if (optimisticClose) {
          onCancel();
        }
        const updated = await apiFetch<Log & { newBadges?: unknown[] }>(
          `/logs/${props.log.id}`,
          { method: "PATCH", body: JSON.stringify(payload) }
        );
        toast.success(t("toast.logUpdated"));
        triggerImpact("medium");
        invalidateLogsAndItemsCache();
        if (
          showPurchaseAmount &&
          ((spendFieldsIncludePurchase(showCollectionOwnership, own, sold) && purchaseAmountMinor != null) ||
            ((!showCollectionOwnership || sold) && saleAmountMinor != null))
        ) {
          void refetchMe();
        }
        const savedLog = logFromApiResponse(updated);
        if (hasPartialReviews) resetReviewDraft(savedLog);
        if (statusChanged) {
          const completion: LogCompleteState = {
            image,
            title,
            grade: grade ?? null,
            status: status ?? undefined,
            mediaType: props.log.mediaType as MediaType,
            id: props.log.externalId,
            review: review.trim() || null,
            ...(showCollectionOwnership && { own, wantToBuy, sold }),
            ...(showBoardGameFields && {
              matchesPlayed:
                isEdit && mediaType === "boardgames"
                  ? (updated.matchesPlayed ?? null)
                  : toNum(matchesPlayed),
            }),
          };
          props.onSaved(completion, savedLog);
        } else {
          props.onSaved(undefined, savedLog);
        }
        return true;
      }
      if (optimisticClose) {
        onCancel();
      }
      const created = await apiFetch<Log & { newBadges?: unknown[] }>(
        "/logs",
        {
          method: "POST",
          body: JSON.stringify({
            mediaType: (props as LogFormCreateProps).mediaType,
            externalId: (props as LogFormCreateProps).externalId,
            title: (props as LogFormCreateProps).title,
            image: image ?? null,
            grade,
            review: review.trim() || null,
            status: status ?? null,
            ...(showReadingProgress && {
              pagesRead: toNum(pagesRead),
              startedAt: startedAtInput.trim() ? dateInputToIso(startedAtInput) : null,
              completedAt: completedAtInput.trim() ? dateInputToIso(completedAtInput) : null,
            }),
            ...(showGameLogFields && {
              gamePlatform: gamePlatform.trim() || null,
              startedAt: startedAtInput.trim() ? dateInputToIso(startedAtInput) : null,
              completedAt: completedAtInput.trim() ? dateInputToIso(completedAtInput) : null,
            }),
            ...(showHoursToBeat && { hoursToBeat: toNum(hoursToBeat) }),
            ...(showCollectionOwnership && { own, wantToBuy, sold }),
            ...(showBoardGameFields && { matchesPlayed: toNum(matchesPlayed) }),
            ...(showPurchaseAmount &&
              (() => {
                const includePurchase = spendFieldsIncludePurchase(showCollectionOwnership, own, sold);
                const includeSale = !showCollectionOwnership || sold;
                const purchasePart =
                  !includePurchase || purchaseAmountMinor == null
                    ? { purchaseAmountMinor: null, purchaseCurrency: null }
                    : {
                        purchaseAmountMinor,
                        purchaseCurrency: purchaseCurrency || DEFAULT_PURCHASE_CURRENCY,
                      };
                const salePart =
                  !includeSale || saleAmountMinor == null
                    ? { saleAmountMinor: null, saleCurrency: null }
                    : {
                        saleAmountMinor,
                        saleCurrency: saleCurrency || DEFAULT_PURCHASE_CURRENCY,
                      };
                return { ...purchasePart, ...salePart };
              })()),
          }),
        }
      );
      toast.success(t("toast.logSaved"));
      triggerImpact("medium");
      invalidateLogsAndItemsCache();
      if (
        showPurchaseAmount &&
        ((spendFieldsIncludePurchase(showCollectionOwnership, own, sold) && purchaseAmountMinor != null) ||
          ((!showCollectionOwnership || sold) && saleAmountMinor != null))
      ) {
        void refetchMe();
      }
      if (wasFirstLog) trackProductEvent("first_log_created");
      const completion: LogCompleteState = {
        image,
        title,
        grade: grade ?? null,
        status: status ?? undefined,
        mediaType: (props as LogFormCreateProps).mediaType,
        id: (props as LogFormCreateProps).externalId,
        review: review.trim() || null,
        ...(showCollectionOwnership && { own, wantToBuy, sold }),
        ...(showBoardGameFields && { matchesPlayed: toNum(matchesPlayed) }),
      };
      props.onSaved(completion, logFromApiResponse(created));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === LOG_LIMIT_REACHED_CODE) {
        showErrorToast(t, "E011");
      } else {
        showErrorToast(t, "E013", { originalError: err });
      }
      return false;
    } finally {
      if (!optimisticClose && !quiet) setLoading(false);
    }
  }, [
    isEdit,
    log,
    me?.logCount,
    status,
    stars,
    review,
    season,
    episode,
    chapter,
    volume,
    pagesRead,
    startedAtInput,
    completedAtInput,
    hoursToBeat,
    own,
    wantToBuy,
    sold,
    matchesPlayed,
    image,
    props,
    showSeasonEpisode,
    showSeasonField,
    hasPartialReviews,
    resetReviewDraft,
    clearReviewDraft,
    showReadingProgress,
    showGameLogFields,
    gamePlatform,
    showHoursToBeat,
    showCollectionOwnership,
    showBoardGameFields,
    showPurchaseAmount,
    purchaseAmountMinor,
    purchaseCurrency,
    saleAmountMinor,
    saleCurrency,
    refetchMe,
    t,
    onCancel,
  ]);

  const handlePartialSave = async () => {
    if (!log || !canSavePartialReview(mediaType, season, episode, showSeasonField)) return;
    const target = resolvePartialReviewTarget(mediaType, season, episode, showSeasonField);
    if (!target) return;
    setLoading(true);
    try {
      await savePartialScopedReview(log.id, target, stars, review);
      const res = await apiFetch<{ data: ScopedReview[] }>(`/logs/${log.id}/scoped-reviews`);
      setScopedReviews(res.data ?? []);
      clearReviewDraft();
      toast.success(t("toast.reviewSaved"));
      invalidateLogsAndItemsCache();
      props.onSaved(undefined, log);
    } catch (err) {
      showErrorToast(t, "E012", { originalError: err });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemMainTab === "market") return;
    await performSave();
  };

  const saveButtonLabel =
    loading || deleting
      ? t("common.saving")
      : showBoardGameFields && itemMainTab === "matches"
        ? t("boardGameMatches.saveMatch")
        : t("common.save");

  const showReviewPartialFooter = hasPartialReviews && itemMainTab === "review";

  const handleDrawerBeforeDismiss = useCallback(async (): Promise<boolean> => {
    if (cancellingRef.current) return true;
    if (!isDirty) return true;
    void performSave({ quiet: true, skipCancelIfUnchanged: true });
    return true;
  }, [isDirty, performSave]);

  const handleDrawerCancel = useCallback(() => {
    cancellingRef.current = true;
    const requestClose = drawerRequestCloseRef.current;
    if (requestClose) {
      requestClose();
      return;
    }
    onCancel();
  }, [onCancel]);

  const handleDialogRequestClose = useCallback(() => {
    if (confirmDeleteOpen) return;
    if (cancellingRef.current) {
      onCancel();
      return;
    }
    if (!isDirty) {
      onCancel();
      return;
    }
    void performSave({ optimisticClose: true });
  }, [confirmDeleteOpen, isDirty, performSave, onCancel]);

  const handleDialogCancel = useCallback(() => {
    cancellingRef.current = true;
    onCancel();
  }, [onCancel]);

  const itemTabBar =
    showItemTabs && log ? (
      <div className="mb-3 flex gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-1">
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
      </div>
    ) : null;

  const formContent = (
    <motion.div initial="initial" animate="animate" variants={modalContentVariants}>
      <div className="mb-4 flex min-w-0 items-center gap-4">
        <ItemImage
          src={image}
          className="h-20 w-14 shrink-0 rounded"
          mediaType={mediaType}
          boardGameSource={isEdit ? log?.boardGameSource : undefined}
          activeBoardGameProvider={!isEdit && mediaType === "boardgames" ? (me?.boardGameProvider ?? null) : undefined}
        />
        <div
          role="heading"
          aria-level={3}
          className="min-w-0 flex-1 truncate text-lg font-semibold text-[var(--color-lightest)]"
          title={title}
        >
          {title}
        </div>
      </div>
      {itemTabBar}
      {showMarketTab && log && (
        <div className={cn(itemMainTab !== "market" && "hidden")} aria-hidden={itemMainTab !== "market"}>
          <MarketListingSection
            mediaType={mediaType}
            externalId={log.externalId}
            title={title}
            image={image}
            myLog={log}
            onEnsureLog={async () => log}
            onListed={onCancel}
          />
        </div>
      )}
      {showBoardGameFields && itemMainTab === "matches" && log ? (
        <BoardGameMatchesSection
          logId={log.id}
          onLogUpdated={(lg) => {
            onLogRefreshed?.(lg);
          }}
          onMatchSaved={(savedLog) => {
            props.onSaved(undefined, savedLog);
          }}
        />
      ) : itemMainTab !== "market" ? (
      <>
      <form id="log-form" onSubmit={handleSubmit}>
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
                          if (next === "played") {
                            setMatchesPlayed((prev) => {
                              if (!isEdit) return 1;
                              if (prev === "" || prev === 0) return 1;
                              return prev;
                            });
                          } else if (!isEdit && next === "plan to play") {
                            setMatchesPlayed(0);
                          }
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
                            dropdownInPortal
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
                          dropdownInPortal
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
                      pagesCount={isEdit ? log?.pagesCount ?? null : null}
                      startedAt={startedAtInput}
                      onStartedAtChange={setStartedAtInput}
                      completedAt={completedAtInput}
                      onCompletedAtChange={setCompletedAtInput}
                      disabled={loading}
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
              {showGameLogFields && (
                <GameLogFields
                  gamePlatform={gamePlatform}
                  onGamePlatformChange={setGamePlatform}
                  platformOptions={platformOptions}
                  startedAt={startedAtInput}
                  onStartedAtChange={setStartedAtInput}
                  completedAt={completedAtInput}
                  onCompletedAtChange={setCompletedAtInput}
                  disabled={loading}
                />
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
                    value={boardGameOwnershipFromBooleans(own, wantToBuy, sold)}
                    onChange={(mode) => {
                      const next = boardGameOwnershipToBooleans(mode);
                      setOwn(next.own);
                      setWantToBuy(next.wantToBuy);
                      setSold(next.sold);
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
                    disabled={loading || deleting}
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
                  disabled={loading || deleting}
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
                  disabled={loading || deleting}
                  t={t}
                  className="w-full max-w-full sm:max-w-md"
                />
              )}
              {hasPartialReviews && log && (
                <SavedTvReviewsSection
                  log={log}
                  scopedReviews={scopedReviews}
                  mediaType={mediaType}
                  showSeasonField={showSeasonField}
                  disabled={loading || deleting}
                  t={t}
                  onLogUpdated={(updated) => {
                    const decoded = decodeLogForDisplay(updated);
                    onLogRefreshed?.(decoded);
                    resetReviewDraft(decoded);
                  }}
                  onScopedReviewsChange={setScopedReviews}
                />
              )}
              <div>
                <Label className="mb-1 block text-sm font-medium text-[var(--color-lightest)]">
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
                  placeholder={t("logForm.reviewPlaceholder")}
                  value={review ?? ""}
                  onChange={(e) => setReview(e.target.value)}
                  rows={4}
                  className="min-h-[80px]"
                />
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
          </form>
      </>
      ) : null}
    </motion.div>
  );

  return (
    <>
      {isMobile ? (
        <Drawer
          open
          modal={false}
          onOpenChange={(open) => !open && !confirmDeleteOpen && onCancel()}
        >
          <DrawerContent
            onClose={onCancel}
            onBeforeDismiss={handleDrawerBeforeDismiss}
            onReady={(requestClose) => {
              drawerRequestCloseRef.current = requestClose;
            }}
            closeOnInteractOutside={!confirmDeleteOpen}
            mobileHeight="95%"
            className="flex max-h-[85dvh] w-full max-w-lg flex-col p-4 sm:p-6"
          >
            <div className="mt-6">{formContent}</div>
            {!(showBoardGameFields && itemMainTab === "matches") && itemMainTab !== "market" && (
              <DrawerFooter>
                <div
                  className={
                    showReviewPartialFooter
                      ? "flex w-full flex-col gap-2 sm:flex-row sm:gap-3"
                      : "flex w-full gap-3"
                  }
                >
                  {showReviewPartialFooter ? (
                    <>
                      <ReviewPartialSaveButtons
                        saving={loading || deleting}
                        isUpdate={isEdit}
                        partialSaveKind={partialReviewSaveKind(mediaType, season, episode, showSeasonField)}
                        onPartialSave={() => void handlePartialSave()}
                        onPrimarySave={() =>
                          void handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                        }
                        t={t}
                        className="order-1 sm:order-2 sm:min-w-0 sm:flex-[2]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="order-2 w-full sm:order-1 sm:flex-1"
                        onClick={handleDrawerCancel}
                        disabled={loading || deleting}
                      >
                        {t("common.cancel")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleDrawerCancel}
                        disabled={loading || deleting}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        disabled={loading || deleting}
                        onClick={() =>
                          void handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                        }
                      >
                        {saveButtonLabel}
                      </Button>
                    </>
                  )}
                </div>
              </DrawerFooter>
            )}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open modal={false}>
          <DialogContent
            onClose={handleDialogRequestClose}
            closeOnInteractOutside={!confirmDeleteOpen}
            className="flex flex-col gap-0 sm:max-h-[90vh]"
          >
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">{formContent}</div>
            {!(showBoardGameFields && itemMainTab === "matches") && itemMainTab !== "market" && (
              <DialogFooter className="mt-4">
                <div
                  className={
                    showReviewPartialFooter
                      ? "flex w-full flex-col gap-2 sm:flex-row sm:gap-3"
                      : "flex w-full gap-3"
                  }
                >
                  {showReviewPartialFooter ? (
                    <>
                      <ReviewPartialSaveButtons
                        saving={loading || deleting}
                        isUpdate={isEdit}
                        partialSaveKind={partialReviewSaveKind(mediaType, season, episode, showSeasonField)}
                        onPartialSave={() => void handlePartialSave()}
                        onPrimarySave={() =>
                          void handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                        }
                        t={t}
                        className="order-1 sm:order-2 sm:min-w-0 sm:flex-[2]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="order-2 w-full sm:order-1 sm:flex-1"
                        onClick={handleDialogCancel}
                        disabled={loading || deleting}
                      >
                        {t("common.cancel")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleDialogCancel}
                        disabled={loading || deleting}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        disabled={loading || deleting}
                        onClick={() =>
                          void handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                        }
                      >
                        {saveButtonLabel}
                      </Button>
                    </>
                  )}
                </div>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm delete: in-app modal above the edit dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={(open) => !open && setConfirmDeleteOpen(false)}>
        <DialogContent
          variant="compact"
          className="z-[60] sm:max-w-sm"
          overlayClassName="z-[60]"
          onClose={() => setConfirmDeleteOpen(false)}
        >
          <DialogHeader className="text-left">
            <DialogTitle className="text-[var(--color-lightest)]">{t("common.delete")}</DialogTitle>
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
