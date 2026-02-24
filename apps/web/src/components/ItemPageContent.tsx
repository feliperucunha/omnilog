import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { STATUS_I18N_KEYS, type ItemPageData, type ItemReview, type MediaType } from "@logeverything/shared";
import { apiFetchCached } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ItemReviewForm } from "@/components/ItemReviewForm";
import { ItemPageSkeleton } from "@/components/skeletons";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish, formatTimeToBeatHours } from "@/lib/formatDuration";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

export interface ItemPageContentProps {
  mediaType: MediaType;
  id: string;
  onBack: () => void;
}

const REVIEWS_PAGE_SIZE = 10;

export function ItemPageContent({ mediaType, id, onBack }: ItemPageContentProps) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [data, setData] = useState<ItemPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewsPage, setReviewsPage] = useState(1);
  const { token } = useAuth();

  const refetch = useCallback((page = 1) => {
    setError(null);
    setLoading(true);
    const params = new URLSearchParams({
      reviewsPage: String(page),
      reviewsLimit: String(REVIEWS_PAGE_SIZE),
    });
    apiFetchCached<ItemPageData>(
      `/items/${mediaType}/${id}?${params.toString()}`,
      { ttlMs: 5 * 60 * 1000 }
    )
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : t("dashboard.couldntLoadLogs")))
      .finally(() => setLoading(false));
  }, [mediaType, id, t]);

  useEffect(() => {
    setReviewsPage(1);
  }, [mediaType, id]);

  useEffect(() => {
    refetch(reviewsPage);
  }, [refetch, reviewsPage]);

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
                className="bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
                onClick={() => refetch(reviewsPage)}
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

        {token && (
          <ItemReviewForm
            mediaType={mediaType}
            externalId={id}
            title={item.title}
            image={item.image}
            runtimeMinutes={item.runtimeMinutes ?? null}
            onSaved={() => setReviewsPage(1)}
            onSavedComplete={(state) => navigate("/log-complete", { state })}
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
            {reviews.length === 0 ? (
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
                      className="border-[var(--color-mid)] bg-[var(--color-dark)] text-[var(--color-lightest)] hover:bg-[var(--color-mid)]"
                      disabled={currentPage <= 1}
                      onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                    >
                      {t("reviews.prev")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[var(--color-mid)] bg-[var(--color-dark)] text-[var(--color-lightest)] hover:bg-[var(--color-mid)]"
                      disabled={currentPage >= totalPages}
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
