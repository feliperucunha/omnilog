import { ArrowDown, ArrowUp } from "lucide-react";
import type { MediaType } from "@geeklogs/shared";
import type { SelectOption } from "@/components/ui/select";

function sortOptionWithArrow(
  value: string,
  text: string,
  direction: "up" | "down",
  accessibleLabel?: string
): SelectOption {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return {
    value,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <span>{text}</span>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      </span>
    ),
    accessibleLabel: accessibleLabel ?? text,
  };
}

export function buildMediaLogsSortOptions(
  mediaType: MediaType,
  t: (key: string) => string
): SelectOption[] {
  const options: SelectOption[] = [
    { value: "dateDesc", label: t("mediaLogs.sortByDateDesc") },
    { value: "dateAsc", label: t("mediaLogs.sortByDateAsc") },
    sortOptionWithArrow("gradeAsc", t("itemReviewForm.rating"), "up", t("mediaLogs.sortByGradeAsc")),
    sortOptionWithArrow("gradeDesc", t("itemReviewForm.rating"), "down", t("mediaLogs.sortByGradeDesc")),
  ];
  if (mediaType === "boardgames") {
    options.push(
      sortOptionWithArrow(
        "matchesPlayedAsc",
        t("itemReviewForm.matchesPlayed"),
        "up",
        t("mediaLogs.sortByMatchesPlayedAsc")
      ),
      sortOptionWithArrow(
        "matchesPlayedDesc",
        t("itemReviewForm.matchesPlayed"),
        "down",
        t("mediaLogs.sortByMatchesPlayedDesc")
      ),
      sortOptionWithArrow(
        "weightAsc",
        t("itemPage.weight"),
        "up",
        t("mediaLogs.sortByWeightAsc")
      ),
      sortOptionWithArrow(
        "weightDesc",
        t("itemPage.weight"),
        "down",
        t("mediaLogs.sortByWeightDesc")
      )
    );
  } else if (mediaType === "games") {
    options.push(
      sortOptionWithArrow(
        "timeToBeatAsc",
        t("itemPage.timeToBeat"),
        "up",
        t("mediaLogs.sortByTimeToBeatAsc")
      ),
      sortOptionWithArrow(
        "timeToBeatDesc",
        t("itemPage.timeToBeat"),
        "down",
        t("mediaLogs.sortByTimeToBeatDesc")
      )
    );
  }
  return options;
}

export function buildExportLogsSortOptions(
  category: MediaType | "all",
  t: (key: string) => string
): SelectOption[] {
  const options: SelectOption[] = [
    { value: "dateDesc", label: t("mediaLogs.sortByDateDesc") },
    { value: "dateAsc", label: t("mediaLogs.sortByDateAsc") },
    sortOptionWithArrow("gradeDesc", t("itemReviewForm.rating"), "down", t("mediaLogs.sortByGradeDesc")),
    sortOptionWithArrow("gradeAsc", t("itemReviewForm.rating"), "up", t("mediaLogs.sortByGradeAsc")),
  ];
  if (category === "boardgames") {
    options.push(
      sortOptionWithArrow(
        "matchesPlayedDesc",
        t("itemReviewForm.matchesPlayed"),
        "down",
        t("mediaLogs.sortByMatchesPlayedDesc")
      ),
      sortOptionWithArrow(
        "matchesPlayedAsc",
        t("itemReviewForm.matchesPlayed"),
        "up",
        t("mediaLogs.sortByMatchesPlayedAsc")
      ),
      sortOptionWithArrow(
        "weightDesc",
        t("itemPage.weight"),
        "down",
        t("mediaLogs.sortByWeightDesc")
      ),
      sortOptionWithArrow(
        "weightAsc",
        t("itemPage.weight"),
        "up",
        t("mediaLogs.sortByWeightAsc")
      )
    );
  } else if (category === "games") {
    options.push(
      sortOptionWithArrow(
        "timeToBeatDesc",
        t("itemPage.timeToBeat"),
        "down",
        t("mediaLogs.sortByTimeToBeatDesc")
      ),
      sortOptionWithArrow(
        "timeToBeatAsc",
        t("itemPage.timeToBeat"),
        "up",
        t("mediaLogs.sortByTimeToBeatAsc")
      )
    );
  }
  return options;
}
