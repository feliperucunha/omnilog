import { Button } from "@/components/ui/button";
import type { PartialReviewSaveKind } from "@/lib/partialTvReview";
import { cn } from "@/lib/utils";

type ReviewPartialSaveButtonsProps = {
  saving: boolean;
  isUpdate?: boolean;
  partialSaveKind?: PartialReviewSaveKind | null;
  onPartialSave: () => void;
  onPrimarySave: () => void;
  t: (key: string) => string;
  className?: string;
};

export function ReviewPartialSaveButtons({
  saving,
  isUpdate = false,
  partialSaveKind = null,
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

  const primaryButton = (
    <Button
      type="button"
      size="sm"
      className={cn(compactBtn, partialSaveKind ? "sm:flex-1" : "w-full")}
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
  );

  if (!partialSaveKind) {
    return <div className={cn("min-w-0", className)}>{primaryButton}</div>;
  }

  const partialShortKey =
    partialSaveKind === "season"
      ? "itemReviewForm.saveSeasonReviewShort"
      : "itemReviewForm.saveEpisodeReviewShort";
  const partialLongKey =
    partialSaveKind === "season"
      ? "itemReviewForm.saveSeasonReview"
      : "itemReviewForm.saveEpisodeReview";

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
        disabled={saving}
        onClick={() => void onPartialSave()}
      >
        <span className="sm:hidden">{t(partialShortKey)}</span>
        <span className="hidden sm:inline">{t(partialLongKey)}</span>
      </Button>
      {primaryButton}
    </div>
  );
}
