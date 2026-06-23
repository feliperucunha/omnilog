import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  currencyDecimalSeparator,
  currencyMinorDecimals,
  minorToAmountString,
  parseAmountToMinor,
} from "@/lib/moneyInput";
import {
  fractionPart,
  popFractionDigit,
  popMajorDigit,
  pushFractionDigit,
  pushMajorDigit,
} from "@/lib/moneyInputEdit";

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
  showOptionalHint?: boolean;
}

/**
 * Currency amount field: value is stored in minor units; display is always locale-formatted.
 * Digits append to the integer part (1 → 1,00); decimal separator switches to cents entry.
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
  showOptionalHint = true,
}: MoneyAmountInputProps) {
  const baseId = useId();
  const normalizedProp = normalizeCurrencyCode(currency);
  const cur = normalizedProp ?? DEFAULT_PURCHASE_CURRENCY;
  const [text, setText] = useState(() => minorToAmountString(amountMinor, cur));
  const focusedRef = useRef(false);
  const fractionModeRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusedRef.current) return;
    setText(minorToAmountString(amountMinor, cur));
  }, [amountMinor, cur]);

  const commitAmount = useCallback(
    (minor: number | null, opts?: { fractionMode?: boolean }) => {
      if (opts?.fractionMode !== undefined) fractionModeRef.current = opts.fractionMode;
      onAmountMinorChange(minor);
      const formatted = minorToAmountString(minor, cur);
      setText(formatted);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el || document.activeElement !== el) return;
        el.setSelectionRange(formatted.length, formatted.length);
      });
    },
    [cur, onAmountMinorChange],
  );

  const applyParsedAmount = useCallback(
    (raw: string) => {
      const m = parseAmountToMinor(raw, cur);
      commitAmount(m, { fractionMode: fractionPart(m, cur) !== 0 });
    },
    [commitAmount, cur],
  );

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const decimals = currencyMinorDecimals(cur);
    const decSep = currencyDecimalSeparator(cur);

    if (
      e.key === "Tab" ||
      e.key.startsWith("Arrow") ||
      e.key === "Home" ||
      e.key === "End" ||
      e.key === "Escape" ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey
    ) {
      return;
    }

    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      const digit = parseInt(e.key, 10);
      const next = fractionModeRef.current
        ? pushFractionDigit(amountMinor ?? 0, digit, decimals)
        : pushMajorDigit(amountMinor, digit, decimals);
      commitAmount(next);
      return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      const next = fractionModeRef.current
        ? popFractionDigit(amountMinor, decimals)
        : popMajorDigit(amountMinor, decimals);
      commitAmount(next, { fractionMode: fractionPart(next, cur) !== 0 });
      return;
    }

    if (decimals > 0 && (e.key === decSep || e.key === "." || e.key === ",")) {
      e.preventDefault();
      fractionModeRef.current = true;
      if (amountMinor == null) commitAmount(0, { fractionMode: true });
      return;
    }

    if (e.key.length === 1) {
      e.preventDefault();
    }
  };

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
          disabled && "opacity-60",
        )}
      >
        <SelectRoot
          key={cur}
          value={cur}
          onValueChange={(next) => {
            const code = normalizeCurrencyCode(next) ?? DEFAULT_PURCHASE_CURRENCY;
            fractionModeRef.current = false;
            onCurrencyChange(code);
            setText(minorToAmountString(amountMinor, code));
          }}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label={triggerAria}
            title={selectedCurrencyFullLabel}
            className={cn(
              "h-full max-md:min-h-[44px] md:min-h-10 w-[min(5.25rem,32vw)] shrink-0 self-stretch rounded-none border-0 border-r border-[var(--color-mid)]/30",
              "bg-[var(--color-mid)]/[0.06] px-2.5 py-2.5 sm:px-3 md:py-2",
              "text-sm font-semibold tabular-nums tracking-wide text-[var(--color-light)]",
              "shadow-none ring-0 ring-offset-0 outline-none",
              "focus:ring-0 focus-visible:ring-0",
              "hover:bg-[var(--color-mid)]/10 data-[state=open]:bg-[var(--color-mid)]/12",
              "[&>div]:max-w-[3.25rem] [&>div]:min-w-0 [&>div]:text-left",
              "[&>svg]:pointer-events-none [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0 [&>svg]:opacity-45",
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
          ref={inputRef}
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
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              fractionModeRef.current = false;
              commitAmount(null);
              return;
            }
            const expected = minorToAmountString(amountMinor, cur);
            if (v === expected) return;
            applyParsedAmount(v);
          }}
          onPaste={(e) => {
            e.preventDefault();
            applyParsedAmount(e.clipboardData.getData("text"));
          }}
          onBlur={() => {
            focusedRef.current = false;
            fractionModeRef.current = false;
            commitAmount(amountMinor);
          }}
          className={cn(
            "max-md:min-h-[44px] md:min-h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent",
            "px-3 py-2.5 text-sm text-[var(--color-lightest)] md:py-2",
            "shadow-none ring-0 outline-none placeholder:text-[var(--color-light)]/65",
            "focus-visible:ring-0",
          )}
          aria-describedby={showOptionalHint ? `${baseId}-hint` : undefined}
        />
      </div>
      {showOptionalHint && (
        <p id={`${baseId}-hint`} className="text-xs text-[var(--color-light)]">
          {t("money.optionalHint")}
        </p>
      )}
    </div>
  );
}
