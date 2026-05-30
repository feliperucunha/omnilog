import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ChevronDown, Plus } from "lucide-react";
import {
  COMPLETED_STATUSES,
  IN_PROGRESS_STATUSES,
  compareScopeGenerality,
  groupItemReviewsByUser,
  pickPrimaryScopedReview,
  type ItemDetail,
  type ItemPageData,
  type ItemReview,
  type LogAffinityContext,
  type MediaType,
  type ReviewScope,
} from "@geeklogs/shared";
import { ReactionButtons } from "@/components/ReactionButtons";
import { getStatusLabel } from "@/lib/statusLabel";
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
import { GenreBadges } from "@/components/GenreBadges";
import { LevelBadge } from "@/components/LevelBadge";
import { MEDIA_BADGE_ICONS } from "@/lib/mediaBadgeIcons";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToBeatHours } from "@/lib/formatDuration";
import { getItemDisplayImageUrl, cssBackgroundImageUrl } from "@/lib/getHeroImageUrl";
import {
  BGG_BLUR_BACKDROP_IMG_CLASS,
  BGG_CONTAIN_FOREGROUND_IMG_CLASS,
  isBggBoardGameImageContext,
} from "@/lib/boardGameImageFit";
import { listStaggerItemClassName, listStaggerItemVariants, listStaggerParentProps, visibleEnterProps } from "@/lib/motionPolicy";
import { useLocale } from "@/contexts/LocaleContext";
import { paperShadow } from "@/lib/paperShadow";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { isCapacitorAndroid } from "@/lib/androidOverlayBack";
import { cn } from "@/lib/utils";

