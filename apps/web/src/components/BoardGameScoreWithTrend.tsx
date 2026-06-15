import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { BoardGameScoreTrend } from "@geeklogs/shared";
import type { TFunction } from "@/contexts/LocaleContext";

export function BoardGameScoreWithTrend({
  score,
  trend,
  t,
  pointsLabelKey = "boardGameMatches.points",
  showPointsLabel = true,
  className,
}: {
  score: number;
  trend: BoardGameScoreTrend | null;
  t: TFunction;
  pointsLabelKey?: string;
  showPointsLabel?: boolean;
  className?: string;
}) {
  return (
    <span className={className}>
      {score}
      {showPointsLabel ? (
        <>
          {" "}
          <span className="text-xs font-normal opacity-80">{t(pointsLabelKey)}</span>
        </>
      ) : null}
      {trend === "higher" && (
        <span
          className="ml-1.5 inline-flex shrink-0 align-middle"
          title={t("boardGameMatches.scoreTrendHigherTitle")}
          aria-label={t("boardGameMatches.scoreTrendHigherAria")}
        >
          <ArrowUpRight className="h-4 w-4 text-emerald-400/95" strokeWidth={2.25} aria-hidden />
        </span>
      )}
      {trend === "lower" && (
        <span
          className="ml-1.5 inline-flex shrink-0 align-middle"
          title={t("boardGameMatches.scoreTrendLowerTitle")}
          aria-label={t("boardGameMatches.scoreTrendLowerAria")}
        >
          <ArrowDownRight className="h-4 w-4 text-rose-400/95" strokeWidth={2.25} aria-hidden />
        </span>
      )}
    </span>
  );
}
