import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ItemImage } from "@/components/ItemImage";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import type { MediaType, SearchResult } from "@geeklogs/shared";
import {
  MEDIA_TYPES,
  COMPLETED_STATUSES,
  LOG_STATUS_OPTIONS,
  SPEND_TRACKED_MEDIA_TYPES,
} from "@geeklogs/shared";
import { apiFetch, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { skipApiKeyMissingUi } from "@/lib/featureFlags";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { useLocale } from "@/contexts/LocaleContext";
import { getStatusLabel } from "@/lib/statusLabel";
import { Link } from "react-router-dom";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { Loader2, Upload, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { parseSheetFile, type ParsedRow, type SheetParseResult } from "@/lib/parseSheet";
import { resolveStatusFromSheet } from "@/lib/batchSheetStatusResolve";
import type { BoardGameOwnership } from "@/lib/boardGameOwnership";

const DELAY_BETWEEN_REQUESTS_MS = 350;

function getDefaultCompletedStatus(mediaType: MediaType): string {
  const options = LOG_STATUS_OPTIONS[mediaType];
  const completed = options.find((s) => (COMPLETED_STATUSES as readonly string[]).includes(s));
  return completed ?? options[0] ?? "completed";
}

/** Map sheet status cell to API value; accepts English + localized labels (en / pt-BR / es). */
function resolveRowStatus(row: ParsedRow, mediaType: MediaType, defaultStatus: string): string {
  return resolveStatusFromSheet(row.status, mediaType, defaultStatus);
}

type ExampleCellSpec =
  | { type: "i18n"; key: string }
  | { type: "status"; canonical: string }
  | { type: "listType"; value: "favorites" | "pending" }
  | { type: "ownership"; mode: BoardGameOwnership }
  | { type: "literal"; value: string };

function renderExampleCell(
  cell: ExampleCellSpec | undefined,
  mediaType: MediaType,
  t: (key: string, params?: Record<string, string>) => string
): string {
  if (!cell) return "";
  switch (cell.type) {
    case "i18n":
      return t(cell.key);
    case "status":
      return getStatusLabel(t, cell.canonical, mediaType);
    case "listType":
      return getStatusLabel(t, cell.value, null);
    case "ownership":
      switch (cell.mode) {
        case "doNotOwn":
          return t("itemReviewForm.doNotOwn");
        case "wantToBuy":
          return t("itemReviewForm.wantToBuy");
        case "own":
          return t("itemReviewForm.own");
        case "sold":
          return t("itemReviewForm.sold");
        default:
          return "";
      }
    case "literal":
      return cell.value;
    default:
      return "";
  }
}

function buildBatchLogBody(
  row: ParsedRow,
  mediaType: MediaType,
  hit: SearchResult,
  status: string,
  boardGameProvider: "bgg" | "ludopedia"
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    mediaType,
    externalId: hit.id,
    title: hit.title,
    image: hit.image ?? null,
    grade: row.grade ?? null,
    review: row.review?.trim() || null,
    status,
  };

  if (row.season != null) body.season = row.season;
  if (row.episode != null) body.episode = row.episode;
  if (row.chapter != null) body.chapter = row.chapter;
  if (row.volume != null) body.volume = row.volume;
  if (row.contentHours != null) body.contentHours = row.contentHours;
  if (row.hoursToBeat != null) body.hoursToBeat = row.hoursToBeat;
  if (row.listType != null) body.listType = row.listType;
  if (row.genres != null && row.genres.length > 0) body.genres = row.genres;
  if (mediaType === "boardgames" && row.mechanics != null && row.mechanics.length > 0) {
    body.mechanics = row.mechanics;
  }

  const spendTracked = (SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(mediaType);
  const hasSaleMoney = row.saleAmountMinor != null && row.saleCurrency != null;
  if (spendTracked) {
    if (row.own != null) body.own = row.own;
    if (row.wantToBuy != null) body.wantToBuy = row.wantToBuy;
    if (row.sold != null) body.sold = row.sold;
    else if (hasSaleMoney) body.sold = true;
    if (row.purchaseAmountMinor != null) body.purchaseAmountMinor = row.purchaseAmountMinor;
    if (row.purchaseCurrency != null) body.purchaseCurrency = row.purchaseCurrency;
    if (row.saleAmountMinor != null) body.saleAmountMinor = row.saleAmountMinor;
    if (row.saleCurrency != null) body.saleCurrency = row.saleCurrency;
  }

  if (mediaType === "boardgames") {
    if (row.matchesPlayed != null) body.matchesPlayed = row.matchesPlayed;
    body.boardGameSource = boardGameProvider === "ludopedia" ? "ludopedia" : "bgg";
  }

  return body;
}

type ExampleColId =
  | "name"
  | "status"
  | "review"
  | "rate"
  | "season"
  | "episode"
  | "chapter"
  | "volume"
  | "contentHours"
  | "hoursToBeat"
  | "ownership"
  | "matchesPlayed"
  | "purchaseAmount"
  | "purchaseCurrency"
  | "saleAmount"
  | "saleCurrency"
  | "listType"
  | "genres"
  | "mechanics";

const EXAMPLE_COLUMNS_BY_MEDIA: Record<MediaType, ExampleColId[]> = {
  movies: ["name", "status", "review", "rate", "listType", "genres"],
  tv: ["name", "status", "season", "episode", "contentHours", "review", "rate", "listType"],
  anime: ["name", "status", "season", "episode", "contentHours", "review", "rate", "listType"],
  books: ["name", "status", "chapter", "volume", "contentHours", "review", "rate", "listType"],
  manga: [
    "name",
    "status",
    "chapter",
    "volume",
    "contentHours",
    "ownership",
    "purchaseAmount",
    "purchaseCurrency",
    "review",
    "rate",
  ],
  comics: [
    "name",
    "status",
    "chapter",
    "volume",
    "contentHours",
    "ownership",
    "purchaseAmount",
    "purchaseCurrency",
    "review",
    "rate",
  ],
  games: [
    "name",
    "status",
    "hoursToBeat",
    "ownership",
    "purchaseAmount",
    "purchaseCurrency",
    "saleAmount",
    "saleCurrency",
    "review",
    "rate",
  ],
  boardgames: [
    "name",
    "status",
    "matchesPlayed",
    "ownership",
    "purchaseAmount",
    "purchaseCurrency",
    "mechanics",
    "review",
    "rate",
  ],
};

const EXAMPLE_HEADER_KEYS: Record<ExampleColId, string> = {
  name: "batchEntry.exampleColumnName",
  status: "batchEntry.exampleColumnStatus",
  review: "batchEntry.exampleColumnReview",
  rate: "batchEntry.exampleColumnRate",
  season: "batchEntry.exampleColumnSeason",
  episode: "batchEntry.exampleColumnEpisode",
  chapter: "batchEntry.exampleColumnChapter",
  volume: "batchEntry.exampleColumnVolume",
  contentHours: "batchEntry.exampleColumnContentHours",
  hoursToBeat: "batchEntry.exampleColumnHoursToBeat",
  ownership: "batchEntry.exampleColumnOwnership",
  matchesPlayed: "batchEntry.exampleColumnMatchesPlayed",
  purchaseAmount: "batchEntry.exampleColumnPurchaseAmount",
  purchaseCurrency: "batchEntry.exampleColumnPurchaseCurrency",
  saleAmount: "batchEntry.exampleColumnSaleAmount",
  saleCurrency: "batchEntry.exampleColumnSaleCurrency",
  listType: "batchEntry.exampleColumnListType",
  genres: "batchEntry.exampleColumnGenres",
  mechanics: "batchEntry.exampleColumnMechanics",
};

/** Two sample rows per category; cell text comes from locale strings + status/ownership labels. */
const EXAMPLE_ROW_SPECS: Record<MediaType, Array<Partial<Record<ExampleColId, ExampleCellSpec>>>> = {
  movies: [
    {
      name: { type: "i18n", key: "batchEntry.exMoviesR0Name" },
      status: { type: "status", canonical: "watched" },
      review: { type: "i18n", key: "batchEntry.exMoviesR0Review" },
      rate: { type: "literal", value: "9.5" },
      listType: { type: "listType", value: "favorites" },
      genres: { type: "i18n", key: "batchEntry.exMoviesR0Genres" },
    },
    {
      name: { type: "i18n", key: "batchEntry.exMoviesR1Name" },
      status: { type: "status", canonical: "plan to watch" },
      listType: { type: "listType", value: "pending" },
      genres: { type: "i18n", key: "batchEntry.exMoviesR1Genres" },
    },
  ],
  tv: [
    {
      name: { type: "i18n", key: "batchEntry.exTvR0Name" },
      status: { type: "status", canonical: "watching" },
      season: { type: "literal", value: "1" },
      episode: { type: "literal", value: "3" },
      contentHours: { type: "literal", value: "2.5" },
    },
    {
      name: { type: "i18n", key: "batchEntry.exTvR1Name" },
      status: { type: "status", canonical: "completed" },
      season: { type: "literal", value: "4" },
      episode: { type: "literal", value: "10" },
      contentHours: { type: "literal", value: "12" },
      review: { type: "i18n", key: "batchEntry.exTvR1Review" },
      rate: { type: "literal", value: "10" },
      listType: { type: "listType", value: "favorites" },
    },
  ],
  anime: [
    {
      name: { type: "i18n", key: "batchEntry.exAnimeR0Name" },
      status: { type: "status", canonical: "watching" },
      season: { type: "literal", value: "1" },
      episode: { type: "literal", value: "12" },
      contentHours: { type: "literal", value: "4" },
      rate: { type: "literal", value: "9" },
    },
    {
      name: { type: "i18n", key: "batchEntry.exAnimeR1Name" },
      status: { type: "status", canonical: "completed" },
      season: { type: "literal", value: "1" },
      episode: { type: "literal", value: "24" },
      contentHours: { type: "literal", value: "9.5" },
      review: { type: "i18n", key: "batchEntry.exAnimeR1Review" },
      rate: { type: "literal", value: "10" },
    },
  ],
  books: [
    {
      name: { type: "i18n", key: "batchEntry.exBooksR0Name" },
      status: { type: "status", canonical: "reading" },
      listType: { type: "listType", value: "pending" },
    },
    {
      name: { type: "i18n", key: "batchEntry.exBooksR1Name" },
      status: { type: "status", canonical: "completed" },
      chapter: { type: "literal", value: "48" },
      volume: { type: "literal", value: "1" },
      contentHours: { type: "literal", value: "11" },
      review: { type: "i18n", key: "batchEntry.exBooksR1Review" },
      rate: { type: "literal", value: "9" },
      listType: { type: "listType", value: "favorites" },
    },
  ],
  manga: [
    {
      name: { type: "i18n", key: "batchEntry.exMangaR0Name" },
      status: { type: "status", canonical: "reading" },
      chapter: { type: "literal", value: "1090" },
      ownership: { type: "ownership", mode: "own" },
      purchaseAmount: { type: "literal", value: "9.99" },
      purchaseCurrency: { type: "literal", value: "USD" },
      rate: { type: "literal", value: "8.5" },
    },
    {
      name: { type: "i18n", key: "batchEntry.exMangaR1Name" },
      status: { type: "status", canonical: "completed" },
      chapter: { type: "literal", value: "364" },
      volume: { type: "literal", value: "41" },
      ownership: { type: "ownership", mode: "wantToBuy" },
      review: { type: "i18n", key: "batchEntry.exMangaR1Review" },
      rate: { type: "literal", value: "10" },
    },
  ],
  comics: [
    {
      name: { type: "i18n", key: "batchEntry.exComicsR0Name" },
      status: { type: "status", canonical: "completed" },
      ownership: { type: "ownership", mode: "own" },
      purchaseAmount: { type: "literal", value: "24.99" },
      purchaseCurrency: { type: "literal", value: "USD" },
      rate: { type: "literal", value: "10" },
    },
    {
      name: { type: "i18n", key: "batchEntry.exComicsR1Name" },
      status: { type: "status", canonical: "reading" },
      volume: { type: "literal", value: "2" },
      contentHours: { type: "literal", value: "3" },
      ownership: { type: "ownership", mode: "doNotOwn" },
    },
  ],
  games: [
    {
      name: { type: "i18n", key: "batchEntry.exGamesR0Name" },
      status: { type: "status", canonical: "playing" },
      hoursToBeat: { type: "literal", value: "45" },
      ownership: { type: "ownership", mode: "own" },
      purchaseAmount: { type: "literal", value: "59.99" },
      purchaseCurrency: { type: "literal", value: "USD" },
      rate: { type: "literal", value: "10" },
    },
    {
      name: { type: "i18n", key: "batchEntry.exGamesR1Name" },
      status: { type: "status", canonical: "completed" },
      hoursToBeat: { type: "literal", value: "22.5" },
      ownership: { type: "ownership", mode: "sold" },
      saleAmount: { type: "literal", value: "19.99" },
      saleCurrency: { type: "literal", value: "USD" },
      review: { type: "i18n", key: "batchEntry.exGamesR1Review" },
      rate: { type: "literal", value: "9.5" },
    },
  ],
  boardgames: [
    {
      name: { type: "literal", value: "Wingspan" },
      status: { type: "status", canonical: "played" },
      matchesPlayed: { type: "literal", value: "8" },
      ownership: { type: "ownership", mode: "own" },
      purchaseAmount: { type: "literal", value: "4999" },
      purchaseCurrency: { type: "literal", value: "USD" },
      mechanics: { type: "i18n", key: "batchEntry.exBoardgamesR0Mechanics" },
      rate: { type: "literal", value: "9" },
    },
    {
      name: { type: "literal", value: "Ticket to Ride" },
      status: { type: "status", canonical: "plan to play" },
      matchesPlayed: { type: "literal", value: "0" },
      ownership: { type: "ownership", mode: "wantToBuy" },
    },
  ],
};

interface BatchEntryTabProps {
  /** When opened from a category tab (e.g. MediaLogs), preselect this category. */
  initialMediaType?: MediaType;
  onDone: () => void;
  onCancel: () => void;
  /** When true, buttons are not rendered here; parent should use onFooterChange to put them in DrawerFooter. */
  renderFooterOutside?: boolean;
  onFooterChange?: (footer: ReactNode) => void;
}

export function BatchEntryTab({ initialMediaType, onDone, onCancel, renderFooterOutside = false, onFooterChange }: BatchEntryTabProps) {
  const { t } = useLocale();
  const { token } = useAuth();
  const { me, loading: meLoading } = useMe();
  const boardGameProvider = me?.boardGameProvider ?? "bgg";

  const [mediaType, setMediaType] = useState<MediaType>(initialMediaType ?? "movies");
  const defaultStatus = getDefaultCompletedStatus(mediaType);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<SheetParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loadingParse, setLoadingParse] = useState(false);
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewRow, setPreviewRow] = useState<ParsedRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [failedReasons, setFailedReasons] = useState<Array<{ name: string; reason: string }>>([]);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [overrideExistingLogs, setOverrideExistingLogs] = useState(false);
  const previewLoadTriggeredRef = useRef(false);

  const exampleCols = EXAMPLE_COLUMNS_BY_MEDIA[mediaType];
  const exampleRows = useMemo(
    () =>
      EXAMPLE_ROW_SPECS[mediaType].map((specRow) => {
        const row: Partial<Record<ExampleColId, string>> = {};
        for (const colId of EXAMPLE_COLUMNS_BY_MEDIA[mediaType]) {
          const text = renderExampleCell(specRow[colId], mediaType, t);
          if (text !== "") row[colId] = text;
        }
        return row;
      }),
    [mediaType, t]
  );

  const apiKeyProvider = getApiKeyProviderForMediaType(mediaType, boardGameProvider);
  const hasBoardGameKey = !!(me?.apiKeys?.bgg || me?.apiKeys?.ludopedia);
  const hasApiKeyForCategory =
    skipApiKeyMissingUi(me, { token: !!token, meLoading }) ||
    (apiKeyProvider == null
      ? true
      : mediaType === "boardgames"
        ? hasBoardGameKey
        : !!(me?.apiKeys && me.apiKeys[apiKeyProvider]));
  const apiKeyRequiredMessage =
    mediaType === "boardgames"
      ? t("batchEntry.apiKeyRequiredBoardgames")
      : apiKeyProvider != null
        ? t("batchEntry.apiKeyRequired", {
            provider: API_KEY_META[apiKeyProvider].name,
          })
        : null;

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      setFile(f ?? null);
      setParseResult(null);
      setParseError(null);
      setPreviewResult(null);
      setPreviewRow(null);
      setFailedReasons([]);
      if (!f) return;
      setLoadingParse(true);
      try {
        const maxRows = me?.tier === "admin" ? Number.POSITIVE_INFINITY : 100;
        const result = await parseSheetFile(f, { maxRows });
        setParseResult(result);
        if (!result.ok) setParseError(result.error);
      } catch {
        setParseError(t("batchEntry.parseError"));
      } finally {
        setLoadingParse(false);
      }
    },
    [t, me?.tier]
  );

  const handleLoadPreview = useCallback(async () => {
    if (!parseResult?.ok || parseResult.rows.length === 0) return;
    const first = parseResult.rows[0];
    setPreviewRow(first);
    setLoadingPreview(true);
    setPreviewResult(null);
    try {
      const params = new URLSearchParams({
        type: mediaType,
        q: first.name,
      });
      if (mediaType === "boardgames" && boardGameProvider) {
        params.set("boardGameProvider", boardGameProvider);
      }
      const data = await apiFetch<{ results: SearchResult[] }>(`/search?${params.toString()}`);
      const results = data?.results ?? [];
      setPreviewResult(results[0] ?? null);
      if (results.length === 0) {
        showErrorToast(t, "E018", { interpolation: { name: first.name } });
      }
    } catch (err) {
      showErrorToast(t, "E019", { originalError: err });
    } finally {
      setLoadingPreview(false);
    }
  }, [parseResult, mediaType, boardGameProvider, t]);

  const handleConfirmAndAddAll = useCallback(async () => {
    if (!parseResult?.ok || parseResult.rows.length === 0) return;
    setConfirming(true);
    setBatchProgress({ current: 0, total: parseResult.rows.length });
    setFailedReasons([]);
    const reasons: Array<{ name: string; reason: string }> = [];
    let added = 0;
    for (let i = 0; i < parseResult.rows.length; i++) {
      setBatchProgress({ current: i + 1, total: parseResult.rows.length });
      const row = parseResult.rows[i];
      try {
        const params = new URLSearchParams({ type: mediaType, q: row.name });
        if (mediaType === "boardgames" && boardGameProvider) {
          params.set("boardGameProvider", boardGameProvider);
        }
        const data = await apiFetch<{ results: SearchResult[] }>(`/search?${params.toString()}`);
        const results = data?.results ?? [];
        const hit = results[0];
        if (hit) {
          if (!overrideExistingLogs) {
            const existingRes = await apiFetch<{ data: unknown[] }>(
              `/logs?mediaType=${encodeURIComponent(mediaType)}&externalId=${encodeURIComponent(hit.id)}&limit=1`
            );
            if (existingRes?.data?.length) {
              await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
              continue;
            }
          }
          const status = resolveRowStatus(row, mediaType, defaultStatus);
          const bgp = boardGameProvider === "ludopedia" ? "ludopedia" : "bgg";
          await apiFetch("/logs", {
            method: "POST",
            body: JSON.stringify(buildBatchLogBody(row, mediaType, hit, status, bgp)),
          });
          added++;
        } else {
          reasons.push({
            name: row.name,
            reason: t("batchEntry.noResultFor", { name: row.name }),
          });
        }
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === LOG_LIMIT_REACHED_CODE) {
          reasons.push({ name: row.name, reason: t("tiers.logLimitReached") });
          showErrorToast(t, "E011");
          break;
        }
        reasons.push({
          name: row.name,
          reason: msg || t("batchEntry.unknownError"),
        });
      }
    }
    setConfirming(false);
    setBatchProgress(null);
    setFailedReasons(reasons);
    invalidateLogsAndItemsCache();
    if (added > 0) {
      toast.success(t("batchEntry.addedCount", { count: String(added) }));
      onDone();
    }
    if (reasons.length > 0) {
      showErrorToast(t, "E020", { interpolation: { count: reasons.length } });
    }
  }, [parseResult, mediaType, boardGameProvider, overrideExistingLogs, defaultStatus, t, onDone]);

  const canPreview =
    hasApiKeyForCategory && parseResult?.ok && parseResult.rows.length > 0 && !loadingPreview;
  const previewReady = !!(previewRow && previewResult);

  const previewExtraLine = useMemo(() => {
    if (!previewRow) return null;
    const parts: string[] = [];
    const label = (colId: ExampleColId) => t(EXAMPLE_HEADER_KEYS[colId]);
    if (previewRow.season != null) parts.push(`${label("season")}: ${previewRow.season}`);
    if (previewRow.episode != null) parts.push(`${label("episode")}: ${previewRow.episode}`);
    if (previewRow.chapter != null) parts.push(`${label("chapter")}: ${previewRow.chapter}`);
    if (previewRow.volume != null) parts.push(`${label("volume")}: ${previewRow.volume}`);
    if (previewRow.contentHours != null) parts.push(`${label("contentHours")}: ${previewRow.contentHours}`);
    if (previewRow.hoursToBeat != null) parts.push(`${label("hoursToBeat")}: ${previewRow.hoursToBeat}`);
    if (previewRow.matchesPlayed != null) parts.push(`${label("matchesPlayed")}: ${previewRow.matchesPlayed}`);
    if (previewRow.own === true || previewRow.wantToBuy === true || previewRow.sold === true) {
      if (previewRow.sold === true) parts.push(`${label("ownership")}: sold`);
      else if (previewRow.wantToBuy === true) parts.push(`${label("ownership")}: ${t("itemReviewForm.wantToBuy")}`);
      else if (previewRow.own === true) parts.push(`${label("ownership")}: ${t("itemReviewForm.own")}`);
    }
    if (previewRow.purchaseAmountMinor != null && previewRow.purchaseCurrency) {
      parts.push(`${label("purchaseAmount")}: ${previewRow.purchaseAmountMinor} ${previewRow.purchaseCurrency}`);
    }
    if (previewRow.saleAmountMinor != null && previewRow.saleCurrency) {
      parts.push(`${label("saleAmount")}: ${previewRow.saleAmountMinor} ${previewRow.saleCurrency}`);
    }
    if (previewRow.listType != null) parts.push(`${label("listType")}: ${previewRow.listType}`);
    if (previewRow.genres?.length) parts.push(`${label("genres")}: ${previewRow.genres.join(", ")}`);
    if (previewRow.mechanics?.length) parts.push(`${label("mechanics")}: ${previewRow.mechanics.join(", ")}`);
    return parts.length ? parts.join(" · ") : null;
  }, [previewRow, t]);

  useEffect(() => {
    if (!parseResult?.ok) previewLoadTriggeredRef.current = false;
  }, [parseResult?.ok]);

  // Auto-load preview when file is parsed and we have API key
  useEffect(() => {
    if (!canPreview || loadingPreview || previewRow != null || confirming) return;
    if (previewLoadTriggeredRef.current) return;
    previewLoadTriggeredRef.current = true;
    handleLoadPreview();
  }, [canPreview, loadingPreview, previewRow, confirming, handleLoadPreview]);

  const batchFooterContent = useMemo(
    () => (
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={loadingParse || confirming}
        >
          {t("common.cancel")}
        </Button>
        {file && parseResult?.ok && (previewReady || confirming) ? (
          <Button
            type="button"
            className="flex-1"
            onClick={handleConfirmAndAddAll}
            disabled={!hasApiKeyForCategory || confirming}
          >
            {confirming ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                <span className="ml-2">{t("batchEntry.adding")}</span>
              </>
            ) : (
              t("batchEntry.startImport")
            )}
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1"
            onClick={() => document.getElementById("batch-file-input")?.click()}
            disabled={loadingParse || confirming || !hasApiKeyForCategory}
          >
            {loadingParse ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            <span className="ml-2">{file ? file.name : t("batchEntry.chooseFile")}</span>
          </Button>
        )}
      </div>
    ),
    [
      file,
      parseResult?.ok,
      previewReady,
      confirming,
      hasApiKeyForCategory,
      loadingParse,
      t,
      onCancel,
      handleConfirmAndAddAll,
    ]
  );

  useEffect(() => {
    if (renderFooterOutside && onFooterChange) {
      onFooterChange(batchFooterContent);
      return () => {
        onFooterChange(null);
      };
    }
  }, [renderFooterOutside, onFooterChange, batchFooterContent]);

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-[var(--color-lightest)]">
          {t("batchEntry.category")}
        </Label>
        <Select
          value={mediaType}
          onValueChange={(v) => {
            const type = v as MediaType;
            setMediaType(type);
            setPreviewResult(null);
            setPreviewRow(null);
          }}
          options={MEDIA_TYPES.map((type) => ({
            value: type,
            label: t(`nav.${type}`),
          }))}
          triggerClassName="w-full max-w-xs h-10"
          aria-label={t("batchEntry.category")}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="batch-override-existing"
          checked={overrideExistingLogs}
          onChange={(e) => setOverrideExistingLogs(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--color-mid)] bg-[var(--color-dark)] text-[var(--btn-gradient-start)] focus:ring-2 focus:ring-[var(--btn-gradient-start)]/50"
          aria-describedby="batch-override-existing-desc"
        />
        <Label htmlFor="batch-override-existing" className="cursor-pointer text-sm font-normal text-[var(--color-lightest)]">
          {t("batchEntry.overrideExistingLogs")}
        </Label>
      </div>
      <p id="batch-override-existing-desc" className="text-xs text-[var(--color-light)]">
        {t("batchEntry.overrideExistingLogsHint")}
      </p>

      {!hasApiKeyForCategory && apiKeyRequiredMessage && (
        <div
          className="flex flex-col gap-2 rounded-lg border border-[var(--color-warning)]/50 bg-[var(--color-warning)]/10 p-4 text-sm"
          role="alert"
        >
          <p className="text-[var(--color-lightest)]">{apiKeyRequiredMessage}</p>
          <Link
            to="/settings"
            className="inline-flex w-fit items-center font-medium text-[var(--btn-gradient-start)] hover:underline"
          >
            {t("apiKeyBanner.addKeyInSettings")} →
          </Link>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium text-[var(--color-lightest)]">
          {t("batchEntry.uploadFile")}
        </Label>
        <p className="text-xs text-[var(--color-light)]">
          {t("batchEntry.fileHint")}
        </p>
        <div className="rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setExampleOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/10 focus:outline-none"
            aria-expanded={exampleOpen}
          >
            {exampleOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {t("batchEntry.exampleFormatTitle")}
          </button>
          {exampleOpen && (
            <div className="border-t border-[var(--color-mid)]/20 px-3 py-3">
              <p className="mb-3 text-xs text-[var(--color-light)]">
                {t("batchEntry.exampleFormatIntro")}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-mid)]/30">
                      {exampleCols.map((colId) => (
                        <th
                          key={colId}
                          className="py-2 pr-3 text-left font-semibold text-[var(--color-lightest)] last:pr-0"
                        >
                          {t(EXAMPLE_HEADER_KEYS[colId])}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-[var(--color-light)]">
                    {exampleRows.map((row, i) => (
                      <tr
                        key={`example-${mediaType}-${i}`}
                        className={
                          i < exampleRows.length - 1
                            ? "border-b border-[var(--color-mid)]/20"
                            : ""
                        }
                      >
                        {exampleCols.map((colId) => (
                          <td key={colId} className="py-1.5 pr-3 align-top last:pr-0">
                            {row[colId] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-[var(--color-light)]">
                {t("batchEntry.exampleFormatNote")}
              </p>
            </div>
          )}
        </div>
        <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="batch-file-input"
          />
        {(file || parseResult?.ok) && (
          <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--color-light)]">
            {file && (
              <OverflowMarquee className="min-w-0 flex-1">{file.name}</OverflowMarquee>
            )}
            {parseResult?.ok && (
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
                {parseResult.rows.length} {t("batchEntry.rows")}
              </span>
            )}
          </div>
        )}
        {parseError && (
          <p className="text-sm text-red-400" role="alert">
            {parseError}
          </p>
        )}
      </div>

      {loadingPreview && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-light)]">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("batchEntry.matchingFirst")}
        </div>
      )}

      {previewRow && previewResult && !confirming && (
        <div className="rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-4">
          <p className="mb-3 text-xs font-medium text-[var(--color-light)]">
            {t("batchEntry.previewTitle")}
          </p>
          <div className="flex gap-4">
            <ItemImage
              src={previewResult.image}
              alt=""
              className="h-24 w-16 shrink-0 rounded object-cover"
              fitContent
              mediaType={mediaType}
              activeBoardGameProvider={mediaType === "boardgames" ? boardGameProvider : undefined}
            />
            <div className="min-w-0 flex-1">
              <OverflowMarquee className="font-medium text-[var(--color-lightest)]">
                {previewResult.title}
              </OverflowMarquee>
              <p className="mt-1 text-xs text-[var(--color-light)]">
                {getStatusLabel(t, resolveRowStatus(previewRow, mediaType, defaultStatus), mediaType)}
              </p>
              {previewRow.grade != null && (
                <div className="mt-1">
                  <StarRating value={gradeToStars(previewRow.grade)} readOnly size="sm" />
                </div>
              )}
              {previewRow.review && (
                <p className="mt-2 line-clamp-2 text-xs text-[var(--color-light)]">
                  {previewRow.review}
                </p>
              )}
              {previewExtraLine && (
                <p className="mt-2 line-clamp-3 text-[10px] leading-snug text-[var(--color-light)]">
                  {previewExtraLine}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {confirming && batchProgress && batchProgress.total > 0 && (
        <div className="flex flex-col gap-2" role="progressbar" aria-valuenow={batchProgress.current} aria-valuemin={0} aria-valuemax={batchProgress.total} aria-label={t("batchEntry.addingProgress", { current: String(batchProgress.current), total: String(batchProgress.total) })}>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-darkest)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] transition-all duration-300"
              style={{
                width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
              }}
            />
          </div>
          <p className="text-center text-sm font-medium text-[var(--color-lightest)]">
            {Math.round((batchProgress.current / batchProgress.total) * 100)}%
          </p>
        </div>
      )}

      {failedReasons.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="mb-2 text-sm font-medium text-red-400">
            {t("batchEntry.failedReasonsTitle", { count: String(failedReasons.length) })}
          </p>
          <ul className="max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-xs text-[var(--color-light)]">
            {failedReasons.map(({ name, reason }, idx) => (
              <li key={`${idx}-${name}`}>
                <span className="font-medium text-[var(--color-lightest)]">{name}</span>: {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!renderFooterOutside && batchFooterContent}
    </div>
  );
}

