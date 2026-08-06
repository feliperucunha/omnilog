import type { CSSProperties } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { MotionLink } from "@/components/MotionLink";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookPagesBadge } from "@/components/BookPagesBadge";
import { DaysSinceBadge } from "@/components/DaysSinceBadge";
import { GenreBadges } from "@/components/GenreBadges";
import { ItemImage } from "@/components/ItemImage";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { StarRating } from "@/components/StarRating";
import type { LogViewMode } from "@/lib/logViewPreference";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { formatLogScopeLabel, getLogCardDisplay } from "@/lib/logDisplay";
import { logStatusBadgeClass, logStatusRailClass, getSeriesAirState } from "@/lib/logStatusColors";
import { gradeToStars } from "@/lib/gradeStars";
import {
  LOG_CARD_ACTION_COLUMN,
  LOG_CARD_ACTION_COLUMN_GRID,
  LOG_CARD_BODY_GAP,
  LOG_CARD_BODY_GAP_GRID,
  LOG_CARD_BODY_PADDING,
  LOG_CARD_BODY_PADDING_GRID,
  LOG_CARD_EDIT_BUTTON,
  LOG_CARD_EDIT_BUTTON_GRID,
  LOG_CARD_HEIGHT_DEFAULT,
  LOG_CARD_HEIGHT_EMBEDDED,
  LOG_CARD_HEIGHT_EMBEDDED_COLLAPSED,
  LOG_CARD_HEIGHT_EMBEDDED_GRID_COLLAPSED,
  LOG_CARD_IMAGE_COLUMN,
  LOG_CARD_IMAGE_COLUMN_GRID,
  LOG_CARD_INCREMENT_BUTTON,
  LOG_CARD_INCREMENT_BUTTON_GRID,
  LOG_CARD_REVIEW_MAX_WIDTH,
  LOG_CARD_TITLE,
  LOG_CARD_TITLE_GRID,
} from "@/lib/logCardLayout";
import { itemDetailPath } from "@/lib/itemRoutes";
import { getStatusLabel } from "@/lib/statusLabel";
import { formatBoardGameWeight } from "@/lib/boardGameWeight";
import { tapScale, tapTransition } from "@/lib/animations";
import type { MediaType, Log } from "@geeklogs/shared";
import { COMPLETED_STATUSES } from "@geeklogs/shared";
import { cn } from "@/lib/utils";
import type { TFunction } from "@/contexts/LocaleContext";

const cardShadow: CSSProperties = { boxShadow: "var(--shadow-card)" };

const SCORE_SOURCE_LABELS: Partial<Record<MediaType, string>> = {
  movies: "IMDB",
  tv: "IMDB",
  anime: "MAL",
  manga: "MAL",
  games: "RAWG",
};

const EPISODE_TYPES: MediaType[] = ["tv", "anime"];
const CHAPTER_TYPES: MediaType[] = ["manga", "comics"];
const VOLUME_TYPES: MediaType[] = ["books", "boardgames"];

const REVIEW_PREVIEW_LENGTH = 120;

const DENSE_INCREMENT_BUTTON =
  "flex h-8 min-w-8 items-center justify-center gap-0.5 rounded-lg border-0 bg-[var(--color-darkest)] px-1.5 shadow-[var(--shadow-sm)] transition-[transform,box-shadow] hover:scale-[1.04] hover:shadow-[var(--shadow-md)] active:scale-[0.98] disabled:scale-100 disabled:opacity-50 [@media(hover:hover)]:hover:bg-[var(--btn-gradient-start)]";

function getProgress(log: Log): { field: "episode" | "chapter" | "volume"; value: number; labelKey: string } {
  if (EPISODE_TYPES.includes(log.mediaType))
    return { field: "episode", value: log.episode ?? 0, labelKey: "itemReviewForm.episode" };
  if (CHAPTER_TYPES.includes(log.mediaType))
    return { field: "chapter", value: log.chapter ?? 0, labelKey: "itemReviewForm.chapter" };
  return { field: "volume", value: log.volume ?? 0, labelKey: "itemReviewForm.volume" };
}

function showIncrementForLog(log: Log, mediaType: MediaType, hasProgressButton: boolean): boolean {
  if (!hasProgressButton) return false;
  if (log.status != null && (COMPLETED_STATUSES as readonly string[]).includes(log.status)) return false;
  return EPISODE_TYPES.includes(mediaType) || CHAPTER_TYPES.includes(mediaType) || VOLUME_TYPES.includes(mediaType);
}

