import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ChevronDown, Plus } from "lucide-react";
import {
  compareScopeGenerality,
  groupItemReviewsByUser,
  partialItemReviews,
  pickPrimaryScopedReview,
  pickShowItemReview,
  type ItemDetail,
  type ItemPageData,
  type ItemReview,
  type LogAffinityContext,
  type MediaType,
  type ReviewScope,
} from "@geeklogs/shared";
import { ReactionButtons } from "@/components/ReactionButtons";
import { formatBoardGameWeight } from "@/lib/boardGameWeight";
import { getStatusLabel } from "@/lib/statusLabel";
import {
  logStatusRailClass,
  logStatusSoftBadgeClass,
  mediaTypeUsesEpisodeStatusColors,
  seriesAirStatusSoftBadgeClass,
} from "@/lib/logStatusColors";
import { apiFetch, invalidateApiCache, invalidateLogsAndItemsCache } from "@/lib/api";
import { loadWithSWR } from "@/lib/logsPageCache";
import { useAppPtrRefresh } from "@/hooks/useAppPtrRefresh";
import { decodeItemPageDataForDisplay, decodeItemReviewForDisplay } from "@/lib/decodeDisplayFields";
import { useAuth } from "@/contexts/AuthContext";
import { useLogComplete } from "@/contexts/LogCompleteContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { ItemReviewForm } from "@/components/ItemReviewForm";
import { ItemPageSkeleton } from "@/components/skeletons";
import { Select } from "@/components/ui/select";
import { BookPagesBadge } from "@/components/BookPagesBadge";
import { GamePlatformBadges } from "@/components/GamePlatformBadges";
import { GenreBadges } from "@/components/GenreBadges";
import { LevelBadge } from "@/components/LevelBadge";
import { MEDIA_BADGE_ICONS } from "@/lib/mediaBadgeIcons";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToBeatHours } from "@/lib/formatDuration";
import { getHeroImageUrl, getItemDisplayImageUrl, getItemHeaderImageUrl } from "@/lib/getHeroImageUrl";
import { ItemImage } from "@/components/ItemImage";
import { listStaggerItemClassName, listStaggerItemVariants, listStaggerParentProps, visibleEnterProps } from "@/lib/motionPolicy";
import { useLocale } from "@/contexts/LocaleContext";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { isCapacitorAndroid } from "@/lib/androidOverlayBack";
import { cn } from "@/lib/utils";

