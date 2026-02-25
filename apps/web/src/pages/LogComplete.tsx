import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { ItemImage } from "@/components/ItemImage";
import { useLocale } from "@/contexts/LocaleContext";
import { modalContentVariants } from "@/lib/animations";

export function LogComplete() {
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LogCompleteState | null;

  useEffect(() => {
    if (!state) navigate("/", { replace: true });
  }, [state, navigate]);

  if (!state) return null;

  const { image, title, grade, mediaType, id } = state;
  const stars = grade != null ? gradeToStars(grade) : 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-darkest)] p-4">
      <motion.div
        initial="initial"
        animate="animate"
        variants={modalContentVariants}
        className="w-full max-w-[380px] text-center"
      >
        <div className="rounded-xl border border-[var(--color-dark)] bg-[var(--color-dark)] p-8 shadow-[var(--shadow-modal)]">
          <p className="mb-4 text-sm font-medium uppercase tracking-wide text-[var(--color-mid)]">
            {t("logComplete.logged")}
          </p>
          <div className="mb-4 flex justify-center">
            <ItemImage src={image} className="h-40 w-28 rounded-lg shadow-lg" />
          </div>
          <h1 className="mb-3 text-xl font-bold text-[var(--color-lightest)] line-clamp-2">
            {title}
          </h1>
          {grade != null && (
            <div className="mb-6 flex justify-center">
              <StarRating value={stars} readOnly size="lg" />
            </div>
          )}
          <div className="flex flex-col gap-3">
            {mediaType && id && (
              <Button asChild className="w-full">
                <Link to={`/item/${mediaType}/${id}`}>
                  {t("logComplete.viewItem")}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link to="/">{t("logComplete.backToDashboard")}</Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
