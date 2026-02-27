import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { STATUS_I18N_KEYS, type ItemDetail, type ItemPageData, type ItemReview, type MediaType } from "@logeverything/shared";
import { apiFetchCached } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLogComplete } from "@/contexts/LogCompleteContext";
import { ItemReviewForm } from "@/components/ItemReviewForm";
import { ItemPageSkeleton } from "@/components/skeletons";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish, formatTimeToBeatHours } from "@/lib/formatDuration";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

function ItemDetailsBlock({ item, mediaType, t }: { item: ItemDetail; mediaType: MediaType; t: (key: string, params?: Record<string, string>) => string }) {
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
      className="border-[var(--color-dark)] bg-[var(--color-dark)] p-5 sm:p-6 flex flex-col gap-5"
      style={paperShadow}
    >
      {hasTagline && (
        <p className="text-[var(--color-light)] italic text-center text-sm sm:text-base border-b border-[var(--color-mid)]/20 pb-4">
          &ldquo;{item.tagline}&rdquo;
        </p>
      )}
      {hasDescription && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-light)] mb-2">
            {t("itemPage.description")}
          </h3>
          <p className="text-[var(--color-lightest)] text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
            {item.description}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {hasGenres &&
          item.genres!.map((g) => (
            <span
              key={g}
              className="rounded-full bg-[var(--color-mid)]/40 px-3 py-1 text-xs font-medium text-[var(--color-lightest)]"
            >
              {g}
            </span>
          ))}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
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
          <div className="col-span-2 sm:col-span-3">
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
          <div className="col-span-2 sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.platforms")}: </span>
            <span className="text-[var(--color-lightest)]">{item.platforms!.join(", ")}</span>
          </div>
        )}
        {hasProductionCountries && (
          <div className="col-span-2 sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.productionCountries")}: </span>
            <span className="text-[var(--color-lightest)]">{item.productionCountries!.join(", ")}</span>
          </div>
        )}
        {hasSpokenLanguages && (
          <div className="col-span-2 sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.spokenLanguages")}: </span>
            <span className="text-[var(--color-lightest)]">{item.spokenLanguages!.join(", ")}</span>
          </div>
        )}
        {hasNetworks && (
          <div className="col-span-2 sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.networks")}: </span>
            <span className="text-[var(--color-lightest)]">{item.networks!.join(", ")}</span>
          </div>
        )}
        {hasDevelopers && (
          <div className="col-span-2 sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.developers")}: </span>
            <span className="text-[var(--color-lightest)]">{item.developers!.join(", ")}</span>
          </div>
        )}
        {hasPublishers && (
          <div className="col-span-2 sm:col-span-3">
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
          <div className="col-span-2 sm:col-span-3">
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
          <div className="col-span-2 sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.categories")}: </span>
            <span className="text-[var(--color-lightest)]">{item.categories!.join(", ")}</span>
          </div>
        )}
        {hasMechanics && (
          <div className="col-span-2 sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.mechanics")}: </span>
            <span className="text-[var(--color-lightest)]">{item.mechanics!.join(", ")}</span>
          </div>
        )}
        {hasStudios && (
          <div className="col-span-2 sm:col-span-3">
            <span className="text-[var(--color-light)]">{t("itemPage.studios")}: </span>
            <span className="text-[var(--color-lightest)]">{item.studios!.join(", ")}</span>
          </div>
        )}
        {hasThemes && (
          <div className="col-span-2 sm:col-span-3">
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

interface ReviewsResponse {
  reviews: ItemReview[];
  meanGrade: number | null;
  reviewsTotal: number;
  reviewsPage: number;
  reviewsLimit: number;
}

export function ItemPageContent({ mediaType, id, onBack }: ItemPageContentProps) {
  const { t } = useLocale();
  const { showLogComplete } = useLogComplete();
  const [data, setData] = useState<ItemPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewsPage, setReviewsPage] = useState(1);
  const { token } = useAuth();

  const fetchItem = useCallback(() => {
    setError(null);
    setLoading(true);
    const params = new URLSearchParams({
      reviewsPage: "1",
      reviewsLimit: "0",
    });
    apiFetchCached<ItemPageData>(
      `/items/${mediaType}/${id}?${params.toString()}`,
      { ttlMs: 5 * 60 * 1000 }
    )
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : t("dashboard.couldntLoadLogs")))
      .finally(() => setLoading(false));
  }, [mediaType, id, t]);

  const fetchReviews = useCallback(
    (page: number) => {
      setReviewsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(REVIEWS_PAGE_SIZE),
      });
      apiFetchCached<ReviewsResponse>(
        `/items/${mediaType}/${id}/reviews?${params.toString()}`,
        { ttlMs: 2 * 60 * 1000 }
      )
        .then((res) => {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  reviews: res.reviews,
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
    fetchReviews(reviewsPage);
  }, [data?.item, reviewsPage, fetchReviews]);

  if (loading && !data) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
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
        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
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

  if (!data) return null;

  const { item, reviews, meanGrade, reviewsTotal = 0, reviewsPage: currentPage = 1, reviewsLimit: pageSize = REVIEWS_PAGE_SIZE } = data;
  const label = t(`nav.${mediaType}`);
  const totalPages = Math.max(1, Math.ceil(reviewsTotal / pageSize));
  const showPagination = reviewsTotal > pageSize;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="flex flex-col gap-8">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit bg-transparent cursor-pointer hover:bg-[var(--color-dark)]"
          onClick={onBack}
        >
          <ArrowLeft size={20} />
          {t("itemPage.back")}
        </Button>
        <div className="flex flex-wrap items-start gap-6">
          <div className="h-64 w-44 flex-shrink-0 rounded-xl shadow-[var(--shadow-card)]">
            <ItemImage src={item.image} className="h-full w-full rounded-xl" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm font-medium uppercase text-[var(--color-light)]">
              {label}
            </p>
            <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
              {item.title}
            </h1>
            {(item.year || item.subtitle) && (
              <p className="text-[var(--color-light)]">
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
                  <p className="text-[var(--color-light)]">
                    {t("itemPage.timeToBeat")}: {value}
                  </p>
                );
              })()}
            {meanGrade != null && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StarRating value={gradeToStars(meanGrade)} readOnly size="md" />
                <span className="text-sm text-[var(--color-light)]">
                  ({reviewsTotal} review{reviewsTotal === 1 ? "" : "s"})
                </span>
              </div>
            )}
          </div>
        </div>

        <ItemDetailsBlock item={item} mediaType={mediaType} t={t} />

        {token && (
          <ItemReviewForm
            mediaType={mediaType}
            externalId={id}
            title={item.title}
            image={item.image}
            runtimeMinutes={item.runtimeMinutes ?? null}
            episodesCount={item.episodesCount ?? null}
            onSaved={() => setReviewsPage(1)}
            onSavedComplete={(state) => showLogComplete(state)}
          />
        )}

        {!token && (
          <Card
            className="border-[var(--color-dark)] bg-[var(--color-dark)] p-4"
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
          <h2 className="text-xl font-semibold text-[var(--color-lightest)]">
            {t("common.reviews")}
          </h2>
          {reviewsLoading ? (
            <Card
              className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6"
              style={paperShadow}
            >
              <p className="text-center text-[var(--color-light)]">
                {t("search.searching")}
              </p>
            </Card>
          ) : reviews.length === 0 ? (
            <Card
              className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6"
              style={paperShadow}
            >
              <p className="text-center text-[var(--color-light)]">
                {t("common.noReviews")}
              </p>
            </Card>
          ) : (
            <>
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                <div className="flex flex-col gap-4">
                  {reviews.map((r: ItemReview) => (
                    <motion.div key={r.id} variants={staggerItem}>
                      <Card
                        className="border-[var(--color-dark)] bg-[var(--color-dark)] p-4"
                        style={paperShadow}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-lightest)]">
                            {r.userEmail}
                          </span>
                          {r.isPro && (
                            <span
                              className="rounded bg-[var(--btn-gradient-start)]/20 px-1.5 py-0.5 text-xs font-semibold text-[var(--btn-gradient-start)]"
                              title="Pro"
                            >
                              Pro
                            </span>
                          )}
                          {r.grade != null && (
                            <StarRating value={gradeToStars(r.grade)} readOnly size="sm" />
                          )}
                          {(r.status ?? r.listType) && (
                            <span
                              className="rounded bg-[var(--color-darkest)] px-1.5 py-0.5 text-xs text-[var(--color-light)]"
                            >
                              {t(`status.${STATUS_I18N_KEYS[r.status ?? r.listType ?? ""] ?? r.status ?? r.listType}`)}
                            </span>
                          )}
                          {(r.season != null || r.episode != null) && (
                            <span className="text-xs text-[var(--color-light)]">
                              S{r.season ?? "?"} E{r.episode ?? "?"}
                            </span>
                          )}
                          {(r.chapter != null || r.volume != null) && (
                            <span className="text-xs text-[var(--color-light)]">
                              Ch.{r.chapter ?? "?"} Vol.{r.volume ?? "?"}
                            </span>
                          )}
                          {r.startedAt && r.completedAt && (
                            <span className="text-xs text-[var(--color-light)]">
                              {t("dashboard.finishedIn", { duration: formatTimeToFinish(r.startedAt, r.completedAt) })}
                            </span>
                          )}
                          <span className="text-sm text-[var(--color-light)]">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {r.review && (
                          <p
                            className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-lightest)]"
                          >
                            {r.review}
                          </p>
                        )}
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
              {showPagination && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-dark)] pt-4">
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