function ItemDetailsBlock({
  item,
  mediaType,
  t,
  androidWebView,
}: {
  item: ItemDetail;
  mediaType: MediaType;
  t: (key: string, params?: Record<string, string>) => string;
  androidWebView: boolean;
}) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const hasDescription = item.description && item.description.length > 0;
  const hasTagline = item.tagline && item.tagline.length > 0;
  const hasGenres = item.genres && item.genres.length > 0;
  const hasScore = item.score != null && item.score > 0;
  const hasWeight =
    mediaType === "boardgames" && item.averageWeight != null && item.averageWeight > 0;
  const weightDisplay = hasWeight ? formatBoardGameWeight(item.averageWeight) : null;
  const hasContentRating = item.contentRating && item.contentRating.length > 0;
  const hasEpisodes = item.episodesCount != null && item.episodesCount > 0;
  const hasSeasons = item.seasonsCount != null && item.seasonsCount > 0;
  const hasPlayers = (item.playersMin != null || item.playersMax != null);
  const hasPlayingTime = item.playingTimeMinutes != null && item.playingTimeMinutes > 0;
  const hasAuthors = item.authors && item.authors.length > 0;
  const hasPublisher = item.publisher && item.publisher.length > 0;
  const hasIssues = item.issuesCount != null && item.issuesCount > 0;
  const hasPages =
    mediaType === "books" && typeof item.pagesCount === "number" && item.pagesCount > 0;
  const hasPlatforms = item.platforms && item.platforms.length > 0;
  const hasChapters = item.chaptersCount != null && item.chaptersCount > 0;
  const hasVolumes = item.volumesCount != null && item.volumesCount > 0;
  const hasRuntime = item.runtimeMinutes != null && item.runtimeMinutes > 0 && (mediaType === "movies" || mediaType === "tv");
  const hasReleaseDate = item.releaseDate && item.releaseDate.length > 0;
  const hasStatus = item.status && item.status.length > 0;
  const hasProductionCountries = item.productionCountries && item.productionCountries.length > 0;
  const hasSpokenLanguages = item.spokenLanguages && item.spokenLanguages.length > 0;
  const hasNetworks = item.networks && item.networks.length > 0;
  const hasDevelopers = item.developers && item.developers.length > 0;
  const hasPublishers = item.publishers && item.publishers.length > 0;
  const hasEsrbRating = item.esrbRating && item.esrbRating.length > 0;
  const hasTags = item.tags && item.tags.length > 0;
  const hasMinAge = item.minAge != null && item.minAge > 0;
  const hasCategories = item.categories && item.categories.length > 0;
  const hasMechanics = item.mechanics && item.mechanics.length > 0;
  const hasStudios = item.studios && item.studios.length > 0;
  const hasThemes = item.themes && item.themes.length > 0;
  const hasDuration = item.duration && item.duration.length > 0;
  const hasSerialization = item.serialization && item.serialization.length > 0;
  const hasSubjects = item.subjects && item.subjects.length > 0;
  const hasItemSource = mediaType === "boardgames" && (item.itemSource === "bgg" || item.itemSource === "ludopedia");
  const hasDataLanguageNote = true;

  const hasAny =
    hasDescription ||
    hasTagline ||
    hasGenres ||
    hasScore ||
    hasWeight ||
    hasContentRating ||
    hasEpisodes ||
    hasSeasons ||
    hasPlayers ||
    hasPlayingTime ||
    hasAuthors ||
    hasPublisher ||
    hasIssues ||
    hasPages ||
    hasPlatforms ||
    hasChapters ||
    hasVolumes ||
    hasRuntime ||
    hasReleaseDate ||
    hasStatus ||
    hasProductionCountries ||
    hasSpokenLanguages ||
    hasNetworks ||
    hasDevelopers ||
    hasPublishers ||
    hasEsrbRating ||
    hasTags ||
    hasMinAge ||
    hasCategories ||
    hasMechanics ||
    hasStudios ||
    hasThemes ||
    hasDuration ||
    hasSerialization ||
    hasSubjects ||
    hasItemSource ||
    hasDataLanguageNote;
  if (!hasAny) return null;

  const scoreDisplay = hasScore && item.score != null ? (item.score <= 10 ? item.score.toFixed(1) : String(Math.round(item.score))) : null;

  return (
    <Card
      className={cn(
        "@container flex min-w-0 flex-col gap-5 border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-5 shadow-none sm:p-6",
        /* Android: `overflow-hidden` + long description has clipped the whole card’s text layer in WebView; keep horizontal clip only. */
        androidWebView ? "overflow-x-hidden" : "overflow-hidden"
      )}
    >
      {hasTagline && (
        <p className="text-[var(--color-light)] italic text-center text-sm sm:text-base border-b border-[var(--color-mid)]/20 pb-4">
          &ldquo;{item.tagline}&rdquo;
        </p>
      )}
      {hasDescription && (
        <div className="min-w-0 overflow-hidden">
          <button
            type="button"
            id="item-description-heading"
            className="flex w-full max-md:min-h-[44px] items-center justify-between gap-2 rounded-lg py-1 text-left transition-colors hover:bg-[var(--color-mid)]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)]"
            onClick={() => setDescriptionOpen((o) => !o)}
            aria-expanded={descriptionOpen}
            aria-controls="item-description-panel"
          >
            <h3 className="mb-0 min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-light)]">
              <OverflowMarquee>{t("itemPage.description")}</OverflowMarquee>
            </h3>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-[var(--color-light)] transition-transform duration-200",
                descriptionOpen && "rotate-180"
              )}
              aria-hidden
            />
          </button>
          {descriptionOpen && (
            <div
              id="item-description-panel"
              role="region"
              aria-labelledby="item-description-heading"
              className="mt-2 min-w-0 [-webkit-overflow-scrolling:touch] [overflow-wrap:anywhere]"
            >
              <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-lightest)] sm:text-base">
                {item.description}
              </p>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {hasGenres && <GenreBadges genres={item.genres!} maxCount={2} className="[&_span]:px-3 [&_span]:py-1 [&_span]:text-xs" />}
        {mediaType === "games" && hasPlatforms && (
          <GamePlatformBadges platforms={item.platforms} className="w-full sm:w-auto" />
        )}
        {hasPages && <BookPagesBadge pagesCount={item.pagesCount} className="text-xs px-2.5 py-1" />}
        {hasScore && scoreDisplay && (
          <span className="inline-flex items-center rounded-md bg-[var(--btn-gradient-start)]/30 px-2.5 py-1 text-sm font-semibold text-[var(--color-lightest)]">
            {scoreDisplay}/10
          </span>
        )}
        {hasWeight && weightDisplay && (
          <span className="inline-flex items-center rounded-md bg-black/75 px-2.5 py-1 text-sm font-semibold text-yellow-300">
            {weightDisplay}
          </span>
        )}
        {hasContentRating && (
          <span className="rounded border border-[var(--color-mid)] px-2 py-0.5 text-xs text-[var(--color-light)]">
            {item.contentRating}
          </span>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 text-sm @[28rem]:grid-cols-3">
        {hasReleaseDate && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.releaseDate")}: </span>
            <span className="whitespace-nowrap font-medium text-[var(--color-lightest)]">{item.releaseDate}</span>
          </div>
        )}
        {hasStatus && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.status")}: </span>
            {mediaType === "tv" ? (
              <span
                className={cn(
                  "inline-block rounded-md px-2 py-0.5 text-xs font-medium",
                  seriesAirStatusSoftBadgeClass(item.status)
                )}
              >
                {item.status}
              </span>
            ) : (
              <span className="text-[var(--color-lightest)] font-medium">{item.status}</span>
            )}
          </div>
        )}
        {hasRuntime && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.runtime")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">
              {item.runtimeMinutes! >= 60
                ? `${Math.floor(item.runtimeMinutes! / 60)} h ${item.runtimeMinutes! % 60} min`
                : `${item.runtimeMinutes} min`}
            </span>
          </div>
        )}
        {hasEpisodes && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.episodes")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.episodesCount}</span>
          </div>
        )}
        {hasSeasons && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.seasons")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.seasonsCount}</span>
          </div>
        )}
        {hasPlayers && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.players")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">
              {item.playersMin != null && item.playersMax != null
                ? `${item.playersMin}–${item.playersMax}`
                : item.playersMin != null
                  ? String(item.playersMin)
                  : String(item.playersMax)}
            </span>
          </div>
        )}
        {hasPlayingTime && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.playingTime")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">
              {item.playingTimeMinutes! >= 60
                ? `${Math.floor(item.playingTimeMinutes! / 60)} h ${item.playingTimeMinutes! % 60} min`
                : `${item.playingTimeMinutes} min`}
            </span>
          </div>
        )}
        {hasWeight && weightDisplay && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.weight")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{weightDisplay}</span>
          </div>
        )}
        {hasAuthors && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.authors")}: </span>
            <span className="text-[var(--color-lightest)]">{item.authors!.join(", ")}</span>
          </div>
        )}
        {hasPublisher && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.publisher")}: </span>
            <span className="text-[var(--color-lightest)]">{item.publisher}</span>
          </div>
        )}
        {hasIssues && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.issues")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.issuesCount}</span>
          </div>
        )}
        {hasPages && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.pages")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">
              {t("mediaLogs.bookPagesBadge", { count: String(item.pagesCount) })}
            </span>
          </div>
        )}
        {hasPlatforms && mediaType !== "games" && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.platforms")}: </span>
            <span className="text-[var(--color-lightest)]">{item.platforms!.join(", ")}</span>
          </div>
        )}
        {hasProductionCountries && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.productionCountries")}: </span>
            <span className="text-[var(--color-lightest)]">{item.productionCountries!.join(", ")}</span>
          </div>
        )}
        {hasSpokenLanguages && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.spokenLanguages")}: </span>
            <span className="text-[var(--color-lightest)]">{item.spokenLanguages!.join(", ")}</span>
          </div>
        )}
        {hasNetworks && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.networks")}: </span>
            <span className="text-[var(--color-lightest)]">{item.networks!.join(", ")}</span>
          </div>
        )}
        {hasDevelopers && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.developers")}: </span>
            <span className="text-[var(--color-lightest)]">{item.developers!.join(", ")}</span>
          </div>
        )}
        {hasPublishers && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.publishers")}: </span>
            <span className="text-[var(--color-lightest)]">{item.publishers!.join(", ")}</span>
          </div>
        )}
        {hasEsrbRating && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.esrbRating")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.esrbRating}</span>
          </div>
        )}
        {hasTags && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.tags")}: </span>
            <span className="text-[var(--color-lightest)]">{item.tags!.join(", ")}</span>
          </div>
        )}
        {hasMinAge && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.minAge")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.minAge}+</span>
          </div>
        )}
        {hasCategories && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.categories")}: </span>
            <span className="text-[var(--color-lightest)]">{item.categories!.join(", ")}</span>
          </div>
        )}
        {hasMechanics && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.mechanics")}: </span>
            <span className="text-[var(--color-lightest)]">{item.mechanics!.join(", ")}</span>
          </div>
        )}
        {hasStudios && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.studios")}: </span>
            <span className="text-[var(--color-lightest)]">{item.studios!.join(", ")}</span>
          </div>
        )}
        {hasThemes && (
          <div className="col-span-2 min-w-0 break-words @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.themes")}: </span>
            <span className="text-[var(--color-lightest)]">{item.themes!.join(", ")}</span>
          </div>
        )}
        {hasDuration && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.duration")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.duration}</span>
          </div>
        )}
        {hasSerialization && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.serialization")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.serialization}</span>
          </div>
        )}
        {hasSubjects && (
          <div className="col-span-2 @[28rem]:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.subjects")}: </span>
            <span className="text-[var(--color-lightest)]">{item.subjects!.join(", ")}</span>
          </div>
        )}
        {hasChapters && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.chapters")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.chaptersCount}</span>
          </div>
        )}
        {hasVolumes && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.volumes")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.volumesCount}</span>
          </div>
        )}
        <div className="col-span-2 @[28rem]:col-span-3 pt-2 mt-2 border-t border-[var(--color-mid)]/20 space-y-1">
          {hasItemSource && (
            <span className="block text-xs text-[var(--color-light)]">
              {t("itemPage.detailsFromSource", {
                source: item.itemSource === "ludopedia" ? t("settings.boardGameProviderLudopedia") : t("settings.boardGameProviderBgg"),
              })}
            </span>
          )}
          <span className="block text-xs text-[var(--color-light)]" role="note">
            {t("itemPage.dataLanguageDependsOnApi")}
          </span>
        </div>
      </div>
    </Card>
  );
}