/** Android WebView: `filter: blur()` on the BGG backdrop can break compositing so body text never paints. */
const BGG_BACKDROP_ANDROID_CLASS =
  "pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover object-center opacity-[0.55]";

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
  const hasContentRating = item.contentRating && item.contentRating.length > 0;
  const hasEpisodes = item.episodesCount != null && item.episodesCount > 0;
  const hasSeasons = item.seasonsCount != null && item.seasonsCount > 0;
  const hasPlayers = (item.playersMin != null || item.playersMax != null);
  const hasPlayingTime = item.playingTimeMinutes != null && item.playingTimeMinutes > 0;
  const hasAuthors = item.authors && item.authors.length > 0;
  const hasPublisher = item.publisher && item.publisher.length > 0;
  const hasIssues = item.issuesCount != null && item.issuesCount > 0;
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
    hasContentRating ||
    hasEpisodes ||
    hasSeasons ||
    hasPlayers ||
    hasPlayingTime ||
    hasAuthors ||
    hasPublisher ||
    hasIssues ||
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
        "flex min-w-0 flex-col gap-5 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-5 sm:p-6",
        /* Android: `overflow-hidden` + long description has clipped the whole card’s text layer in WebView; keep horizontal clip only. */
        androidWebView ? "overflow-x-hidden" : "overflow-hidden"
      )}
      style={paperShadow}
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
        {hasScore && scoreDisplay && (
          <span className="inline-flex items-center rounded-md bg-[var(--btn-gradient-start)]/30 px-2.5 py-1 text-sm font-semibold text-[var(--color-lightest)]">
            {scoreDisplay}/10
          </span>
        )}
        {hasContentRating && (
          <span className="rounded border border-[var(--color-mid)] px-2 py-0.5 text-xs text-[var(--color-light)]">
            {item.contentRating}
          </span>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
        {hasReleaseDate && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.releaseDate")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.releaseDate}</span>
          </div>
        )}
        {hasStatus && (
          <div>
            <span className="text-[var(--color-light)]">{t("itemPage.status")}: </span>
            <span className="text-[var(--color-lightest)] font-medium">{item.status}</span>
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
        {hasAuthors && (
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
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
        {hasPlatforms && (
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.platforms")}: </span>
            <span className="text-[var(--color-lightest)]">{item.platforms!.join(", ")}</span>
          </div>
        )}
        {hasProductionCountries && (
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.productionCountries")}: </span>
            <span className="text-[var(--color-lightest)]">{item.productionCountries!.join(", ")}</span>
          </div>
        )}
        {hasSpokenLanguages && (
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.spokenLanguages")}: </span>
            <span className="text-[var(--color-lightest)]">{item.spokenLanguages!.join(", ")}</span>
          </div>
        )}
        {hasNetworks && (
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.networks")}: </span>
            <span className="text-[var(--color-lightest)]">{item.networks!.join(", ")}</span>
          </div>
        )}
        {hasDevelopers && (
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.developers")}: </span>
            <span className="text-[var(--color-lightest)]">{item.developers!.join(", ")}</span>
          </div>
        )}
        {hasPublishers && (
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
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
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
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
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.categories")}: </span>
            <span className="text-[var(--color-lightest)]">{item.categories!.join(", ")}</span>
          </div>
        )}
        {hasMechanics && (
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.mechanics")}: </span>
            <span className="text-[var(--color-lightest)]">{item.mechanics!.join(", ")}</span>
          </div>
        )}
        {hasStudios && (
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.studios")}: </span>
            <span className="text-[var(--color-lightest)]">{item.studios!.join(", ")}</span>
          </div>
        )}
        {hasThemes && (
          <div className="col-span-2 min-w-0 break-words sm:col-span-3">
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
          <div className="col-span-2 sm:col-span-3">
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
        <div className="col-span-2 sm:col-span-3 pt-2 mt-2 border-t border-[var(--color-mid)]/20 space-y-1">
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
  const { token } = useAuth();
  const { setPageTitle } = usePageTitle() ?? {};

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

  const scopedReviewsDisplay = mediaType === "tv";
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
      .map((g) => pickPrimaryScopedReview(g.reviews))
      .filter((p): p is ItemReview => p != null);
    const sortedPrimaries = sortReviewsByKey(primaries, reviewsSort);
    return sortedPrimaries.map((primary) => {
      const match = groups.find((g) => g.reviews.some((r) => r.id === primary.id));
      return match ?? { userId: primary.userId ?? primary.id, reviews: [primary] };
    });
  }, [pageReviews, scopedReviewsDisplay, reviewsSort]);

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
  const bggHeroFraming = isBggBoardGameImageContext(mediaType, heroUrl, item.itemSource ?? null, undefined);

  return (
    <motion.div {...visibleEnterProps} className="min-w-0 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-8">
        {/* Hero header: high-res image background with strong gradient for readable text */}
        <header className="relative min-h-[min(38vh,280px)] w-full overflow-hidden rounded-xl sm:min-h-[min(42vh,360px)]">
          {/* Background: BGG = blurred fill + full-bleed contain art; else CSS cover poster */}
          {heroUrl && bggHeroFraming ? (
            <div className="absolute inset-0 overflow-hidden bg-[var(--color-darkest)]">
              <img
                src={heroUrl}
                alt=""
                aria-hidden
                className={androidWebView ? BGG_BACKDROP_ANDROID_CLASS : BGG_BLUR_BACKDROP_IMG_CLASS}
                referrerPolicy="no-referrer"
              />
              <img
                src={heroUrl}
                alt=""
                className={BGG_CONTAIN_FOREGROUND_IMG_CLASS}
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div
              className="absolute inset-0 bg-[var(--color-darkest)] bg-cover bg-center bg-no-repeat"
              style={heroUrl ? { backgroundImage: cssBackgroundImageUrl(heroUrl) } : undefined}
            />
          )}
          {/* Strong gradient: dark scrim so text is always readable in both light and dark theme */}
          <div
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 25%, rgba(0,0,0,0.5) 50%, rgba(13,27,42,0.97) 75%)",
            }}
          />
          {/* Bottom bar: always dark so hero text has contrast in light theme */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] h-1/2 min-h-[140px]"
            style={{
              background: "linear-gradient(to bottom, transparent 0%, rgba(13,27,42,0.98) 55%)",
            }}
          />
          {/* Back button: always light text on dark scrim (readable in both themes) */}
          <div className="absolute left-0 top-0 z-10 p-2 sm:p-3">
            <Button
              variant="ghost"
              size="sm"
              className="max-md:min-h-[44px] max-md:min-w-[44px] rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/55 hover:text-white"
              onClick={onBack}
            >
              <ArrowLeft size={20} />
              {t("itemPage.back")}
            </Button>
          </div>
          {/* Title and meta: always light text on dark scrim (readable in both themes) */}
          <div className="absolute bottom-0 left-0 right-0 z-10 flex min-w-0 flex-col gap-1.5 p-4 pb-6 sm:p-6 sm:pb-8 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
            <div className="min-w-0">
              <OverflowMarquee className="text-sm font-medium uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {label}
              </OverflowMarquee>
            </div>
            <div role="heading" aria-level={1} className="min-w-0">
              <OverflowMarquee className="text-xl font-bold text-white sm:text-2xl md:text-3xl [text-shadow:0_2px_8px_rgba(0,0,0,0.95)]">
                {item.title}
              </OverflowMarquee>
            </div>
            {(item.year || item.subtitle) && (
              <p className="text-sm text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
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
                  <p className="text-sm text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                    {t("itemPage.timeToBeat")}: {value}
                  </p>
                );
              })()}
            {meanGrade != null && (
              <div className="mt-2 flex min-w-0 max-w-full flex-wrap items-center gap-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] [--color-light:rgb(255,255,255,0.9)] [--color-lightest:white]">
                <StarRating value={gradeToStars(meanGrade)} readOnly size="xl" />
                <span className="min-w-0 text-sm text-white/90">
                  ({reviewsTotal} review{reviewsTotal === 1 ? "" : "s"})
                </span>
              </div>
            )}
          </div>
        </header>

        <ItemDetailsBlock item={item} mediaType={mediaType} t={t} androidWebView={androidWebView} />

        {token && (
          <ItemReviewForm
            mediaType={mediaType}
            externalId={id}
            title={item.title}
            image={getItemDisplayImageUrl(item.image, item.thumbnail)}
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
        )}

        {!token && (
          <Card
            className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
            style={paperShadow}
          >
            <p className="text-center text-sm text-[var(--color-light)]">
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

        <div className="flex flex-col gap-4">
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
            <Card
              className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6"
              style={paperShadow}
            >
              <p className="text-center text-[var(--color-light)]">
                {t("search.searching")}
              </p>
            </Card>
          ) : reviews.length === 0 ? (
            <Card
              className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6"
              style={paperShadow}
            >
              <p className="text-center text-[var(--color-light)]">
                {t("common.noReviews")}
              </p>
            </Card>
          ) : (
            <>
              <motion.div {...listStaggerParentProps}>
                <div className="flex flex-col gap-4">
                  {reviewDisplayGroups.map((group) => {
                    const primary = pickPrimaryScopedReview(group.reviews) ?? group.reviews[0]!;
                    const expanded = expandedReviewUsers.has(group.userId);
                    const visible = expanded ? sortUserScopedReviews(group.reviews) : [primary];
                    const extraCount = group.reviews.length - 1;
                    return (
                      <Fragment key={group.userId}>
                        {visible.map((r, cardIndex) => {
                    const isDropped = r.status === "dropped";
                    const isInProgress = r.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(r.status);
                    const isCompleted = r.status != null && (COMPLETED_STATUSES as readonly string[]).includes(r.status);
                    const listBorderClass =
                      r.status == null
                        ? "border border-[var(--color-surface-border)]"
                        : isDropped
                          ? "border border-red-500"
                          : isInProgress
                            ? "border border-amber-400"
                            : isCompleted
                              ? "border border-emerald-600"
                              : "border border-[var(--color-mid)]";
                    return (
                    <motion.div key={r.id} variants={listStaggerItemVariants} className={listStaggerItemClassName}>
                      <Card
                        className={`overflow-hidden bg-[var(--color-dark)] p-0 ${listBorderClass}`}
                        style={paperShadow}
                      >
                        <div className="flex flex-col gap-4 p-4 sm:p-5">
                          {/* Author + all level badges */}
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

                          {/* Rating + date; on mobile status/episode badges go on next line */}
                          <div className="flex flex-col gap-2 border-b border-[var(--color-surface-border)]/60 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              {r.grade != null && (
                                <StarRating value={gradeToStars(r.grade)} readOnly size="md" />
                              )}
                              <time
                                className="text-xs text-[var(--color-light)]"
                                dateTime={r.createdAt}
                              >
                                {new Date(r.createdAt).toLocaleDateString(locale, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </time>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {(r.status ?? r.listType) && (
                                <span className="rounded-md bg-[var(--color-darkest)] px-2 py-1 text-xs text-[var(--color-light)]">
                                  {getStatusLabel(t, r.status ?? r.listType ?? null, mediaType)}
                                </span>
                              )}
                              {scopedReviewsDisplay && (r.reviewScope ?? "show") !== "show" && (
                                <span className="rounded-md bg-[var(--color-darkest)]/80 px-2 py-1 text-xs text-[var(--color-light)]">
                                  {reviewScopeLabel(t, r)}
                                </span>
                              )}
                              {!scopedReviewsDisplay && (r.season != null || r.episode != null) && (
                                <span className="rounded-md bg-[var(--color-darkest)]/80 px-2 py-1 text-xs text-[var(--color-light)]">
                                  S{r.season ?? "?"} · E{r.episode ?? "?"}
                                </span>
                              )}
                              {(r.chapter != null || r.volume != null) && (
                                <span className="rounded-md bg-[var(--color-darkest)]/80 px-2 py-1 text-xs text-[var(--color-light)]">
                                  Ch.{r.chapter ?? "?"} · Vol.{r.volume ?? "?"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Review body */}
                          {r.review && (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-lightest)] max-w-none">
                              {r.review}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                            <ReactionButtons
                              logId={r.reactionLogId ?? r.id}
                              likesCount={r.likesCount ?? 0}
                              dislikesCount={r.dislikesCount ?? 0}
                              userReaction={r.userReaction ?? null}
                              disabled={!token}
                              onReactionChange={(payload) => {
                                const reactionLogId = r.reactionLogId ?? r.id;
                                setData((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        reviews: prev.reviews.map((rev) =>
                                          rev.id === r.id || rev.reactionLogId === reactionLogId
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
                              }}
                            />
                            {cardIndex === 0 && extraCount > 0 && (
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
                                  : t("tvReviews.showAllReviews", { count: String(extraCount) })}
                              </button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                        })}
                      </Fragment>
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
