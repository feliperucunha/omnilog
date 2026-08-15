import { motion } from "framer-motion";
import type { BoardGameProvider, Log, MediaType, SearchResult } from "@geeklogs/shared";
import { BookPagesBadge } from "@/components/BookPagesBadge";
import { GenreBadges } from "@/components/GenreBadges";
import { ItemImage } from "@/components/ItemImage";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { SearchResultQuickActions } from "@/components/SearchResultQuickActions";
import { StarRating } from "@/components/StarRating";
import { tapScale, tapTransition } from "@/lib/animations";
import { formatTimeToBeatHours } from "@/lib/formatDuration";
import { getLogCardDisplay } from "@/lib/logDisplay";
import {
  LOG_CARD_TITLE,
  SEARCH_RESULT_CARD_BODY,
  SEARCH_RESULT_CARD_BODY_COMPACT,
  SEARCH_RESULT_CARD_BODY_GRID,
  SEARCH_RESULT_CARD_IMAGE,
  SEARCH_RESULT_CARD_IMAGE_COMPACT,
  SEARCH_RESULT_CARD_IMAGE_GRID,
  SEARCH_RESULT_CARD_SHELL,
} from "@/lib/logCardLayout";
import type { LogViewMode } from "@/lib/logViewPreference";
import { gradeToStars } from "@/lib/gradeStars";
import { getStatusLabel } from "@/lib/statusLabel";
import { searchResultLogIndicators } from "@/lib/searchResultLogIndicators";
import type { TFunction } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

type SearchResultCardProps = {
  item: SearchResult;
  mediaType: MediaType;
  view: LogViewMode;
  token: string | null;
  userLog?: Log;
  boardGameProvider: BoardGameProvider;
  onOpen: () => void;
  t: TFunction;
};