export interface ItemPageContentProps {
  mediaType: MediaType;
  id: string;
  onBack: () => void;
}

const REVIEWS_PAGE_SIZE = 10;

const REVIEW_SORT_OPTIONS = ["recent", "oldest", "likes", "dislikes"] as const;
type ReviewSortKey = (typeof REVIEW_SORT_OPTIONS)[number];

function sortReviewsByKey(list: ItemReview[], sort: ReviewSortKey): ItemReview[] {
  const copy = [...list];
  if (sort === "oldest") {
    copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (sort === "likes") {
    copy.sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0));
  } else if (sort === "dislikes") {
    copy.sort((a, b) => (b.dislikesCount ?? 0) - (a.dislikesCount ?? 0));
  } else {
    copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return copy;
}

function sortUserScopedReviews(list: ItemReview[]): ItemReview[] {
  return [...list].sort((a, b) => {
    const scopeA = (a.reviewScope ?? "show") as ReviewScope;
    const scopeB = (b.reviewScope ?? "show") as ReviewScope;
    const scopeCmp = compareScopeGenerality(scopeB, scopeA);
    if (scopeCmp !== 0) return scopeCmp;
    const ds = (b.season ?? 0) - (a.season ?? 0);
    if (ds !== 0) return ds;
    return (b.episode ?? 0) - (a.episode ?? 0);
  });
}

