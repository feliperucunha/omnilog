import * as React from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type UnifiedSearchBarProps = Omit<
  React.ComponentProps<typeof Input>,
  "className" | "type" | "ref" | "value" | "onChange" | "inputMode" | "enterKeyHint" | "aria-label"
> & {
  className?: string;
  inputClassName?: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  inputAriaLabel: string;
  clearAriaLabel: string;
  submitAriaLabel: string;
  showClear: boolean;
  onClear: () => void;
  /** When true, submit is disabled while value is blank (e.g. global search). */
  disableSubmitWhenEmpty?: boolean;
  loading?: boolean;
};

export const UnifiedSearchBar = React.forwardRef<HTMLInputElement, UnifiedSearchBarProps>(
  (
    {
      className,
      inputClassName,
      value,
      onChange,
      inputAriaLabel,
      clearAriaLabel,
      submitAriaLabel,
      showClear,
      onClear,
      disableSubmitWhenEmpty = true,
      loading = false,
      ...inputProps
    },
    ref
  ) => {
    const submitDisabled = loading || (disableSubmitWhenEmpty && !value.trim());

    return (
      <div
        className={cn(
          "flex h-12 w-full min-w-0 max-md:min-h-[48px] items-center gap-1 overflow-hidden rounded-full border border-[var(--color-mid)]/55",
          "bg-[var(--color-dark)] pl-4 pr-1.5",
          "transition-[border-color]",
          "focus-within:border-[var(--btn-gradient-start)]/40",
          className
        )}
      >
        <Input
          ref={ref}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          className={cn(
            "min-h-0 min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none",
            "h-full py-0 pl-0 pr-1 text-[var(--color-lightest)] max-md:text-base",
            "placeholder:text-[var(--color-light)]",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            inputClassName
          )}
          value={value}
          onChange={onChange}
          aria-label={inputAriaLabel}
          {...inputProps}
        />
        <div className="flex shrink-0 items-center gap-0.5">
          {showClear && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClear}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--color-light)]",
                "transition-colors hover:bg-[var(--color-mid)]/35 hover:text-[var(--color-lightest)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] focus-visible:ring-offset-0"
              )}
              aria-label={clearAriaLabel}
            >
              <X className="size-[1.125rem]" strokeWidth={2.25} aria-hidden />
            </button>
          )}
          <button
            type="submit"
            disabled={submitDisabled}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              "text-[var(--color-lightest)] transition-[color,transform,background-color]",
              "hover:bg-[var(--color-mid)]/35 active:scale-[0.96]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-gradient-start)]/60 focus-visible:ring-offset-0",
              "disabled:pointer-events-none disabled:text-[var(--color-light)]/35"
            )}
            aria-label={submitAriaLabel}
          >
            {loading ? (
              <Loader2 className="size-[1.125rem] animate-spin" aria-hidden />
            ) : (
              <Search className="size-[1.125rem]" strokeWidth={2.25} aria-hidden />
            )}
          </button>
        </div>
      </div>
    );
  }
);
UnifiedSearchBar.displayName = "UnifiedSearchBar";
