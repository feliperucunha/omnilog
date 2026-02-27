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
            className="pr-9 bg-[var(--color-darkest)]"
          />
          {optionsLoading && (
            <span
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-light)]"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-light)] hover:text-[var(--color-lightest)]"
              aria-label="Toggle list"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </button>
          )}
        </div>
        {open && options.length > 0 && !dropdownInPortal && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-[var(--color-mid)]/50 bg-[var(--color-dark)] py-1 shadow-[var(--shadow-lg)]"
          >
            {options.map((n) => (
              <li
                key={n}
                role="option"
                aria-selected={value === n}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm",
                  value === n
                    ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
                    : "text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/30"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(n);
                }}
              >
                {n}
              </li>
            ))}
          </ul>
        )}
        {open && options.length > 0 && dropdownInPortal && dropdownRect && typeof document !== "undefined" &&
          createPortal(
            <ul
              id={listIdRef.current ?? undefined}
              role="listbox"
              className="fixed z-[100] max-h-48 overflow-auto rounded-md border border-[var(--color-mid)]/50 bg-[var(--color-dark)] py-1 shadow-[var(--shadow-lg)]"
              style={{
                top: dropdownRect.top + 4,
                left: dropdownRect.left,
                width: dropdownRect.width,
              }}
            >
              {options.map((n) => (
                <li
                  key={n}
                  role="option"
                  aria-selected={value === n}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm",
                    value === n
                      ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
                      : "text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/30"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(n);
                  }}
                >
                  {n}
                </li>
              ))}
            </ul>,
            document.body
          )}
      </div>
    );
  }
);
NumberCombobox.displayName = "NumberCombobox";
