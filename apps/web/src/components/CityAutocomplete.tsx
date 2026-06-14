import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import type { CitySuggestion } from "@geeklogs/shared";
import { cn } from "@/lib/utils";

export type CityValue = {
  city: string;
  cityLabel: string;
  country?: string | null;
  countryCode?: string | null;
};

export type CityAutocompleteProps = {
  label: string;
  value: CityValue | null;
  onChange: (value: CityValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
};

export function CityAutocomplete({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  error,
  className,
}: CityAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(value?.cityLabel ?? "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) setQuery(value?.cityLabel ?? "");
  }, [value?.cityLabel, open]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ data: CitySuggestion[] }>(
        `/geocode/cities?q=${encodeURIComponent(q.trim())}`
      );
      setSuggestions(res.data ?? []);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (next: string) => {
    setQuery(next);
    onChange(null);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(next);
    }, 280);
  };

  const pickSuggestion = (s: CitySuggestion) => {
    onChange({
      city: s.city,
      cityLabel: s.label,
      country: s.country,
      countryCode: s.countryCode,
    });
    setQuery(s.label);
    setOpen(false);
    setSuggestions([]);
  };

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={rootRef} className={cn("relative space-y-2", className)}>
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            setOpen(true);
            if (query.trim().length >= 2) void fetchSuggestions(query);
          }}
          onKeyDown={(e) => {
            if (!open || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              const s = suggestions[activeIndex];
              if (s) pickSuggestion(s);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={!!error}
          className={cn(error && "border-red-500 focus-visible:ring-red-500")}
        />
        {loading && (
          <Loader2
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-light)]"
            aria-hidden
          />
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
      {open && query.trim().length >= 2 && (suggestions.length > 0 || loading) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)] py-1 shadow-[var(--shadow-lg)]"
        >
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full px-3 py-2.5 text-left text-sm text-[var(--color-lightest)] transition-colors hover:bg-[var(--color-mid)]/40",
                  i === activeIndex && "bg-[var(--color-mid)]/50"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(s)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
