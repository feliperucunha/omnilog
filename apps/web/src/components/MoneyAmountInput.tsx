import { useEffect, useId, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  SelectRoot,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { COMMON_CURRENCIES, DEFAULT_PURCHASE_CURRENCY, normalizeCurrencyCode } from "@/lib/currencies";
import {
  formatPartialMoneyInput,
  minorToAmountString,
  parseAmountToMinor,
} from "@/lib/moneyInput";

const CURRENCY_SCROLL_VIEWPORT =
  "max-h-[min(50dvh,20rem)] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]";

export interface MoneyAmountInputProps {
  label: string;
  currency: string;
  onCurrencyChange: (code: string) => void;
  amountMinor: number | null;
  onAmountMinorChange: (minor: number | null) => void;
  disabled?: boolean;
  t: (key: string, values?: Record<string, string>) => string;
  className?: string;
}

/**
 * Single combined control: currency prefix (like an inset affordance) + amount in one field.
 */
export function MoneyAmountInput({
  label,
  currency,
  onCurrencyChange,
  amountMinor,
  onAmountMinorChange,
  disabled,
  t,
  className,
}: MoneyAmountInputProps) {
  const baseId = useId();
  const normalizedProp = normalizeCurrencyCode(currency);
  const cur = normalizedProp ?? DEFAULT_PURCHASE_CURRENCY;
  const [text, setText] = useState(() => minorToAmountString(amountMinor, cur));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setText(minorToAmountString(amountMinor, cur));
  }, [amountMinor, cur]);

  const codesInList = new Set(COMMON_CURRENCIES.map((c) => c.code));
  const extraOption =
    !codesInList.has(cur) ? ([{ value: cur, label: cur }] as { value: string; label: string }[]) : [];
  const currencyOptions = [
    ...extraOption,
    ...COMMON_CURRENCIES.map((c) => ({
      value: c.code,
      label: `${c.code} — ${t(c.labelKey)}`,
    })),
  ];
  const selectedCurrencyFullLabel = currencyOptions.find((o) => o.value === cur)?.label ?? cur;
  const triggerAria = `${t("money.currencyAria")}: ${selectedCurrencyFullLabel}`;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={`${baseId}-amount`} className="text-sm text-[var(--color-lightest)]">
        {label}
      </Label>
      <div
        className={cn(
          "flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-[var(--color-mid)] bg-[var(--color-darkest)]",
          "transition-[box-shadow,border-color]",
          "focus-within:border-[var(--color-mid)] focus-within:ring-2 focus-within:ring-[var(--color-mid)]/50 focus-within:ring-offset-2 focus-within:ring-offset-[var(--color-dark)]",
          disabled && "opacity-60"
        )}
      >
        <SelectRoot
          key={cur}
          value={cur}
          onValueChange={(next) => {
            const code = normalizeCurrencyCode(next) ?? DEFAULT_PURCHASE_CURRENCY;
            onCurrencyChange(code);
            const stripped = text.replace(/,/g, "");
            const reformatted = formatPartialMoneyInput(stripped, code);
            setText(reformatted);
            const m = parseAmountToMinor(reformatted, code);
            onAmountMinorChange(m);
          }}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label={triggerAria}
            title={selectedCurrencyFullLabel}
            className={cn(
              "h-auto min-h-[44px] w-[min(5.25rem,32vw)] shrink-0 rounded-none border-0 border-r border-[var(--color-mid)]/30",
              "bg-[var(--color-mid)]/[0.06] px-2.5 py-2.5 sm:px-3",
              "text-sm font-semibold tabular-nums tracking-wide text-[var(--color-light)]",
              "shadow-none ring-0 ring-offset-0 outline-none",
              "focus:ring-0 focus-visible:ring-0",
              "hover:bg-[var(--color-mid)]/10 data-[state=open]:bg-[var(--color-mid)]/12",
              "[&>div]:max-w-[3.25rem] [&>div]:min-w-0 [&>div]:text-left",
              "[&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0 [&>svg]:opacity-45"
            )}
          >
            <span className="block truncate text-sm font-semibold tabular-nums tracking-wide text-[var(--color-light)]">
              {cur}
            </span>
          </SelectTrigger>
          <SelectContent viewportClassName={CURRENCY_SCROLL_VIEWPORT}>
            {currencyOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
        <Input
          id={`${baseId}-amount`}
          type="text"
          inputMode="decimal"
          autoComplete="transaction-amount"
          placeholder={t("money.amountPlaceholder")}
          value={text}
          disabled={disabled}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onChange={(e) => {
            const formatted = formatPartialMoneyInput(e.target.value, cur);
            setText(formatted);
            const m = parseAmountToMinor(formatted, cur);
            onAmountMinorChange(m);
          }}
          onBlur={() => {
            focusedRef.current = false;
            const m = parseAmountToMinor(text, cur);
            onAmountMinorChange(m);
            setText(minorToAmountString(m, cur));
          }}
          className={cn(
            "min-h-[44px] min-w-0 flex-1 rounded-none border-0 bg-transparent",
            "px-3 py-2.5 text-sm text-[var(--color-lightest)]",
            "shadow-none ring-0 outline-none placeholder:text-[var(--color-light)]/65",
            "focus-visible:ring-0"
          )}
          aria-describedby={`${baseId}-hint`}
        />
      </div>
      <p id={`${baseId}-hint`} className="text-xs text-[var(--color-light)]">
        {t("money.optionalHint")}
      </p>
    </div>
  );
}