export function SearchResultCard({
  item,
  mediaType,
  view,
  token,
  userLog,
  boardGameProvider,
  onOpen,
  t,
}: SearchResultCardProps) {
  const { inList, status, railClass, badgeClass } = searchResultLogIndicators(userLog);
  const display = userLog ? getLogCardDisplay(userLog) : null;

  const metaParts: string[] = [item.year ?? "", item.subtitle ?? ""].filter(Boolean);
  if (mediaType === "games" && item.timeToBeatHours != null && item.timeToBeatHours > 0) {
    const { hours, minutes } = formatTimeToBeatHours(item.timeToBeatHours);
    metaParts.push(
      minutes > 0
        ? t("itemPage.timeToBeatHoursMinutes", {
            hours: String(hours),
            minutes: String(minutes),
          })
        : t("itemPage.timeToBeatHours", { hours: String(hours) })
    );
  }
  const metaLine = metaParts.join(" · ") || "—";

  const isCompact = view === "compact";
  const isGrid = view === "grid";
  const layoutClass = isCompact
    ? "flex flex-col"
    : isGrid
      ? "flex flex-row"
      : "flex flex-row sm:flex-col";
  const imageClass = isCompact
    ? SEARCH_RESULT_CARD_IMAGE_COMPACT
    : isGrid
      ? SEARCH_RESULT_CARD_IMAGE_GRID
      : SEARCH_RESULT_CARD_IMAGE;
  const bodyClass = isCompact
    ? SEARCH_RESULT_CARD_BODY_COMPACT
    : isGrid
      ? SEARCH_RESULT_CARD_BODY_GRID
      : SEARCH_RESULT_CARD_BODY;
  const titleClass = isGrid ? "text-xs font-semibold leading-snug md:text-[11px] md:leading-tight" : LOG_CARD_TITLE;
  const badgeSize = isCompact || isGrid ? "text-[8px] sm:text-[9px]" : "text-[9px] sm:text-[10px]";

  return (
    <motion.div whileTap={tapScale} transition={tapTransition} className={cn(SEARCH_RESULT_CARD_SHELL, "relative")}>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "h-full w-full text-left overflow-hidden rounded-lg border bg-[var(--color-dark)] text-inherit no-underline shadow-[var(--shadow-card)] cursor-pointer transition-[opacity,border-color] hover:opacity-95",
          layoutClass,
          railClass,
          !inList && "hover:border-black",
          !isCompact && !isGrid && "max-md:min-h-[44px]"
        )}
      >
        <div className={imageClass}>
          <ItemImage
            src={item.image}
            className="h-full w-full"
            mediaType={mediaType}
            activeBoardGameProvider={mediaType === "boardgames" ? boardGameProvider : undefined}
          />
          {inList && status && (
            <span
              className={cn(
                "absolute bottom-1 right-1 z-10 rounded px-1.5 py-0.5 font-medium",
                badgeSize,
                badgeClass,
                !isCompact && !isGrid && "sm:bottom-1.5 sm:right-1.5"
              )}
              title={getStatusLabel(t, status, mediaType)}
            >
              {getStatusLabel(t, status, mediaType)}
            </span>
          )}
        </div>
        <div className={bodyClass}>
          {!isGrid && (
            <OverflowMarquee className="text-[10px] font-medium uppercase text-[var(--color-light)] sm:hidden">
              {t(`nav.${mediaType}`)}
            </OverflowMarquee>
          )}
          <OverflowMarquee className={cn(titleClass, "text-[var(--color-lightest)]", !isGrid && "sm:leading-tight")}>
            {item.title}
          </OverflowMarquee>
          {display?.grade != null ? (
            <StarRating
              value={gradeToStars(display.grade)}
              readOnly
              size="sm"
              className={isGrid ? "shrink-0 origin-left scale-[0.88] sm:hidden" : "sm:hidden"}
            />
          ) : null}
          {isGrid ? (
            <div className="flex min-w-0 flex-wrap items-center gap-0.5 overflow-hidden md:max-h-[2.25rem]">
              {display?.grade != null ? (
                <StarRating
                  value={gradeToStars(display.grade)}
                  readOnly
                  size="sm"
                  className="hidden shrink-0 origin-left scale-[0.88] sm:block"
                />
              ) : null}
              {item.genres && item.genres.length > 0 && <GenreBadges genres={item.genres} maxCount={1} compact />}
              {mediaType === "books" && (
                <BookPagesBadge pagesCount={item.pagesCount} className="max-w-[4.25rem] truncate px-1.5 py-px text-[8px]" />
              )}
              <OverflowMarquee className="min-w-0 flex-1 text-[9px] text-[var(--color-light)] md:text-[8px]">
                {metaLine}
              </OverflowMarquee>
            </div>
          ) : (
            <>
              <div className={cn("hidden min-w-0 items-center gap-2", !isCompact && "sm:flex")}>
                {display?.grade != null ? (
                  <StarRating value={gradeToStars(display.grade)} readOnly size="sm" className="shrink-0" />
                ) : null}
                {item.genres && item.genres.length > 0 && (
                  <GenreBadges genres={item.genres} maxCount={1} className="shrink-0" />
                )}
                {mediaType === "books" && <BookPagesBadge pagesCount={item.pagesCount} className="shrink-0" />}
                <OverflowMarquee className="min-w-0 flex-1 text-xs text-[var(--color-light)]">{metaLine}</OverflowMarquee>
              </div>
              <div className={cn("flex min-w-0 flex-col gap-0.5", !isCompact && "sm:hidden")}>
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  {item.genres && item.genres.length > 0 && <GenreBadges genres={item.genres} maxCount={1} />}
                  {mediaType === "books" && <BookPagesBadge pagesCount={item.pagesCount} />}
                </div>
                <OverflowMarquee className={cn("text-[var(--color-light)]", isCompact ? "text-[10px]" : "text-xs")}>
                  {metaLine}
                </OverflowMarquee>
              </div>
            </>
          )}
        </div>
      </button>
      {token && (
        <div className="absolute right-1.5 top-1.5 z-20">
          <SearchResultQuickActions
            item={item}
            mediaType={mediaType}
            userLog={userLog}
            boardGameProvider={boardGameProvider}
            onOpenItem={onOpen}
            t={t}
          />
        </div>
      )}
    </motion.div>
  );
}
