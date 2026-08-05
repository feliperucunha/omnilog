import { OverflowMarquee } from "@/components/OverflowMarquee";
import { StatisticsBarsSkeleton } from "@/components/skeletons/StatisticsSkeleton";
import type { TFunction } from "@/contexts/LocaleContext";
import { getGamePlatformBarFillClass, getGamePlatformFamily } from "@/lib/gamePlatforms";
import { cn } from "@/lib/utils";

export type GamePlatformStatEntry = {
  period: string;
  hours: number;
  count?: number;
};

export function GamePlatformStatsWidget({
  stats,
  loading,
  t,
}: {
  stats: GamePlatformStatEntry[];
  loading: boolean;
  t: TFunction;
}) {
  const maxCount = stats.length > 0 ? Math.max(...stats.map((s) => s.hours), 1) : 1;

  if (loading) {
    return (
      <div className="min-h-[12.5rem] min-w-0">
        <StatisticsBarsSkeleton rows={6} />
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <p className="flex min-h-[12.5rem] items-center justify-center px-2 text-center text-sm text-[var(--color-light)]">
        {t("statistics.gamePlatformsEmpty")}
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
      {stats.map(({ period, hours }) => {
        const family = getGamePlatformFamily(period);
        return (
          <div key={period} className="flex min-w-0 items-center gap-2.5">
            <span className="w-16 shrink-0 truncate text-[11px] font-medium text-[var(--color-lightest)]">
              <OverflowMarquee className="block w-full">{period}</OverflowMarquee>
            </span>
            <div className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-mid)]/25">
              <div
                className={cn("h-full rounded-full", getGamePlatformBarFillClass(family))}
                style={{ width: `${Math.max(0, (hours / maxCount) * 100)}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-[11px] font-bold tabular-nums text-[var(--color-lightest)]">
              {t("dashboard.logsCount", { count: String(Math.round(hours)) })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
