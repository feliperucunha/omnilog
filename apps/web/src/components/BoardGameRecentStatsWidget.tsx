import { motion } from "framer-motion";
import { Dice5, Trophy } from "lucide-react";
import { MotionLink } from "@/components/MotionLink";
import { ItemImage } from "@/components/ItemImage";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { Skeleton } from "@/components/ui/skeleton";
import { tapScale, tapTransition } from "@/lib/animations";
import { itemDetailPath } from "@/lib/itemRoutes";
import { listStaggerItemClassName, listStaggerItemVariants, listStaggerParentProps } from "@/lib/motionPolicy";
import type { TFunction } from "@/contexts/LocaleContext";
import type { BoardGameProvider } from "@geeklogs/shared";
import { cn } from "@/lib/utils";

export type RecentBoardGameStatEntry = {
  logId: string;
  externalId: string;
  title: string;
  image: string | null;
  boardGameSource: BoardGameProvider | null;
  matchCount: number;
  wins: number;
  lastPlayedAt: string;
  lastScore: number | null;
};

function formatLastPlayedLabel(iso: string, locale: string, t: TFunction): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const played = new Date(d);
  played.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - played.getTime()) / 86_400_000);
  if (diffDays === 0) return t("boardGameMatches.today");
  if (diffDays === 1) return t("statistics.lastPlayedYesterday");
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function BoardGameRecentStatsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--color-surface-border)]/50 bg-[var(--color-darkest)]/40 px-3 py-2.5"
        >
          <Skeleton className="h-12 w-9 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-[min(100%,12rem)] rounded" />
            <Skeleton className="h-2.5 w-[min(100%,9rem)] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BoardGameRecentStatsWidget({
  games,
  loading,
  locale,
  t,
}: {
  games: RecentBoardGameStatEntry[];
  loading: boolean;
  locale: string;
  t: TFunction;
}) {
  if (loading) {
    return <BoardGameRecentStatsSkeleton rows={5} />;
  }

  if (games.length === 0) {
    return (
      <p className="flex min-h-[10rem] flex-1 items-center justify-center px-2 text-center text-sm text-[var(--color-light)]">
        {t("statistics.recentBoardGamesEmpty")}
      </p>
    );
  }

  return (
    <motion.ul
      className="m-0 flex min-h-0 min-w-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-0"
      {...listStaggerParentProps}
    >
      {games.map((game) => {
        const winRate =
          game.matchCount > 0 ? Math.round((game.wins / game.matchCount) * 100) : 0;
        const lastPlayed = formatLastPlayedLabel(game.lastPlayedAt, locale, t);
        return (
          <motion.li
            key={game.logId}
            variants={listStaggerItemVariants}
            className={cn("list-none", listStaggerItemClassName)}
          >
            <MotionLink
              to={itemDetailPath("boardgames", game.externalId)}
              whileTap={tapScale}
              transition={tapTransition}
              className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--color-surface-border)]/50 bg-[var(--color-darkest)]/40 px-3 py-2.5 text-inherit no-underline transition-[border-color,background-color] hover:border-[var(--color-mid)]/45 hover:bg-[var(--color-mid)]/10 max-md:min-h-[44px]"
            >
              <div className="h-12 w-9 shrink-0 overflow-hidden rounded">
                <ItemImage
                  src={game.image}
                  className="h-full w-full"
                  mediaType="boardgames"
                  boardGameSource={game.boardGameSource}
                />
              </div>
              <div className="min-w-0 flex-1">
                <OverflowMarquee className="text-sm font-medium text-[var(--color-lightest)]">
                  {game.title}
                </OverflowMarquee>
                <p className="mt-0.5 text-xs tabular-nums text-[var(--color-light)]">
                  {[
                    t(
                      game.matchCount === 1
                        ? "statistics.recentBoardGamesPlays_one"
                        : "statistics.recentBoardGamesPlays_other",
                      { plays: String(game.matchCount) }
                    ),
                    t(
                      game.wins === 1
                        ? "statistics.recentBoardGamesWins_one"
                        : "statistics.recentBoardGamesWins_other",
                      { wins: String(game.wins) }
                    ),
                    t("statistics.recentBoardGamesWinRate", { winRate: String(winRate) }),
                  ].join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
                  {t("statistics.recentBoardGamesLastPlayed", { when: lastPlayed })}
                </span>
                {game.lastScore != null && (
                  <span className="inline-flex items-center gap-1 text-xs tabular-nums text-[var(--color-lightest)]">
                    <Trophy className="h-3 w-3 text-amber-400/90" aria-hidden />
                    {game.lastScore}
                  </span>
                )}
                {game.lastScore == null && game.wins > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400/95">
                    <Dice5 className="h-3 w-3" aria-hidden />
                    {t("statistics.recentBoardGamesWonBadge")}
                  </span>
                )}
              </div>
            </MotionLink>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
