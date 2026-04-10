import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { NumberCombobox } from "@/components/ui/number-combobox";
import type { MediaType, Log } from "@geeklogs/shared";
import { BoardGameMatchesSection } from "@/components/BoardGameMatchesSection";
import { cn } from "@/lib/utils";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, LOG_STATUS_OPTIONS } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { apiFetch, apiFetchCached, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { trackProductEvent } from "@/lib/productAnalytics";
import { showAchievementToasts, type NewBadge } from "@/lib/achievementToast";
import { triggerImpact } from "@/lib/capacitorHaptics";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { modalContentVariants } from "@/lib/animations";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { BoardGameOwnershipSwitch } from "@/components/BoardGameOwnershipSwitch";
import { MoneyAmountInput } from "@/components/MoneyAmountInput";
import { boardGameOwnershipFromBooleans, boardGameOwnershipToBooleans } from "@/lib/boardGameOwnership";
import {
  mediaTypeHasBoardGameOnlyFields,
  mediaTypeHasCollectionOwnership,
  mediaTypeHasPurchaseAmount,
} from "@/lib/mediaTypeFeatures";
import { DEFAULT_PURCHASE_CURRENCY, normalizeCurrencyCode } from "@/lib/currencies";

const HAS_SEASON_EPISODE: MediaType[] = ["tv", "anime"];
/** TV only; anime uses episode without season. */
const HAS_SEASON_FIELD: MediaType[] = ["tv"];
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
  /** Board games: open Matches tab first (e.g. list + button). */
  initialBoardGameTab?: "review" | "matches";
  /** Board games: after a match is saved/deleted, parent should refresh `log` (e.g. matchesPlayed). */
  onLogRefreshed?: (log: Log) => void;
  onSaved: (completion?: LogCompleteState) => void;
  onCancel: () => void;
  /** Called when user confirms delete; modal will close after. */
  onDelete?: (logId: string) => void | Promise<void>;
}

type LogFormProps = LogFormCreateProps | LogFormEditProps;

const toNum = (v: number | ""): number | null => (v === "" ? null : v);