function listBorderClass(log: Log, compact: boolean): string {
  if (compact) return "border border-[var(--color-mid)]/25";
  return logStatusRailClass(log.status);
}

function statusBadgeClass(log: Log): string {
  return logStatusBadgeClass(log.status);
}

export type MediaLogCardProps = {
  log: Log;
  embedded: boolean;
  readOnly: boolean;
  view: LogViewMode;
  mediaType: MediaType;
  showCollectionOwnershipFilters: boolean;
  hasProgressButton: boolean;
  deletingId: string | null;
  incrementingId: string | null;
  expandedReviewLogId: string | null;
  onExpandReview: (logId: string | null) => void;
  onIncrement: (log: Log) => void;
  onEdit: (log: Log, tab: "review" | "matches") => void;
  t: TFunction;
};

function LogImageOverlays({
  log,
  t,
  compact,
  grid,
}: {
  log: Log;
  t: TFunction;
  compact: boolean;
  grid: boolean;
}) {
  const sourceLabel = SCORE_SOURCE_LABELS[log.mediaType];
  const showScore = sourceLabel != null && typeof log.apiScore === "number" && log.apiScore > 0;
  const weightLabel =
    log.mediaType === "boardgames" && log.averageWeight != null && log.averageWeight > 0
      ? formatBoardGameWeight(log.averageWeight)
      : null;
  const showWeight = weightLabel != null;
  const badge = statusBadgeClass(log);
  const pos = compact
    ? "top-1 right-1 text-[8px] sm:text-[9px]"
    : grid
      ? "top-1 right-1 text-[8px] sm:text-[9px]"
      : "top-1 right-1 sm:top-1.5 sm:right-1.5 text-[9px] sm:text-[10px]";

  return (
    <>
      {showScore && (
        <span
          className={cn(
            "absolute z-10 rounded bg-black/75 px-1 py-0.5 font-semibold text-yellow-300 backdrop-blur-sm whitespace-nowrap",
            pos
          )}
          title={`${sourceLabel} ${log.apiScore!.toFixed(1)} / 10`}
        >
          {sourceLabel} {log.apiScore!.toFixed(1)}
        </span>
      )}
      {!showScore && showWeight && (
        <span
          className={cn(
            "absolute z-10 rounded bg-black/75 px-1 py-0.5 font-semibold text-yellow-300 backdrop-blur-sm whitespace-nowrap",
            pos
          )}
          title={weightLabel!}
        >
          {weightLabel}
        </span>
      )}
      {log.status && (
        <span
          className={cn(
            "absolute bottom-1 right-1 z-10 rounded px-1 py-0.5 font-medium sm:bottom-1.5 sm:right-1.5",
            compact ? "text-[8px] sm:text-[9px]" : grid ? "max-w-[calc(100%-0.25rem)] truncate text-[8px] md:bottom-0.5 md:right-0.5 md:px-1 md:py-px md:text-[7px]" : "text-[9px] sm:text-[10px] whitespace-nowrap",
            !grid && "whitespace-nowrap",
            badge
          )}
          title={getStatusLabel(t, log.status, log.mediaType)}
        >
          {getStatusLabel(t, log.status, log.mediaType)}
        </span>
      )}
    </>
  );
}

