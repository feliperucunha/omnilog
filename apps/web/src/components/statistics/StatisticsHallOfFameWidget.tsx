import { useState } from "react";
import {
  BookOpen,
  Clock,
  Dices,
  Gamepad2,
  Hash,
  Scale,
  Star,
  Tag,
  Timer,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { BoardGameProvider, MediaType } from "@geeklogs/shared";
import { ItemImage } from "@/components/ItemImage";
import { MotionLink } from "@/components/MotionLink";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { Skeleton } from "@/components/ui/skeleton";
import { tapScale, tapTransition } from "@/lib/animations";
import { itemDetailPath } from "@/lib/itemRoutes";
import type { TFunction } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

export type StatsRecordUnit =
  | "rating"
  | "hours"
  | "pages"
  | "episodes"
  | "seasons"
  | "chapters"
  | "volumes"
  | "matches"
  | "wins"
  | "winRate"
  | "items"
  | "days"
  | "weight";

export type StatsRecordEntry = {
  key: string;
  rank: number;
  title: string;
  mediaType: MediaType | "all";
  value: number;
  unit: StatsRecordUnit;
  externalId?: string;
  logId?: string;
  image?: string | null;
  boardGameSource?: string | null;
  date?: string;
  from?: string;
  to?: string;
  secondaryValue?: number;
  secondaryUnit?: StatsRecordUnit;
};

export type StatsRecord = {
  id: string;
  entries: StatsRecordEntry[];
};

function recordIcon(id: string): LucideIcon {
  if (id === "fastest_completion") return Zap;
  if (id === "slowest_completion") return Timer;
  if (id.startsWith("top_rated_") || id === "highest_rated") return Star;
  if (id === "top_game_platform") return Gamepad2;
  if (id.includes("genre")) return Tag;
  if (id.includes("episodes") || id.includes("chapters")) return Hash;
  if (id.includes("pages") || id.includes("volumes")) return BookOpen;
  if (id.includes("boardgame_matches")) return Dices;
  if (id.includes("boardgame_wins")) return Trophy;
  if (id.includes("session")) return Timer;
  if (id.includes("weight")) return Scale;
  if (id === "most_game_hours" || id.startsWith("longest_")) return Clock;
  return Trophy;
}

function formatNumber(value: number, locale: string): string {
  return value.toLocaleString(locale, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  });
}

export function formatRecordValue(
  entry: Pick<StatsRecordEntry, "value" | "unit">,
  t: TFunction,
  locale: string
): string {
  const value = formatNumber(entry.value, locale);
  switch (entry.unit) {
    case "rating":
      return t("statistics.hallOfFameValues.rating", { value });
    case "hours":
      return t("statistics.hallOfFameValues.hours", { value });
    case "pages":
      return t("statistics.hallOfFameValues.pages", { value });
    case "episodes":
      return t("statistics.hallOfFameValues.episodes", { value });
    case "seasons":
      return t("statistics.hallOfFameValues.seasons", { value });
    case "chapters":
      return t("statistics.hallOfFameValues.chapters", { value });
    case "volumes":
      return t("statistics.hallOfFameValues.volumes", { value });
    case "matches":
      return t("statistics.hallOfFameValues.matches", { value });
    case "wins":
      return t("statistics.hallOfFameValues.wins", { value });
    case "winRate":
      return t("statistics.hallOfFameValues.winRate", {
        value: String(Math.round(entry.value)),
      });
    case "days":
      return t("statistics.hallOfFameValues.days", { value });
    case "weight":
      return t("statistics.hallOfFameValues.weight", { value });
    case "items":
      return t("statistics.hallOfFameValues.items", { value });
  }
}

