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
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

export interface ItemPageContentProps {
  mediaType: MediaType;
  id: string;
  onBack: () => void;
}

export function ItemPageContent({ mediaType, id, onBack }: ItemPageContentProps) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [data, setData] = useState<ItemPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const refetch = useCallback(() => {
    setError(null);
    setLoading(true);
    apiFetchCached<ItemPageData>(`/items/${mediaType}/${id}`, { ttlMs: 5 * 60 * 1000 })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : t("dashboard.couldntLoadLogs")))
      .finally(() => setLoading(false));
  }, [mediaType, id, t]);

  useEffect(() => {
    refetch();
  }, [refetch]);

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
                onClick={refetch}
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

  const { item, reviews, meanGrade } = data;
  const label = t(`nav.${mediaType}`);

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
          <div
            className="h-64 w-44 flex-shrink-0 overflow-hidden rounded-xl bg-[var(--color-darkest)] shadow-[var(--shadow-card)]"
          >
            {item.image ? (
              <img
                src={item.image}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--color-mid)]">
                {t("common.noImage")}
              </div>
            )}
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
            {meanGrade != null && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StarRating value={gradeToStars(meanGrade)} readOnly size="md" />
                <span className="text-sm text-[var(--color-light)]">
                  ({reviews.filter((r) => r.grade != null).length} review
                  {reviews.filter((r) => r.grade != null).length === 1 ? "" : "s"})
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
            onSaved={refetch}
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
          )}
        </div>
      </div>
    </motion.div>
  );
}