function LogMetaRow({
  log,
  display,
  scopeLabel,
  mediaType,
  showCollectionOwnershipFilters,
  t,
  compact,
  grid,
}: {
  log: Log;
  display: ReturnType<typeof getLogCardDisplay>;
  scopeLabel: string | null;
  mediaType: MediaType;
  showCollectionOwnershipFilters: boolean;
  t: TFunction;
  compact: boolean;
  grid: boolean;
}) {
  const badgeSize = compact
    ? "rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-mid)]/20 px-1.5 py-px text-[8px] font-medium text-[var(--color-lightest)] whitespace-nowrap sm:text-[9px]"
    : grid
      ? "max-w-[5rem] truncate rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-mid)]/20 px-1.5 py-px text-[8px] font-medium text-[var(--color-lightest)] md:max-w-[4.25rem]"
      : "rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-mid)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--color-lightest)] whitespace-nowrap";
  const textSize = compact ? "text-[8px] sm:text-[9px]" : grid ? "max-w-[5rem] truncate text-[8px] md:max-w-[4.25rem]" : "text-[10px] sm:text-xs";
  const tvBadgeSize =
    compact || grid
      ? "max-w-[4.25rem] truncate rounded-full px-1.5 py-px text-[8px] font-medium whitespace-nowrap sm:text-[9px]"
      : "rounded-full px-1.5 py-px text-[8px] font-medium whitespace-nowrap sm:text-[9px]";
  const useCompactBadges = compact || grid;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center",
        compact ? "gap-1" : grid ? "gap-0.5 overflow-hidden md:max-h-[2.35rem]" : "gap-1 gap-2 text-xs sm:text-sm"
      )}
    >
      {display.grade != null ? (
        <StarRating
          value={gradeToStars(display.grade)}
          readOnly
          size="sm"
          className={grid ? "shrink-0 origin-left scale-[0.88]" : undefined}
        />
      ) : (
        <span className={cn("text-[var(--color-light)]", grid && "text-[8px]")}>—</span>
      )}
      {scopeLabel ? <span className={badgeSize}>{scopeLabel}</span> : null}
      <GenreBadges genres={log.genres} maxCount={1} compact={useCompactBadges} />
      {(log.mediaType === "tv" || log.mediaType === "movies" || log.mediaType === "anime") && log.networks?.[0] && (
        <span className={cn(badgeSize, "border-0 bg-[var(--color-mid)]/30")}>{log.networks[0]}</span>
      )}
      {log.mediaType === "tv" && (() => {
        const air = getSeriesAirState(log.tvStatus);
        if (air === "ongoing") {
          return (
            <span className={cn(tvBadgeSize, "border border-amber-400/30 bg-amber-500/20 text-amber-200")}>
              {t("mediaLogs.tvOngoing")}
            </span>
          );
        }
        if (air === "ended") {
          return (
            <span className={cn(tvBadgeSize, "border border-emerald-500/30 bg-emerald-600/20 text-emerald-200")}>
              {t("mediaLogs.tvEnded")}
            </span>
          );
        }
        return null;
      })()}
      {log.mediaType === "books" && (
        <BookPagesBadge
          pagesCount={log.pagesCount}
          className={useCompactBadges ? "max-w-[4.25rem] truncate px-1.5 py-px text-[8px]" : undefined}
        />
      )}
      {log.mediaType === "boardgames" && (() => {
        const min = typeof log.playersMin === "number" && log.playersMin > 0 ? log.playersMin : null;
        const max = typeof log.playersMax === "number" && log.playersMax > 0 ? log.playersMax : null;
        return (
          <>
            {min != null || max != null ? (
              <span className={badgeSize}>
                {min != null && max != null && min !== max
                  ? t("mediaLogs.boardgamePlayersBadgeRange", { min: String(min), max: String(max) })
                  : t("mediaLogs.boardgamePlayersBadgeSingle", { count: String(min ?? max) })}
              </span>
            ) : null}
            <DaysSinceBadge updatedAt={log.updatedAt} />
          </>
        );
      })()}
      {(() => {
        const duration = log.startedAt && log.completedAt ? formatTimeToFinish(log.startedAt, log.completedAt) : "";
        return duration ? (
          <span className={cn(textSize, "text-[var(--color-light)]")}>{t("dashboard.finishedIn", { duration })}</span>
        ) : null;
      })()}
      {showCollectionOwnershipFilters &&
        (log.own === true ||
          log.wantToBuy === true ||
          (mediaType === "boardgames" && log.matchesPlayed != null && log.matchesPlayed > 0)) && (
          <>
            {log.own === true && <span className={cn(textSize, "text-[var(--color-light)]")}>{t("itemReviewForm.own")}</span>}
            {log.wantToBuy === true && (
              <span className={cn(textSize, "text-[var(--color-light)]")}>{t("itemReviewForm.wantToBuy")}</span>
            )}
            {mediaType === "boardgames" && log.matchesPlayed != null && log.matchesPlayed > 0 && (
              <span className={cn(textSize, "text-[var(--color-light)]")}>
                {t("itemReviewForm.matchesPlayed")}: {log.matchesPlayed}
              </span>
            )}
          </>
        )}
    </div>
  );
}

