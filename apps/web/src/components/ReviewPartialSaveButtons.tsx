import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReviewPartialSaveButtonsProps = {
  saving: boolean;
  isUpdate?: boolean;
  partialDisabled?: boolean;
  onPartialSave: () => void;
  onPrimarySave: () => void;
  t: (key: string) => string;
  className?: string;
};

export function ReviewPartialSaveButtons({
  saving,
  isUpdate = false,
  partialDisabled = false,
  onPartialSave,
  onPrimarySave,
  t,
  className,
}: ReviewPartialSaveButtonsProps) {
  const compactBtn =
    "min-w-0 whitespace-normal px-2 text-xs leading-tight sm:h-10 sm:px-4 sm:text-sm";

  const showLabel = saving
    ? t("common.saving")
    : isUpdate
      ? t("itemReviewForm.updateShowReview")
      : t("itemReviewForm.saveShowReview");

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-1 sm:flex-row sm:gap-3",
        className
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(compactBtn, "sm:flex-1")}
        disabled={saving || partialDisabled}
        onClick={() => void onPartialSave()}
      >
        <span className="sm:hidden">{t("itemReviewForm.saveEpisodeSeasonReviewShort")}</span>
        <span className="hidden sm:inline">{t("itemReviewForm.saveEpisodeSeasonReview")}</span>
      </Button>
      <Button
        type="button"
        size="sm"
        className={cn(compactBtn, "sm:flex-1")}
        disabled={saving}
        onClick={() => void onPrimarySave()}
      >
        <span className="sm:hidden">
          {saving
            ? t("common.saving")
            : isUpdate
              ? t("itemReviewForm.updateShowReviewShort")
              : t("itemReviewForm.saveShowReviewShort")}
        </span>
        <span className="hidden sm:inline">{showLabel}</span>
      </Button>
    </div>
  );
}
