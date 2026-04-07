import { useId } from "react";
import { Ban, HandCoins, PackageCheck, ShoppingBag } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";
import type { BoardGameOwnership } from "@/lib/boardGameOwnership";

const MODES: BoardGameOwnership[] = ["doNotOwn", "wantToBuy", "own", "sold"];

const icons = {
  doNotOwn: Ban,
  wantToBuy: ShoppingBag,
  own: PackageCheck,
  sold: HandCoins,
} as const;

export interface BoardGameOwnershipSwitchProps {
  value: BoardGameOwnership;
  onChange: (value: BoardGameOwnership) => void;
  disabled?: boolean;
  className?: string;
}

export const BoardGameOwnershipSwitch = ({
  value,
  onChange,
  disabled = false,
  className,
}: BoardGameOwnershipSwitchProps) => {
  const { t } = useLocale();
  const uid = useId();
  const labelId = `${uid}-board-game-ownership`;

  return (
    <div className={cn("w-full max-w-md", className)}>
      <p id={labelId} className="mb-2 text-sm font-medium text-[var(--color-lightest)]">
        {t("itemReviewForm.boardGameOwnershipLabel")}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2">
        <div
          className={cn(
            "relative flex h-14 items-stretch rounded-full border border-[var(--color-mid)]/25 bg-[var(--color-mid)]/12 p-1.5 shadow-inner",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          {MODES.map((mode) => {
            const Icon = icons[mode];
            const selected = value === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(mode)}
                className={cn(
                  "relative z-10 flex flex-1 items-center justify-center rounded-full transition-colors duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-darkest)]",
                  selected
                    ? "bg-[var(--color-mid)] text-[var(--color-darkest)] shadow-md"
                    : "text-[var(--color-light)] hover:bg-[var(--color-mid)]/15"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={selected ? 2.25 : 1.75} aria-hidden />
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-4 gap-0.5 px-0.5 text-center sm:gap-1">
          {MODES.map((mode) => (
            <span
              key={mode}
              className={cn(
                "text-[10px] font-semibold leading-tight text-[var(--color-light)] sm:text-xs",
                value === mode && "text-[var(--color-lightest)]"
              )}
            >
              {mode === "doNotOwn"
                ? t("itemReviewForm.doNotOwn")
                : mode === "wantToBuy"
                  ? t("itemReviewForm.wantToBuy")
                  : mode === "sold"
                    ? t("itemReviewForm.sold")
                    : t("itemReviewForm.own")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