function reviewScopeLabel(
  t: (key: string, vars?: Record<string, string>) => string,
  r: ItemReview
): string {
  const scope = r.reviewScope ?? "show";
  if (scope === "season") return t("tvReviews.scopeSeason", { n: String(r.season ?? "?") });
  if (scope === "episode") {
    return t("tvReviews.scopeEpisode", {
      season: String(r.season ?? "?"),
      episode: String(r.episode ?? "?"),
    });
  }
  return t("tvReviews.scopeShow");
}

function reviewStatusBorderClass(r: ItemReview): string {
  return logStatusRailClass(r.status ?? r.listType ?? null);
}

function itemReviewProfilePath(review: ItemReview, mediaType: MediaType): string | null {
  const slug = review.reviewerUsername?.trim() || review.userId;
  if (!slug) return null;
  return `/${encodeURIComponent(slug)}?category=${encodeURIComponent(mediaType)}`;
}

function ItemReviewProfileLink({
  review,
  mediaType,
  className,
  children,
}: {
  review: ItemReview;
  mediaType: MediaType;
  className?: string;
  children: React.ReactNode;
}) {
  const path = itemReviewProfilePath(review, mediaType);
  if (!path) {
    return <div className={className}>{children}</div>;
  }
  return (
    <Link
      to={path}
      className={cn(
        className,
        "block rounded-md transition-colors hover:bg-[var(--color-mid)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)]"
      )}
    >
      {children}
    </Link>
  );
}

function ItemReviewAuthorRow({
  r,
  mediaType,
  t,
}: {
  r: ItemReview;
  mediaType: MediaType;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <OverflowMarquee
        className={`text-base font-semibold ${r.isAdmin ? "admin-username-fire" : r.isPro ? "pro-username-shine" : "text-[var(--color-lightest)]"}`}
      >
        {r.reviewerUsername ?? r.userEmail}
      </OverflowMarquee>
      {(r.reviewerBadges?.length
        ? r.reviewerBadges
        : r.reviewerLevelIcon
          ? [{ icon: r.reviewerLevelIcon, level: r.reviewerLevel ?? 1, label: r.reviewerLevelLabel ?? "" }]
          : []
      ).map((badge) => (
        <LevelBadge
          key={`${badge.level}-${badge.icon}`}
          icon={MEDIA_BADGE_ICONS[mediaType]}
          level={badge.level}
          title={badge.label || undefined}
          popupDetail={{
            user: r.reviewerUsername ?? r.userEmail ?? "—",
            categoryLabel: t(`nav.${mediaType}`),
            label: badge.label ?? undefined,
            count: r.reviewerReviewsInCategory,
            kind: "reviews",
          }}
        />
      ))}
    </div>
  );
}