function HallOfFameSkeleton() {
  return (
    <div
      className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
            <Skeleton className="h-3 w-32 max-w-full rounded" />
          </div>
          {Array.from({ length: 3 }).map((__, row) => (
            <div key={row} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
              <Skeleton className="h-10 w-8 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full max-w-[11rem] rounded" />
                <Skeleton className="h-2.5 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EntryRow({
  recordId,
  entry,
  t,
  locale,
}: {
  recordId: string;
  entry: StatsRecordEntry;
  t: TFunction;
  locale: string;
}) {
  const title = entry.title;
  const hasItemLink = entry.mediaType !== "all" && entry.externalId != null;
  const secondary =
    entry.secondaryValue != null && entry.secondaryUnit != null
      ? formatRecordValue(
          { value: entry.secondaryValue, unit: entry.secondaryUnit },
          t,
          locale
        )
      : null;
  const body = (
    <>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums",
          entry.rank === 1
            ? "border-amber-400/50 bg-amber-400/20 text-amber-300"
            : "border-[var(--color-mid)]/35 bg-[var(--color-mid)]/15 text-[var(--color-light)]"
        )}
      >
        {entry.rank}
      </span>
      {entry.mediaType !== "all" && entry.externalId ? (
        <div className="h-10 w-8 shrink-0 overflow-hidden rounded">
          <ItemImage
            src={entry.image}
            mediaType={entry.mediaType}
            boardGameSource={entry.boardGameSource as BoardGameProvider | null}
            className="h-full w-full"
          />
        </div>
      ) : (
        <span className="flex h-10 w-8 shrink-0 items-center justify-center rounded bg-[var(--color-mid)]/15 text-[var(--color-light)]">
          {(() => {
            const Icon = recordIcon(recordId);
            return <Icon className="h-4 w-4" aria-hidden />;
          })()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <OverflowMarquee className="block text-xs font-medium text-[var(--color-lightest)]">
          {title}
        </OverflowMarquee>
      </span>
      <span className="flex shrink-0 flex-col items-end text-[11px] font-semibold tabular-nums text-[var(--color-lightest)]">
        <span>{formatRecordValue(entry, t, locale)}</span>
        {secondary != null && (
          <span className="text-[10px] font-medium text-[var(--color-light)]">
            {secondary}
          </span>
        )}
      </span>
    </>
  );

  if (!hasItemLink) {
    return <div className="flex min-w-0 items-center gap-2 py-1">{body}</div>;
  }
  return (
    <MotionLink
      to={itemDetailPath(entry.mediaType, entry.externalId!)}
      whileTap={tapScale}
      transition={tapTransition}
      className="flex min-w-0 items-center gap-2 rounded-md py-1 text-inherit no-underline transition-colors hover:bg-[var(--color-mid)]/10 max-md:min-h-[44px]"
    >
      {body}
    </MotionLink>
  );
}

export function StatisticsHallOfFameWidget({
  records,
  loading,
  locale,
  t,
}: {
  records: StatsRecord[];
  loading: boolean;
  locale: string;
  t: TFunction;
}) {
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(
    () => new Set()
  );
  if (loading) return <HallOfFameSkeleton />;
  if (records.length === 0) {
    return (
      <p className="flex min-h-[10rem] items-center justify-center px-2 text-center text-sm text-[var(--color-light)]">
        {t("statistics.hallOfFameEmpty")}
      </p>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {records.map((record) => {
        const Icon = recordIcon(record.id);
        const expanded = expandedRecords.has(record.id);
        const visibleEntries = expanded ? record.entries : record.entries.slice(0, 3);
        const extraCount = record.entries.length - 3;
        return (
          <section
            key={record.id}
            aria-label={t(`statistics.hallOfFameRecordLabels.${record.id}`)}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-[var(--color-light)]">
                {t(`statistics.hallOfFameRecordLabels.${record.id}`)}
              </h3>
              {extraCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedRecords((current) => {
                      const next = new Set(current);
                      if (next.has(record.id)) next.delete(record.id);
                      else next.add(record.id);
                      return next;
                    })
                  }
                  aria-expanded={expanded}
                  className="shrink-0 rounded text-[10px] tabular-nums text-[var(--color-light)] transition-colors hover:text-[var(--color-lightest)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--btn-gradient-start)]"
                >
                  {expanded
                    ? t("statistics.hallOfFameLess")
                    : t("statistics.hallOfFameMore", {
                        count: String(extraCount),
                      })}
                </button>
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              {visibleEntries.map((entry) => (
                <EntryRow
                  key={entry.key}
                  recordId={record.id}
                  entry={entry}
                  t={t}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