function LogProgressLine({
  log,
  hasProgressButton,
  t,
  compact,
  grid,
  className,
}: {
  log: Log;
  hasProgressButton: boolean;
  t: TFunction;
  compact: boolean;
  grid: boolean;
  className?: string;
}) {
  const isCompleted = log.status != null && (COMPLETED_STATUSES as readonly string[]).includes(log.status);
  if (!hasProgressButton || isCompleted) return null;

  const isEpisodeMedia = (EPISODE_TYPES as readonly MediaType[]).includes(log.mediaType);
  if (isEpisodeMedia) {
    const seasonValue = log.season ?? 0;
    const episodeValue = log.episode ?? 0;
    if (episodeValue <= 0 && seasonValue <= 0) return null;
    const label =
      seasonValue > 0
        ? t("mediaLogs.tvSeasonEpisode", { season: String(seasonValue), episode: String(episodeValue) })
        : t("mediaLogs.tvEpisodeOnly", { episode: String(episodeValue) });
    return (
      <span className={cn("text-[var(--color-light)] whitespace-nowrap", compact || grid ? "text-[9px] sm:text-[10px]" : "text-xs", className)}>
        {label}
      </span>
    );
  }
  const p = getProgress(log);
  return (
    <span className={cn("text-[var(--color-light)]", compact || grid ? "text-[9px] sm:text-[10px]" : "text-xs", className)}>
      {t(p.labelKey)}: {p.value}
    </span>
  );
}

function LogReviewBlock({
  log,
  display,
  embedded,
  compact,
  grid,
  expandedReviewLogId,
  onExpandReview,
  t,
}: {
  log: Log;
  display: ReturnType<typeof getLogCardDisplay>;
  embedded: boolean;
  compact: boolean;
  grid: boolean;
  expandedReviewLogId: string | null;
  onExpandReview: (logId: string | null) => void;
  t: TFunction;
}) {
  if (!display.review) {
    if (compact || grid) return null;
    return <span className="invisible text-xs sm:text-sm line-clamp-2">—</span>;
  }

  const review = display.review;
  const isExpanded = expandedReviewLogId === log.id;
  const truncated = review.length > REVIEW_PREVIEW_LENGTH;
  const preview = truncated && !isExpanded ? review.slice(0, REVIEW_PREVIEW_LENGTH) : review;
  const showClamp = (embedded || compact || grid) && truncated && !isExpanded;
  const reviewClass = compact ? "text-[9px] sm:text-[10px]" : grid ? "text-[10px] md:text-[9px]" : "text-xs sm:text-sm";

  return (
    <>
      <div
        className={cn(
          "w-full min-w-0",
          showClamp ? (grid ? "line-clamp-1" : "line-clamp-2") : "",
          !compact && !grid && LOG_CARD_REVIEW_MAX_WIDTH
        )}
      >
        <p className={cn(reviewClass, "text-[var(--color-light)] whitespace-pre-wrap break-words")}>
          {preview}
          {truncated && !isExpanded && " ... "}
        </p>
      </div>
      {truncated && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto shrink-0 p-0 text-[10px] text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 md:text-[9px] sm:text-xs"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onExpandReview(isExpanded ? null : log.id);
          }}
        >
          {isExpanded ? t("social.viewLess") : t("social.viewMore")}
        </Button>
      )}
    </>
  );
}

