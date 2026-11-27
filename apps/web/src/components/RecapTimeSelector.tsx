import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { useLocale } from "@/contexts/LocaleContext";
import { recapCheckpointDays } from "@/lib/recapPeriodBounds";
import { cn } from "@/lib/utils";

const MAX_DAYS = 365;

type RecapTimeSelectorProps = {
  daysAgo: number;
  onDaysAgoChange: (days: number) => void;
  allTime: boolean;
  onAllTimeChange: (checked: boolean) => void;
  timezoneOffsetMinutes: number;
};

export function RecapTimeSelector({
  daysAgo,
  onDaysAgoChange,
  allTime,
  onAllTimeChange,
  timezoneOffsetMinutes,
}: RecapTimeSelectorProps) {
  const { t } = useLocale();
  const checkpoints = useMemo(
    () => recapCheckpointDays(timezoneOffsetMinutes),
    [timezoneOffsetMinutes]
  );
  const positionForDays = (days: number) => ((MAX_DAYS - days) / MAX_DAYS) * 100;

  return (
    <div className={cn("space-y-3", allTime && "opacity-60")}>
      <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-wide text-[var(--color-light)]">
        <span>{t("recap.timeLabel")}</span>
        <span className="normal-case tracking-normal text-[var(--color-lightest)]">
          {allTime ? t("recap.allTime") : t("recap.daysAgo", { days: String(daysAgo) })}
        </span>
      </div>
      <div className="relative px-1">
        <Slider
          min={0}
          max={MAX_DAYS}
          step={1}
          value={[MAX_DAYS - daysAgo]}
          onValueChange={(next) => {
            const value = next[0];
            if (value != null) onDaysAgoChange(MAX_DAYS - value);
          }}
          disabled={allTime}
          aria-label={t("recap.timeLabel")}
          thumbClassName="h-6 w-6 max-md:h-7 max-md:w-7"
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-1 top-1/2 h-2 -translate-y-1/2">
          {checkpoints.map((checkpoint) => (
            <span
              key={checkpoint.kind}
              className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--btn-gradient-start)]"
              style={{ left: `${positionForDays(checkpoint.days)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--color-light)]">
        <span>{t("recap.oneYearAgo")}</span>
        <span>{t("recap.today")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {checkpoints.map((checkpoint) => (
          <button
            key={checkpoint.kind}
            type="button"
            disabled={allTime}
            onClick={() => onDaysAgoChange(checkpoint.days)}
            className="rounded-full border border-[var(--color-surface-border)] bg-[var(--color-dark)] px-3 py-1.5 text-xs text-[var(--color-lightest)] transition-colors hover:border-[var(--color-mid)] disabled:pointer-events-none disabled:opacity-50"
          >
            {checkpoint.kind === "jan1"
              ? t("recap.checkpointJan1")
              : checkpoint.kind === "lastMonth"
                ? t("recap.periodLastMonth")
                : t("recap.periodLastWeek")}
          </button>
        ))}
        <button
          type="button"
          disabled={allTime}
          onClick={() => onDaysAgoChange(MAX_DAYS)}
          className="rounded-full border border-[var(--color-surface-border)] bg-[var(--color-dark)] px-3 py-1.5 text-xs text-[var(--color-lightest)] transition-colors hover:border-[var(--color-mid)] disabled:pointer-events-none disabled:opacity-50"
        >
          {t("recap.oneYearAgo")}
        </button>
      </div>
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-surface-border)] px-3 text-sm text-[var(--color-lightest)] has-[:checked]:border-[var(--color-mid)]">
        <input
          type="checkbox"
          checked={allTime}
          onChange={(event) => onAllTimeChange(event.target.checked)}
          className="h-4 w-4 accent-[var(--btn-gradient-start)]"
        />
        <span>{t("recap.allTime")}</span>
      </label>
    </div>
  );
}