export function LogForm(props: LogFormProps) {
  const { t } = useLocale();
  const { me, refetch: refetchMe } = useMe();
  const onCancel = props.onCancel;
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

  type ProgressOptions = {
    seasons?: number[];
    episodesBySeason?: Record<string, number[]>;
    episodes?: number[];
    chapters?: number[];
    volumes?: number[];
  };
  const [progressOptions, setProgressOptions] = useState<ProgressOptions | null>(null);
  const [progressOptionsLoading, setProgressOptionsLoading] = useState(false);
  const [boardMainTab, setBoardMainTab] = useState<"review" | "matches">("review");

  const statusOptions = LOG_STATUS_OPTIONS[mediaType];
  const showSeasonEpisode = HAS_SEASON_EPISODE.includes(mediaType);
  const showSeasonField = HAS_SEASON_FIELD.includes(mediaType);
  const showChapterVolume = HAS_CHAPTER_VOLUME.includes(mediaType);
  const showBoardGameFields = mediaTypeHasBoardGameOnlyFields(mediaType);
  const showCollectionOwnership = mediaTypeHasCollectionOwnership(mediaType);
  const showHoursToBeat = mediaType === "games";
  const showPurchaseAmount = mediaTypeHasPurchaseAmount(mediaType);
  /** Spend field when "Own" is selected; hidden for sold / wishlist / none. */
  const showPurchaseAmountField = showPurchaseAmount && (!showCollectionOwnership || own);
  const showSaleAmountField = showPurchaseAmount && (!showCollectionOwnership || sold);
  const showBoardGameTabs = isEdit && showBoardGameFields;
  const initialBoardGameTab = isEdit && "initialBoardGameTab" in props ? props.initialBoardGameTab : undefined;
  const onLogRefreshed = isEdit && "onLogRefreshed" in props ? props.onLogRefreshed : undefined;

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
  }, [isEdit, log?.id, log?.matchesPlayed, me?.defaultPurchaseCurrency, showBoardGameFields]);

  useEffect(() => {
    if (!showBoardGameTabs) return;
    setBoardMainTab(initialBoardGameTab ?? "review");
  }, [showBoardGameTabs, log?.id, initialBoardGameTab]);

  const title = isEdit ? log!.title : props.title;
  const image = isEdit ? (log!.image ?? null) : (props as LogFormCreateProps).image;

  const isDirty = useMemo(() => {
    if (isEdit && log) {
      const isInProgress = status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
      const grade = isInProgress ? null : (stars == null ? null : starsToGrade(stars));
      const isCompleted = status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
      const episodesCount = "episodesCount" in props ? props.episodesCount : undefined;
      const episodeForPayload =
        isCompleted && showSeasonEpisode && episodesCount != null && episodesCount > 0
          ? episodesCount
          : toNum(episode);
      const currentStatus = log.status ?? log.listType ?? null;
      const noChange =
        grade === (log.grade ?? null) &&
        (review.trim() || null) === (log.review ?? null) &&
        (status ?? null) === currentStatus &&
        toNum(season) === (log.season ?? null) &&
        episodeForPayload === (log.episode ?? null) &&
        toNum(chapter) === (log.chapter ?? null) &&
        toNum(volume) === (log.volume ?? null) &&
        (!showHoursToBeat || toNum(hoursToBeat) === (log.hoursToBeat ?? null)) &&
        (!showCollectionOwnership ||
          (own === (log.own ?? false) &&
            wantToBuy === (log.wantToBuy ?? false) &&
            sold === (log.sold ?? false))) &&
        (!showBoardGameFields || toNum(matchesPlayed) === (log.matchesPlayed ?? null)) &&
        (!showPurchaseAmount ||
          (() => {
            const includePurchase = !showCollectionOwnership || own;
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
    hoursToBeat,
    own,
    wantToBuy,
    sold,
    matchesPlayed,
    props,
    showSeasonEpisode,
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

  const performSave = useCallback(async (options?: { optimisticClose?: boolean }): Promise<boolean> => {
    const optimisticClose = options?.optimisticClose === true;
    const wasFirstLog = !isEdit && (me?.logCount ?? 0) === 0;
    const isInProgress = status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
    const grade = isInProgress ? null : (stars == null ? null : starsToGrade(stars));
    if (!optimisticClose) setLoading(true);
    try {
      if (isEdit && log) {
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
          payload.sold = sold;
        }
        if (showBoardGameFields && !(isEdit && mediaType === "boardgames")) {
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
          grade === (props.log.grade ?? null) &&
          (review.trim() || null) === (props.log.review ?? null) &&
          (status ?? null) === currentStatus &&
          toNum(season) === (props.log.season ?? null) &&
          episodeForPayload === (props.log.episode ?? null) &&
          toNum(chapter) === (props.log.chapter ?? null) &&
          toNum(volume) === (props.log.volume ?? null) &&
          (!showHoursToBeat || toNum(hoursToBeat) === (props.log.hoursToBeat ?? null)) &&
          (!showCollectionOwnership ||
            (own === (props.log.own ?? false) &&
              wantToBuy === (props.log.wantToBuy ?? false) &&
              sold === (props.log.sold ?? false))) &&
          (!showBoardGameFields ||
            (isEdit && mediaType === "boardgames") ||
            toNum(matchesPlayed) === (props.log.matchesPlayed ?? null)) &&
          (!showPurchaseAmount ||
            (() => {
              const includePurchase = !showCollectionOwnership || own;
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
          if (!optimisticClose) setLoading(false);
          onCancel();
          return true;
        }
        if (optimisticClose) {
          onCancel();
        }
        const updated = await apiFetch<Log & { newBadges?: NewBadge[] }>(
          `/logs/${props.log.id}`,
          { method: "PATCH", body: JSON.stringify(payload) }
        );
        if (updated.newBadges?.length) showAchievementToasts(updated.newBadges, t("dashboard.badgesAchievementUnlocked"));
        toast.success(t("toast.logUpdated"));
        triggerImpact("medium");
        invalidateLogsAndItemsCache();
        if (
          showPurchaseAmount &&
          (((!showCollectionOwnership || own) && purchaseAmountMinor != null) ||
            ((!showCollectionOwnership || sold) && saleAmountMinor != null))
        ) {
          void refetchMe();
        }
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
          props.onSaved(completion);
        } else {
          props.onSaved();
        }
        return true;
      }
      if (optimisticClose) {
        onCancel();
      }
      const created = await apiFetch<Log & { newBadges?: NewBadge[] }>(
        "/logs",
        {
          method: "POST",
          body: JSON.stringify({
            mediaType: (props as LogFormCreateProps).mediaType,
            externalId: (props as LogFormCreateProps).externalId,
            title: (props as LogFormCreateProps).title,
            image: image ?? null,
            grade,
            review,
            status: status ?? null,
            ...(showHoursToBeat && { hoursToBeat: toNum(hoursToBeat) }),
            ...(showCollectionOwnership && { own, wantToBuy, sold }),
            ...(showBoardGameFields && { matchesPlayed: toNum(matchesPlayed) }),
            ...(showPurchaseAmount &&
              (() => {
                const includePurchase = !showCollectionOwnership || own;
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
      if (created.newBadges?.length) showAchievementToasts(created.newBadges, t("dashboard.badgesAchievementUnlocked"));
      toast.success(t("toast.logSaved"));
      triggerImpact("medium");
      invalidateLogsAndItemsCache();
      if (
        showPurchaseAmount &&
        (((!showCollectionOwnership || own) && purchaseAmountMinor != null) ||
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
      props.onSaved(completion);
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
      if (!optimisticClose) setLoading(false);
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
    hoursToBeat,
    own,
    wantToBuy,
    sold,
    matchesPlayed,
    image,
    props,
    showSeasonEpisode,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSave();
  };

  const handleDrawerBeforeDismiss = useCallback(async (): Promise<boolean> => {
    if (!isDirty) return true;
    return performSave();
  }, [isDirty, performSave]);

  const handleDialogRequestClose = useCallback(() => {
    if (confirmDeleteOpen) return;
    if (!isDirty) {
      onCancel();
      return;
    }
    void performSave({ optimisticClose: true });
  }, [confirmDeleteOpen, isDirty, performSave, onCancel]);

  const boardGameTabBar =
    showBoardGameTabs && log ? (
      <div className="mb-3 flex gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-1">
        <button
          type="button"
          onClick={() => setBoardMainTab("review")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            boardMainTab === "review"
              ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
              : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
          )}
        >
          {t("boardGameMatches.tabReview")}
        </button>
        <button
          type="button"
          onClick={() => setBoardMainTab("matches")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            boardMainTab === "matches"
              ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
              : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
          )}
        >
          {t("boardGameMatches.tabMatches")}
        </button>
      </div>
    ) : null;

  const formContent = (
    <motion.div initial="initial" animate="animate" variants={modalContentVariants}>
      <div className="mb-4 flex min-w-0 gap-4">
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
      {boardGameTabBar}
      {showBoardGameTabs && boardMainTab === "matches" && log ? (
        <BoardGameMatchesSection
          logId={log.id}
          onLogUpdated={(lg) => {
            onLogRefreshed?.(lg);
          }}
        />
      ) : (
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
                        if (showBoardGameFields && !isEdit) {
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
      )}
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
            closeOnInteractOutside={!confirmDeleteOpen}
            mobileHeight="95%"
            className="flex max-h-[85dvh] w-full max-w-lg flex-col p-4 sm:p-6"
          >
            <div className="mt-6">{formContent}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open modal={false}>
          <DialogContent onClose={handleDialogRequestClose} closeOnInteractOutside={!confirmDeleteOpen}>
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
            <DialogTitle className="text-[var(--color-lightest)]">{t("common.delete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-light)]">
            {t("common.deleteLogConfirm")}
          </p>
          <div className="flex gap-2 sm:flex-row sm:justify-end">
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
