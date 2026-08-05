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

const statBarGridClass =
  "grid w-full min-w-0 grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto]";
const statBarTrackClass = "h-6 min-w-0 rounded bg-[var(--color-darkest)]";
const statBarMarqueeClass = "block min-w-0 text-xs text-[var(--color-light)]";
const statBarValueClass = "shrink-0 text-right text-xs tabular-nums text-[var(--color-lightest)]";

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
          <div key={period} className={statBarGridClass}>
            <div className="flex min-h-[2.25rem] min-w-0 items-center justify-center leading-tight">
              <OverflowMarquee className={statBarMarqueeClass}>{period}</OverflowMarquee>
            </div>
            <div className={statBarTrackClass}>
              <div
                className={cn("h-full rounded", getGamePlatformBarFillClass(family))}
                style={{
                  width: `${Math.max(5, (hours / maxCount) * 100)}%`,
                }}
              />
            </div>
            <span className={statBarValueClass}>
              {t("dashboard.logsCount", { count: String(Math.round(hours)) })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