function ItemReviewMetaRow({
  r,
  locale,
  t,
  mediaType,
  scopedReviewsDisplay,
  showScopeBadge = true,
}: {
  r: ItemReview;
  locale: string;
  t: (key: string, vars?: Record<string, string>) => string;
  mediaType: MediaType;
  scopedReviewsDisplay: boolean;
  showScopeBadge?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {r.grade != null && <StarRating value={gradeToStars(r.grade)} readOnly size="md" />}
        <time className="text-xs text-[var(--color-light)]" dateTime={r.createdAt}>
          {new Date(r.createdAt).toLocaleDateString(locale, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(r.status ?? r.listType) && (
          <span
            className={cn(
              "rounded-md px-2 py-1 text-xs",
              mediaTypeUsesEpisodeStatusColors(mediaType)
                ? logStatusSoftBadgeClass(r.status ?? r.listType ?? null)
                : "bg-[var(--color-darkest)] text-[var(--color-light)]"
            )}
          >
            {getStatusLabel(t, r.status ?? r.listType ?? null, mediaType)}
          </span>
        )}
        {showScopeBadge && scopedReviewsDisplay && (r.reviewScope ?? "show") !== "show" && (
          <span className="rounded-md bg-[var(--color-darkest)]/80 px-2 py-1 text-xs text-[var(--color-light)]">
            {reviewScopeLabel(t, r)}
          </span>
        )}
        {showScopeBadge && !scopedReviewsDisplay && (r.season != null || r.episode != null) && (
          <span className="rounded-md bg-[var(--color-darkest)]/80 px-2 py-1 text-xs text-[var(--color-light)]">
            S{r.season ?? "?"} · E{r.episode ?? "?"}
          </span>
        )}
        {showScopeBadge && (r.chapter != null || r.volume != null) && (
          <span className="rounded-md bg-[var(--color-darkest)]/80 px-2 py-1 text-xs text-[var(--color-light)]">
            Ch.{r.chapter ?? "?"} · Vol.{r.volume ?? "?"}
          </span>
        )}
      </div>
    </div>
  );
}

type ReactionPayload = {
  likesCount: number;
  dislikesCount: number;
  userReaction: "like" | "dislike" | null;
};

function ItemReviewReactionButtons({
  r,
  token,
  onReactionChange,
}: {
  r: ItemReview;
  token: string | null;
  onReactionChange: (reviewId: string, reactionLogId: string, payload: ReactionPayload) => void;
}) {
  const reactionLogId = r.reactionLogId ?? r.id;
  return (
    <ReactionButtons
      logId={reactionLogId}
      likesCount={r.likesCount ?? 0}
      dislikesCount={r.dislikesCount ?? 0}
      userReaction={r.userReaction ?? null}
      disabled={!token}
      onReactionChange={(payload) => onReactionChange(r.id, reactionLogId, payload)}
    />
  );
}

interface ReviewsResponse {
  reviews: ItemReview[];
  meanGrade: number | null;
  reviewsTotal: number;
  reviewsPage: number;
  reviewsLimit: number;
}

export function ItemPageContent({ mediaType, id, onBack }: ItemPageContentProps) {
  const androidWebView = isCapacitorAndroid();
  const { t, locale } = useLocale();
  const { showLogComplete } = useLogComplete();
  const [data, setData] = useState<ItemPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsSort, setReviewsSort] = useState<ReviewSortKey>("recent");
  const [expandedReviewUsers, setExpandedReviewUsers] = useState<Set<string>>(() => new Set());
  const [section, setSection] = useState<"log" | "details" | "reviews">("log");
  const [dropCover, setDropCover] = useState(false);
  const sectionNavRef = useRef<HTMLElement>(null);
  const { token } = useAuth();
  const { setPageTitle } = usePageTitle() ?? {};

  useEffect(() => {
    setDropCover(false);
  }, [mediaType, id]);

  useEffect(() => {
    const title = data?.item?.title ?? null;
    setPageTitle?.(title);
    return () => setPageTitle?.(null);
  }, [data?.item?.title, setPageTitle]);

  const fetchItem = useCallback(() => {
    setError(null);
    const params = new URLSearchParams({
      reviewsPage: "1",
      reviewsLimit: "0",
    });
    const path = `/items/${mediaType}/${id}?${params.toString()}`;
    void loadWithSWR<ItemPageData>(
      path,
      (d) => setData(decodeItemPageDataForDisplay(d)),
      {
        setLoading,
        showLoadingOnMiss: true,
        onError: () => setError(t("dashboard.couldntLoadLogs")),
      }
    );
  }, [mediaType, id, t]);

  const fetchReviews = useCallback(
    (page: number, sort: ReviewSortKey) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(REVIEWS_PAGE_SIZE),
        sort,
      });
      const reviewsPath = `/items/${mediaType}/${id}/reviews?${params.toString()}`;
      void loadWithSWR<ReviewsResponse>(
        reviewsPath,
        (res) => {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  reviews: res.reviews.map(decodeItemReviewForDisplay),
                  meanGrade: res.meanGrade,
                  reviewsTotal: res.reviewsTotal,
                  reviewsPage: res.reviewsPage,
                  reviewsLimit: res.reviewsLimit,
                }
              : prev
          );
        },
        { setLoading: setReviewsLoading, showLoadingOnMiss: false }
      );
    },
    [mediaType, id]
  );

  useEffect(() => {
    setReviewsPage(1);
  }, [mediaType, id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  useEffect(() => {
    if (!data?.item) return;
    fetchReviews(reviewsPage, reviewsSort);
  }, [data?.item, reviewsPage, reviewsSort, fetchReviews]);

  useAppPtrRefresh(() => {
    invalidateApiCache(`/items/${mediaType}/${id}`);
    invalidateLogsAndItemsCache();
    fetchItem();
    setReviewsPage(1);
    fetchReviews(1, reviewsSort);
  });

  const refreshReviewsAfterSave = useCallback(() => {
    invalidateLogsAndItemsCache();
    setReviewsPage(1);
    setExpandedReviewUsers(new Set());
    setReviewsLoading(true);
    const params = new URLSearchParams({
      page: "1",
      limit: String(REVIEWS_PAGE_SIZE),
      sort: reviewsSort,
    });
    void apiFetch<ReviewsResponse>(`/items/${mediaType}/${id}/reviews?${params.toString()}`)
      .then((res) => {
        setData((prev) =>
          prev
            ? {
                ...prev,
                reviews: res.reviews.map(decodeItemReviewForDisplay),
                meanGrade: res.meanGrade,
                reviewsTotal: res.reviewsTotal,
                reviewsPage: res.reviewsPage,
                reviewsLimit: res.reviewsLimit,
              }
            : prev
        );
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [mediaType, id, reviewsSort]);

  useEffect(() => {
    setExpandedReviewUsers(new Set());
  }, [reviewsPage, reviewsSort, id, mediaType]);

  const scopedReviewsDisplay = mediaType === "tv" || mediaType === "anime";
  const pageReviews = data?.reviews ?? [];

  const reviewDisplayGroups = useMemo(() => {
    if (!scopedReviewsDisplay) {
      return pageReviews.map((r) => ({
        userId: r.userId ?? r.id,
        reviews: [r] as ItemReview[],
      }));
    }
    const grouped = groupItemReviewsByUser(pageReviews);
    const groups: { userId: string; reviews: ItemReview[] }[] = [];
    for (const [userId, list] of grouped) {
      groups.push({ userId, reviews: list });
    }
    const primaries = groups
      .map((g) => pickShowItemReview(g.reviews) ?? pickPrimaryScopedReview(g.reviews))
      .filter((p): p is ItemReview => p != null);
    const sortedPrimaries = sortReviewsByKey(primaries, reviewsSort);
    return sortedPrimaries.map((primary) => {
      const match = groups.find((g) => g.reviews.some((r) => r.id === primary.id));
      return match ?? { userId: primary.userId ?? primary.id, reviews: [primary] };
    });
  }, [pageReviews, scopedReviewsDisplay, reviewsSort]);

  const handleReviewReactionChange = useCallback(
    (reviewId: string, reactionLogId: string, payload: ReactionPayload) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              reviews: prev.reviews.map((rev) =>
                rev.id === reviewId || rev.reactionLogId === reactionLogId
                  ? {
                      ...rev,
                      likesCount: payload.likesCount,
                      dislikesCount: payload.dislikesCount,
                      userReaction: payload.userReaction,
                    }
                  : rev
              ),
            }
          : prev
      );
    },
    []
  );

  const affinityContextDraft = useMemo((): LogAffinityContext | undefined => {
    const it = data?.item;
    if (!it) return undefined;
    if (mediaType === "boardgames") {
      return {
        boardgames: {
          playingTimeMinutes: it.playingTimeMinutes ?? null,
          playersMin: it.playersMin ?? null,
          playersMax: it.playersMax ?? null,
          minAge: it.minAge ?? null,
          averageWeight: it.averageWeight ?? null,
        },
      };
    }
    if (mediaType === "books") {
      const y = it.year ? parseInt(it.year.slice(0, 4), 10) : NaN;
      const subjects = [...(it.subjects ?? []), ...(it.genres ?? [])].filter(Boolean);
      return {
        books: {
          subjects: subjects.slice(0, 15),
          authors: (it.authors ?? []).slice(0, 5),
          publisher: it.publisher ?? null,
          year: Number.isFinite(y) ? y : null,
        },
      };
    }
    if (mediaType === "manga") {
      return {
        manga: {
          genres: (it.genres ?? []).slice(0, 12),
          themes: (it.themes ?? []).slice(0, 12),
          demographics: (it.demographics ?? []).slice(0, 6),
          serialization: it.serialization ?? null,
        },
      };
    }
    return undefined;
  }, [data?.item, mediaType]);

  if (loading && !data) {
    return (
      <motion.div {...visibleEnterProps}>
        <ItemPageSkeleton />
      </motion.div>
    );
  }

  if (error && !data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-4">
            <p className="text-[var(--color-light)]">{error}</p>
            <div className="flex gap-2">
              <Button
                onClick={() => fetchItem()}
              >
                {t("common.tryAgain")}
              </Button>
              <Button
                variant="ghost"
                className="text-sm text-[var(--color-lightest)] underline hover:no-underline"
                onClick={onBack}
              >
                {t("itemPage.back")}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div {...visibleEnterProps}>
        <ItemPageSkeleton />
      </motion.div>
    );
  }

  const { item, reviews, meanGrade, reviewsTotal = 0, reviewsPage: currentPage = 1, reviewsLimit: pageSize = REVIEWS_PAGE_SIZE } = data;
  const label = t(`nav.${mediaType}`);
  const totalPages = Math.max(1, Math.ceil(reviewsTotal / pageSize));
  const showPagination = reviewsTotal > pageSize;

  const heroUrl = getItemDisplayImageUrl(item.image, item.thumbnail);
  const headerImageUrl = getItemHeaderImageUrl(item.cover, item.image, item.thumbnail, dropCover);
  const headerUsesCover = !dropCover && Boolean(getHeroImageUrl(item.cover));
  const sections = [
    ["log", t("itemPage.sectionLog")],
    ["details", t("itemPage.sectionDetails")],
    ["reviews", t("itemPage.sectionReviews")],
  ] as const;

  const showSection = (next: (typeof sections)[number][0]) => {
    setSection(next);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => {
        sectionNavRef.current?.scrollIntoView({ block: "start", inline: "nearest" });
      });
    }
  };

  return (
    <motion.div {...visibleEnterProps} className="min-w-0 overflow-x-hidden">
      <div className="item-page-layout">
        <header className="relative isolate min-w-0 overflow-hidden rounded-2xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] lg:col-span-full lg:grid lg:min-h-[18rem] lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-end lg:gap-6 lg:p-5">
          {headerImageUrl ? (
            <img
              src={headerImageUrl}
              alt=""
              className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center"
              onError={() => {
                if (headerUsesCover) setDropCover(true);
              }}
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/85 via-black/55 to-black/30 lg:bg-gradient-to-r lg:from-black/80 lg:via-black/55 lg:to-black/45" />
          {heroUrl ? (
            <ItemImage
              src={heroUrl}
              alt=""
              mediaType={mediaType}
              boardGameSource={item.itemSource ?? null}
              loading="eager"
              className="relative z-10 hidden aspect-[2/3] w-full rounded-xl shadow-lg ring-1 ring-white/20 lg:block"
            />
          ) : null}
          <div className={cn("relative z-10 flex min-h-[15.5rem] min-w-0 flex-col justify-between gap-4 p-3.5 text-white lg:min-h-0 lg:justify-center lg:gap-5 lg:p-0", !heroUrl && "lg:col-span-2")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="inline-flex w-fit max-w-full flex-row flex-nowrap items-center gap-2 self-start border-white/40 bg-black/50 text-white hover:bg-black/65 hover:text-white max-md:min-h-11"
              onClick={onBack}
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{t("itemPage.back")}</span>
            </Button>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/80">{label}</p>
                {mediaType === "boardgames" && item.averageWeight != null && item.averageWeight > 0 && (
                  <span
                    className="rounded-full border border-white/30 px-2 py-0.5 text-xs font-semibold text-white"
                    title={t("itemPage.weight")}
                  >
                    {formatBoardGameWeight(item.averageWeight)}
                  </span>
                )}
              </div>
              <h1 className="page-title break-words text-white">{item.title}</h1>
              {(item.year || item.subtitle) && (
                <p className="break-words text-sm text-white/80">
                  {[item.year, item.subtitle].filter(Boolean).join(" · ")}
                </p>
              )}
              {mediaType === "games" &&
                item.timeToBeatHours != null &&
                item.timeToBeatHours > 0 && (() => {
                  const { hours, minutes } = formatTimeToBeatHours(item.timeToBeatHours);
                  const value =
                    minutes > 0
                      ? t("itemPage.timeToBeatHoursMinutes", {
                          hours: String(hours),
                          minutes: String(minutes),
                        })
                      : t("itemPage.timeToBeatHours", { hours: String(hours) });
                  return (
                    <p className="break-words text-sm text-white/80">
                      {t("itemPage.timeToBeat")}: {value}
                    </p>
                  );
                })()}
              {meanGrade != null && (
                <div className="mt-1 flex min-w-0 max-w-full flex-wrap items-center gap-2">
                  <StarRating value={gradeToStars(meanGrade)} readOnly size="md" />
                  <span className="min-w-0 text-sm text-white/80">
                    ({reviewsTotal} review{reviewsTotal === 1 ? "" : "s"})
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        <nav
          ref={sectionNavRef}
          className="sticky top-0 z-20 -mx-3.5 bg-[var(--color-darkest)] px-3.5 py-2 md:-mx-7 md:px-7 lg:hidden"
          aria-label={t("itemPage.sectionLog")}
        >
          <div className="grid grid-cols-3 gap-1.5" role="tablist">
            {sections.map(([id, sectionLabel]) => {
              const selected = section === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={cn(
                    "inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border px-2 text-sm font-semibold",
                    selected
                      ? "border-transparent bg-[var(--color-lightest)] text-[var(--color-darkest)]"
                      : "border-[var(--color-mid)]/40 bg-transparent text-[var(--color-light)]"
                  )}
                  onClick={() => showSection(id)}
                >
                  <span className="truncate">{sectionLabel}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className={cn("min-w-0", section !== "log" && "max-lg:hidden")}>
          {token ? (
            <ItemReviewForm
              mediaType={mediaType}
              externalId={id}
              title={item.title}
              image={heroUrl}
              runtimeMinutes={item.runtimeMinutes ?? null}
              episodesCount={item.episodesCount ?? null}
              pagesCount={item.pagesCount ?? null}
              platforms={item.platforms ?? null}
              genres={
                mediaType === "boardgames"
                  ? (item.categories ?? item.genres ?? undefined)
                  : (item.genres ?? undefined)
              }
              mechanics={mediaType === "boardgames" ? (item.mechanics ?? undefined) : undefined}
              affinityContextDraft={affinityContextDraft}
              onSaved={refreshReviewsAfterSave}
              onSavedComplete={(state) => showLogComplete(state, onBack)}
            />
          ) : (
            <Card className="border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-4 shadow-none">
              <p className="text-center text-sm text-[var(--color-light)] [overflow-wrap:anywhere]">
                <Link
                  to="/login"
                  className="text-[var(--color-lightest)] underline hover:no-underline"
                >
                  {t("itemPage.logInLink")}
                </Link>{" "}
                {t("itemPage.logInToReview")}
              </p>
            </Card>
          )}
        </div>

        <aside
          className={cn(
            "min-w-0 empty:hidden lg:sticky lg:top-3 lg:col-start-2 lg:row-start-2 lg:row-span-2 lg:max-h-[calc(100dvh-6.5rem)] lg:min-h-0 lg:self-start lg:overflow-y-auto lg:overscroll-contain",
            section !== "details" && "max-lg:hidden"
          )}
        >
          <ItemDetailsBlock item={item} mediaType={mediaType} t={t} androidWebView={androidWebView} />
        </aside>

        <div className={cn("flex min-w-0 flex-col gap-4 lg:col-start-1", section !== "reviews" && "max-lg:hidden")}>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="min-w-0 shrink-0 text-xl font-semibold text-[var(--color-lightest)]">
              <OverflowMarquee>{t("common.reviews")}</OverflowMarquee>
            </h2>
            {reviews.length > 0 && (
              <div className="min-w-0 w-full sm:min-w-[12rem] sm:max-w-lg sm:flex-1">
                <Select
                  value={reviewsSort}
                  onValueChange={(v) => {
                    setReviewsSort(v as ReviewSortKey);
                    setReviewsPage(1);
                  }}
                  options={[
                    { value: "recent", label: t("reviews.sortRecent") },
                    { value: "oldest", label: t("reviews.sortOldest") },
                    { value: "likes", label: t("reviews.sortLikes") },
                    { value: "dislikes", label: t("reviews.sortDislikes") },
                  ]}
                  className="min-w-0 w-full"
                  triggerClassName="h-10 w-full min-w-0 max-w-none"
                  aria-label={t("reviews.sortBy")}
                />
              </div>
            )}
          </div>
          {reviewsLoading ? (
            <Card className="border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-6 shadow-none">
              <p className="text-center text-[var(--color-light)]">
                {t("search.searching")}
              </p>
            </Card>
          ) : reviews.length === 0 ? (
            <Card className="border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-6 shadow-none">
              <p className="text-center text-[var(--color-light)]">
                {t("common.noReviews")}
              </p>
            </Card>
          ) : (
            <>
              <motion.div {...listStaggerParentProps}>
                <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
                  {reviewDisplayGroups.map((group) => {
                    const showRev = pickShowItemReview(group.reviews);
                    const partials = sortUserScopedReviews(partialItemReviews(group.reviews));
                    const expanded = expandedReviewUsers.has(group.userId);
                    const threadPartials = showRev ? partials : partials.slice(1);
                    const mainReview = showRev ?? partials[0] ?? group.reviews[0]!;
                    const extraCount = threadPartials.length;
                    const listBorderClass = reviewStatusBorderClass(mainReview);
                    const mainReactionReview = showRev ?? mainReview;

                    return (
                      <motion.div
                        key={group.userId}
                        variants={listStaggerItemVariants}
                        className={listStaggerItemClassName}
                      >
                        <Card
                          className={cn("min-w-0 overflow-hidden bg-[var(--color-dark)] p-0 shadow-none", listBorderClass)}
                        >
                          <div className="flex flex-col gap-4 p-4 sm:p-5">
                            <ItemReviewProfileLink
                              review={mainReview}
                              mediaType={mediaType}
                              className="-m-1 p-1"
                            >
                              <ItemReviewAuthorRow r={mainReview} mediaType={mediaType} t={t} />

                              <div className="mt-4 flex flex-col gap-4 border-b border-[var(--color-surface-border)]/60 pb-4">
                                <ItemReviewMetaRow
                                  r={mainReview}
                                  locale={locale}
                                  t={t}
                                  mediaType={mediaType}
                                  scopedReviewsDisplay={scopedReviewsDisplay}
                                  showScopeBadge={!showRev}
                                />
                                {mainReview.review && (
                                  <p className="max-w-none whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-lightest)] [overflow-wrap:anywhere]">
                                    {mainReview.review}
                                  </p>
                                )}
                              </div>
                            </ItemReviewProfileLink>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <ItemReviewReactionButtons
                                r={mainReactionReview}
                                token={token}
                                onReactionChange={handleReviewReactionChange}
                              />
                              {extraCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedReviewUsers((prev) => {
                                      const next = new Set(prev);
                                      if (expanded) next.delete(group.userId);
                                      else next.add(group.userId);
                                      return next;
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-mid)]/40 px-2 py-1 text-xs text-[var(--color-light)] transition-colors hover:border-[var(--color-mid)] hover:text-[var(--color-lightest)]"
                                  aria-expanded={expanded}
                                >
                                  {!expanded && <Plus className="h-3.5 w-3.5" aria-hidden />}
                                  {expanded
                                    ? t("tvReviews.hideAllReviews")
                                    : extraCount === 1
                                      ? t("tvReviews.showAllReviews_one")
                                      : t("tvReviews.showAllReviews_other", {
                                          count: String(extraCount),
                                        })}
                                </button>
                              )}
                            </div>

                            {expanded && threadPartials.length > 0 && (
                              <div className="flex flex-col gap-4 border-t border-[var(--color-surface-border)]/40 pt-4">
                                {threadPartials.map((partial) => (
                                  <div
                                    key={partial.id}
                                    className="relative ml-1 border-l-2 border-[var(--color-mid)]/40 pl-4"
                                  >
                                    <ItemReviewProfileLink review={partial} mediaType={mediaType}>
                                      <div className="flex flex-col gap-3 py-1">
                                        <ItemReviewMetaRow
                                          r={partial}
                                          locale={locale}
                                          t={t}
                                          mediaType={mediaType}
                                          scopedReviewsDisplay={scopedReviewsDisplay}
                                        />
                                        {partial.review && (
                                          <p className="max-w-none whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-lightest)] [overflow-wrap:anywhere]">
                                            {partial.review}
                                          </p>
                                        )}
                                      </div>
                                    </ItemReviewProfileLink>
                                    <ItemReviewReactionButtons
                                      r={partial}
                                      token={token}
                                      onReactionChange={handleReviewReactionChange}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
              {showPagination && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-surface-border)] pt-4">
                  <p className="text-sm text-[var(--color-light)]">
                    {t("reviews.pageOf", { current: String(currentPage), total: String(totalPages), count: String(reviewsTotal) })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={reviewsLoading || currentPage <= 1}
                      onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                    >
                      {t("reviews.prev")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={reviewsLoading || currentPage >= totalPages}
                      onClick={() => setReviewsPage((p) => Math.min(totalPages, p + 1))}
                    >
                      {t("reviews.next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