function LogActions({
  log,
  readOnly,
  view,
  mediaType,
  hasProgressButton,
  deletingId,
  incrementingId,
  onIncrement,
  onEdit,
  t,
}: {
  log: Log;
  readOnly: boolean;
  view: LogViewMode;
  mediaType: MediaType;
  hasProgressButton: boolean;
  deletingId: string | null;
  incrementingId: string | null;
  onIncrement: (log: Log) => void;
  onEdit: (log: Log, tab: "review" | "matches") => void;
  t: TFunction;
}) {
  if (readOnly) return null;

  const showIncrement = showIncrementForLog(log, mediaType, hasProgressButton);
  const showMatch = mediaType === "boardgames" && log.status != null;

  if (view === "compact") {
    return (
      <div className="flex shrink-0 items-center justify-end gap-1 border-t border-[var(--color-surface-border)]/80 p-1.5">
        {showIncrement && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onIncrement(log);
            }}
            disabled={incrementingId === log.id || deletingId === log.id}
            aria-label={t("mediaLogs.addOne")}
            className={DENSE_INCREMENT_BUTTON}
          >
            {incrementingId === log.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-lightest)]" aria-hidden />
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--color-lightest)]" aria-hidden />
                <span className="text-[10px] font-semibold tabular-nums text-[var(--color-lightest)]">1</span>
              </>
            )}
          </button>
        )}
        {showMatch && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(log, "matches");
            }}
            disabled={deletingId === log.id}
            aria-label={t("mediaLogs.addMatch")}
            className={DENSE_INCREMENT_BUTTON}
          >
            <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--color-lightest)]" aria-hidden />
          </button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-[var(--color-light)] hover:bg-[var(--color-mid)]/40 hover:text-[var(--color-lightest)]"
          onClick={() => onEdit(log, "review")}
          disabled={deletingId === log.id}
          aria-label={t("common.edit")}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    );
  }

  const isGrid = view === "grid";

  return (
    <div className={isGrid ? LOG_CARD_ACTION_COLUMN_GRID : LOG_CARD_ACTION_COLUMN}>
      {showIncrement && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onIncrement(log);
          }}
          disabled={incrementingId === log.id || deletingId === log.id}
          aria-label={t("mediaLogs.addOne")}
          className={isGrid ? LOG_CARD_INCREMENT_BUTTON_GRID : LOG_CARD_INCREMENT_BUTTON}
        >
          {incrementingId === log.id ? (
            <Loader2 className={cn("animate-spin text-[var(--color-lightest)]", isGrid ? "h-3.5 w-3.5 md:h-3 md:w-3" : "h-4 w-4")} aria-hidden />
          ) : (
            <>
              <Plus className={cn("shrink-0 text-[var(--color-lightest)]", isGrid ? "h-3.5 w-3.5 md:h-3 md:w-3" : "h-4 w-4")} aria-hidden />
              <span className={cn("font-semibold tabular-nums text-[var(--color-lightest)]", isGrid ? "text-[10px] md:text-[9px]" : "text-xs")}>1</span>
            </>
          )}
        </button>
      )}
      {showMatch && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit(log, "matches");
          }}
          disabled={deletingId === log.id}
          aria-label={t("mediaLogs.addMatch")}
          className={isGrid ? LOG_CARD_INCREMENT_BUTTON_GRID : LOG_CARD_INCREMENT_BUTTON}
        >
          <Plus className={cn("shrink-0 text-[var(--color-lightest)]", isGrid ? "h-3.5 w-3.5 md:h-3 md:w-3" : "h-4 w-4")} aria-hidden />
        </button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          isGrid ? LOG_CARD_EDIT_BUTTON_GRID : LOG_CARD_EDIT_BUTTON,
          "text-[var(--color-light)] hover:bg-[var(--color-mid)]/40 hover:text-[var(--color-lightest)] transition-colors"
        )}
        onClick={() => onEdit(log, "review")}
        disabled={deletingId === log.id}
        aria-label={t("common.edit")}
      >
        <Pencil className={cn(isGrid ? "h-3.5 w-3.5 md:h-3 md:w-3" : "h-4 w-4")} aria-hidden />
      </Button>
    </div>
  );
}

