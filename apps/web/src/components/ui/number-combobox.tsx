import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface NumberComboboxProps {
  value: number | "";
  onChange: (value: number | "") => void;
  options: number[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  /** When true, render the dropdown in a portal so it is not clipped by modals/overflow. Use in dialogs. */
  dropdownInPortal?: boolean;
  /** When true, show a loading spinner instead of the chevron while options are being fetched. */
  optionsLoading?: boolean;
  /** Limit dropdown height and scroll inside (same behavior as Select with contentScrollable). */
  contentScrollable?: boolean;
}

/**
 * Number input that can also pick from a dropdown of options (e.g. from API).
 * User can type any number or select from the list.
 */
export const NumberCombobox = React.forwardRef<HTMLInputElement, NumberComboboxProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = "—",
      disabled,
      className,
      "aria-label": ariaLabel,
      dropdownInPortal = false,
      optionsLoading = false,
      contentScrollable = false,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [dropdownRect, setDropdownRect] = React.useState<{ top: number; left: number; width: number } | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const listIdRef = React.useRef<string | null>(null);
    if (dropdownInPortal && !listIdRef.current) {
      listIdRef.current = "nc-list-" + Math.random().toString(36).slice(2, 11);
    }
    if (!dropdownInPortal) listIdRef.current = null;

    const displayValue = value === "" ? "" : String(value);

    React.useEffect(() => {
      if (!open) {
        setDropdownRect(null);
        return;
      }
      if (dropdownInPortal && inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownRect({ top: rect.bottom, left: rect.left, width: rect.width });
      }
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (containerRef.current?.contains(target)) return;
        if (dropdownInPortal && listIdRef.current) {
          const listEl = document.getElementById(listIdRef.current);
          if (listEl?.contains(target)) return;
        }
        setOpen(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open, dropdownInPortal]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, "");
      if (raw === "") {
        onChange("");
        return;
      }
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n >= 0) onChange(n);
    };

    const handleSelect = (n: number) => {
      onChange(n);
      setOpen(false);
      inputRef.current?.blur();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown" && !open && !optionsLoading && options.length > 0) {
        e.preventDefault();
        setOpen(true);
      }
    };

    const scrollListClass =
      contentScrollable === true
        ? "max-h-[min(50dvh,20rem)] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
        : undefined;

    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <div className="relative">
          <Input
            ref={ref ?? inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={displayValue}
            onChange={handleInputChange}
            onFocus={() => !optionsLoading && options.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-haspopup="listbox"
            className="bg-[var(--color-darkest)] pr-14 focus-visible:ring-0 focus-visible:ring-offset-0 max-md:pr-[3.75rem]"
          />
          {optionsLoading && (
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-light)]"
              aria-hidden
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          )}
          {!optionsLoading && options.length > 0 && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setOpen((o) => !o)}
              className={cn(
                "absolute inset-y-0 right-0 z-[1] flex min-w-[44px] max-w-[40%] items-center justify-center px-2",
                "text-[var(--color-light)] hover:bg-[var(--color-mid)]/20 hover:text-[var(--color-lightest)] active:bg-[var(--color-mid)]/30",
                "[touch-action:manipulation]"
              )}
              aria-label="Toggle list"
            >
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
            </button>
          )}
        </div>
        {open && options.length > 0 && !dropdownInPortal && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-[var(--color-mid)]/50 bg-[var(--color-dark)] shadow-[var(--shadow-lg)] [touch-action:manipulation]">
            <ul role="listbox" className={cn("overflow-x-hidden py-1 [touch-action:manipulation]", scrollListClass)}>
              {options.map((n) => (
                <li
                  key={n}
                  role="option"
                  aria-selected={value === n}
                  className={cn(
                    "cursor-pointer min-h-[44px] flex items-center px-3 py-2 text-sm [touch-action:manipulation]",
                    value === n
                      ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
                      : "text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/30 active:bg-[var(--color-mid)]/40"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(n);
                  }}
                  onClick={() => handleSelect(n)}
                >
                  {n}
                </li>
              ))}
            </ul>
            {contentScrollable === true ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-7 rounded-b-md bg-gradient-to-t from-[var(--color-dark)] via-[var(--color-dark)]/70 to-transparent"
                aria-hidden
              />
            ) : null}
          </div>
        )}
        {open && options.length > 0 && dropdownInPortal && dropdownRect && typeof document !== "undefined" &&
          createPortal(
            <div
              data-dropdown-portal
              className="fixed z-[100] overflow-hidden rounded-md border border-[var(--color-mid)]/50 bg-[var(--color-dark)] shadow-[var(--shadow-lg)] [touch-action:manipulation]"
              style={{
                top: dropdownRect.top + 4,
                left: dropdownRect.left,
                width: dropdownRect.width,
              }}
            >
              <ul
                id={listIdRef.current ?? undefined}
                role="listbox"
                className={cn("overflow-x-hidden py-1 [touch-action:manipulation]", scrollListClass)}
              >
                {options.map((n) => (
                  <li
                    key={n}
                    role="option"
                    aria-selected={value === n}
                    className={cn(
                      "cursor-pointer min-h-[44px] flex items-center px-3 py-2 text-sm [touch-action:manipulation]",
                      value === n
                        ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
                        : "text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/30 active:bg-[var(--color-mid)]/40"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(n);
                    }}
                    onClick={() => handleSelect(n)}
                  >
                    {n}
                  </li>
                ))}
              </ul>
              {contentScrollable === true ? (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-7 rounded-b-md bg-gradient-to-t from-[var(--color-dark)] via-[var(--color-dark)]/70 to-transparent"
                  aria-hidden
                />
              ) : null}
            </div>,
            document.body
          )}
      </div>
    );
  }
);
NumberCombobox.displayName = "NumberCombobox";
