import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale } from "@/contexts/LocaleContext";
import { BOARD_GAME_PROVIDERS, type BoardGameProvider } from "@geeklogs/shared";
import { cn } from "@/lib/utils";

export type BoardGameProviderSelectorProps = {
  value: BoardGameProvider;
  onValueChange: (next: BoardGameProvider) => void;
  disabled?: boolean;
  className?: string;
};

const BULLETS: Record<BoardGameProvider, readonly [string, string]> = {
  bgg: ["settings.boardGameProviderBggBullet1", "settings.boardGameProviderBggBullet2"],
  ludopedia: ["settings.boardGameProviderLudopediaBullet1", "settings.boardGameProviderLudopediaBullet2"],
};

export function BoardGameProviderSelector({
  value,
  onValueChange,
  disabled,
  className,
}: BoardGameProviderSelectorProps) {
  const { t } = useLocale();

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onValueChange(v as BoardGameProvider);
      }}
      disabled={disabled}
      className={cn(
        "grid w-full grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 sm:gap-3",
        className
      )}
      aria-label={t("settings.boardGameProviderLabel")}
    >
      {BOARD_GAME_PROVIDERS.map((provider) => {
        const titleKey =
          provider === "bgg" ? "settings.boardGameProviderBgg" : "settings.boardGameProviderLudopedia";
        const bullets = BULLETS[provider];
        return (
          <ToggleGroupItem
            key={provider}
            value={provider}
            aria-label={t(titleKey)}
            className={cn(
              "group relative flex h-auto min-h-[112px] w-full flex-col items-stretch justify-start gap-2.5 rounded-xl border px-3.5 py-3 text-left shadow-none transition-all",
              "border-[var(--color-surface-border)]/60 bg-[var(--color-darkest)]/35 text-[var(--color-lightest)]",
              "data-[state=on]:border-[var(--color-mid)] data-[state=on]:bg-[var(--color-mid)]/18 data-[state=on]:shadow-[var(--shadow-md)]",
              "hover:data-[state=off]:border-[var(--color-mid)]/40 hover:data-[state=off]:bg-[var(--color-darkest)]/55",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-dark)]"
            )}
          >
            <span className="text-sm font-semibold tracking-tight text-[var(--color-lightest)] group-data-[state=off]:text-[var(--color-lightest)]">
              {t(titleKey)}
            </span>
            <ul className="flex flex-col gap-1.5 text-left">
              {bullets.map((key) => (
                <li
                  key={key}
                  className="flex items-start gap-2 text-xs leading-snug text-[var(--color-light)] group-data-[state=on]:text-[var(--color-lightest)]/90"
                >
                  <span
                    className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-[var(--color-mid)] opacity-80 group-data-[state=on]:bg-[var(--color-lightest)]"
                    aria-hidden
                  />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

const cardClass = (active: boolean) =>
  cn(
    "group relative flex h-auto min-h-[112px] w-full flex-col items-stretch justify-start gap-2.5 rounded-xl border px-3.5 py-3 text-left shadow-none transition-all",
    "border-[var(--color-surface-border)]/60 bg-[var(--color-darkest)]/35 text-[var(--color-lightest)]",
    active
      ? "border-[var(--color-mid)] bg-[var(--color-mid)]/18 shadow-[var(--shadow-md)]"
      : "hover:border-[var(--color-mid)]/40 hover:bg-[var(--color-darkest)]/55",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-dark)]"
  );

const bulletClass = (active: boolean) =>
  cn(
    "mt-[0.35rem] h-1 w-1 shrink-0 rounded-full opacity-80",
    active ? "bg-[var(--color-lightest)]" : "bg-[var(--color-mid)]"
  );

const textClass = (active: boolean) =>
  cn("text-xs leading-snug", active ? "text-[var(--color-lightest)]/90" : "text-[var(--color-light)] group-hover:text-[var(--color-lightest)]/80");

const titleClass = (active: boolean) =>
  cn("text-sm font-semibold tracking-tight", active ? "text-[var(--color-lightest)]" : "text-[var(--color-lightest)] group-hover:text-[var(--color-lightest)]");

/**
 * Two-tap catalog choice with visible selection. Use in onboarding: stack import UI below, don’t replace.
 */
export function BoardGameProviderSelectGrid({
  value,
  onSelect,
  disabled,
  className,
}: {
  value: BoardGameProvider | null;
  onSelect: (p: BoardGameProvider) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useLocale();
  return (
    <div
      className={cn("grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5", className)}
      role="listbox"
      aria-label={t("settings.boardGameProviderLabel")}
    >
      {BOARD_GAME_PROVIDERS.map((provider) => {
        const titleKey =
          provider === "bgg" ? "settings.boardGameProviderBgg" : "settings.boardGameProviderLudopedia";
        const bullets = BULLETS[provider];
        const selected = value === provider;
        return (
          <button
            key={provider}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onSelect(provider)}
            className={cardClass(selected)}
          >
            <span className={titleClass(selected)}>{t(titleKey)}</span>
            <ul className="flex flex-col gap-1.5 text-left">
              {bullets.map((key) => (
                <li
                  key={key}
                  className={cn(
                    "flex items-start gap-2",
                    textClass(selected)
                  )}
                >
                  <span className={bulletClass(selected)} aria-hidden />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