export function MediaLogCard({
  log,
  embedded,
  readOnly,
  view,
  mediaType,
  showCollectionOwnershipFilters,
  hasProgressButton,
  deletingId,
  incrementingId,
  expandedReviewLogId,
  onExpandReview,
  onIncrement,
  onEdit,
  t,
}: MediaLogCardProps) {
  const display = getLogCardDisplay(log);
  const scopeLabel = formatLogScopeLabel(t, display);
  const isReviewExpanded = embedded && expandedReviewLogId === log.id;
  const isCompact = view === "compact";
  const isGrid = view === "grid";
  const borderClass = listBorderClass(log, isCompact);

  if (isCompact) {
    return (
      <Card
        className={cn(
          "relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-[var(--color-dark)] p-0",
          borderClass,
          isReviewExpanded && "row-span-2"
        )}
        style={cardShadow}
      >
        {!readOnly && deletingId === log.id && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0D1B2A]/70">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-light)]" />
          </div>
        )}
        <MotionLink
          to={itemDetailPath(log.mediaType, log.externalId)}
          whileTap={tapScale}
          transition={tapTransition}
          className="relative block w-full shrink-0 overflow-hidden aspect-[2/3]"
        >
          <ItemImage
            src={log.image}
            className="h-full w-full"
            mediaType={log.mediaType}
            boardGameSource={log.boardGameSource}
          />
          <LogImageOverlays log={log} t={t} compact grid={false} />
        </MotionLink>
        <div className="flex min-h-0 flex-1 flex-col gap-1 p-2">
          <MotionLink
            to={itemDetailPath(log.mediaType, log.externalId)}
            whileTap={tapScale}
            transition={tapTransition}
            className="block min-w-0 font-semibold text-[var(--color-lightest)] no-underline hover:underline"
          >
            <OverflowMarquee className="text-xs leading-snug">{log.title}</OverflowMarquee>
          </MotionLink>
          <LogMetaRow
            log={log}
            display={display}
            scopeLabel={scopeLabel}
            mediaType={mediaType}
            showCollectionOwnershipFilters={showCollectionOwnershipFilters}
            t={t}
            compact
            grid={false}
          />
          <LogProgressLine log={log} hasProgressButton={hasProgressButton} t={t} compact grid={false} />
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
            <LogReviewBlock
              log={log}
              display={display}
              embedded={embedded}
              compact
              grid={false}
              expandedReviewLogId={expandedReviewLogId}
              onExpandReview={onExpandReview}
              t={t}
            />
          </div>
        </div>
        <LogActions
          log={log}
          readOnly={readOnly}
          view="compact"
          mediaType={mediaType}
          hasProgressButton={hasProgressButton}
          deletingId={deletingId}
          incrementingId={incrementingId}
          onIncrement={onIncrement}
          onEdit={onEdit}
          t={t}
        />
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "relative flex min-h-0 flex-row overflow-hidden rounded-lg bg-[var(--color-dark)] p-0",
        embedded && !isReviewExpanded
          ? isGrid
            ? LOG_CARD_HEIGHT_EMBEDDED_GRID_COLLAPSED
            : LOG_CARD_HEIGHT_EMBEDDED_COLLAPSED
          : embedded
            ? LOG_CARD_HEIGHT_EMBEDDED
            : LOG_CARD_HEIGHT_DEFAULT,
        borderClass
      )}
      style={cardShadow}
    >
      {!readOnly && deletingId === log.id && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0D1B2A]/70">
          <Loader2 className={cn("animate-spin text-[var(--color-light)]", isGrid ? "h-6 w-6" : "h-8 w-8")} />
        </div>
      )}
      <MotionLink
        to={itemDetailPath(log.mediaType, log.externalId)}
        whileTap={tapScale}
        transition={tapTransition}
        className={isGrid ? LOG_CARD_IMAGE_COLUMN_GRID : LOG_CARD_IMAGE_COLUMN}
      >
        <div className="absolute inset-0 min-h-0">
          <ItemImage
            src={log.image}
            className="h-full w-full min-h-0"
            mediaType={log.mediaType}
            boardGameSource={log.boardGameSource}
          />
        </div>
        <LogImageOverlays log={log} t={t} compact={false} grid={isGrid} />
      </MotionLink>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden",
          isGrid ? LOG_CARD_BODY_GAP_GRID : LOG_CARD_BODY_GAP,
          isGrid ? LOG_CARD_BODY_PADDING_GRID : LOG_CARD_BODY_PADDING,
          embedded && !isReviewExpanded && "min-h-0"
        )}
      >
        <MotionLink
          to={itemDetailPath(log.mediaType, log.externalId)}
          whileTap={tapScale}
          transition={tapTransition}
          className="block min-w-0 font-semibold text-[var(--color-lightest)] no-underline hover:underline"
        >
          <OverflowMarquee className={isGrid ? LOG_CARD_TITLE_GRID : LOG_CARD_TITLE}>{log.title}</OverflowMarquee>
        </MotionLink>
        <LogMetaRow
          log={log}
          display={display}
          scopeLabel={scopeLabel}
          mediaType={mediaType}
          showCollectionOwnershipFilters={showCollectionOwnershipFilters}
          t={t}
          compact={false}
          grid={isGrid}
        />
        <LogProgressLine log={log} hasProgressButton={hasProgressButton} t={t} compact={false} grid={isGrid} />
        <div
          className={cn(
            "flex min-h-0 flex-col items-start gap-1",
            embedded && !isReviewExpanded && "flex-1 overflow-hidden"
          )}
        >
          <LogReviewBlock
            log={log}
            display={display}
            embedded={embedded}
            compact={false}
            grid={isGrid}
            expandedReviewLogId={expandedReviewLogId}
            onExpandReview={onExpandReview}
            t={t}
          />
        </div>
      </div>
      <LogActions
        log={log}
        readOnly={readOnly}
        view={isGrid ? "grid" : "list"}
        mediaType={mediaType}
        hasProgressButton={hasProgressButton}
        deletingId={deletingId}
        incrementingId={incrementingId}
        onIncrement={onIncrement}
        onEdit={onEdit}
        t={t}
      />
    </Card>
  );
}

