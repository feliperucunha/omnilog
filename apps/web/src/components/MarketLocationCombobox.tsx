import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { countryLabel } from "@/lib/countryLabel";
import type { CitySuggestion, CountrySuggestion, MarketLocationFilter } from "@geeklogs/shared";
import { cn } from "@/lib/utils";

type PresetCity = { city: string; label: string };
type PresetCountry = { country: string; label: string };

type DropdownRow =
  | { kind: "all"; key: string; label: string }
  | { kind: "country"; key: string; label: string; country: string }
  | { kind: "city"; key: string; label: string; city: string };

export type MarketLocationComboboxProps = {
  value: MarketLocationFilter | null;
  onChange: (value: MarketLocationFilter | null) => void;
  presetCities: PresetCity[];
  presetCountries: PresetCountry[];
  placeholder: string;
  allLocationsLabel: string;
  countriesSectionLabel: string;
  citiesSectionLabel: string;
  ariaLabel: string;
  className?: string;
};

function matchesQuery(label: string, query: string): boolean {
  if (!query) return true;
  return label.toLowerCase().includes(query.toLowerCase());
}

export function MarketLocationCombobox({
  value,
  onChange,
  presetCities,
  presetCountries,
  placeholder,
  allLocationsLabel,
  countriesSectionLabel,
  citiesSectionLabel,
  ariaLabel,
  className,
}: MarketLocationComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [countrySuggestions, setCountrySuggestions] = useState<CountrySuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingRef = useRef(false);

  const displayValue = editingRef.current ? query : (value?.label ?? "");

  useEffect(() => {
    if (!editingRef.current) {
      setQuery(value?.label ?? "");
    }
  }, [value?.label]);

  const fetchRemote = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setCitySuggestions([]);
      setCountrySuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const encoded = encodeURIComponent(q.trim());
      const [citiesRes, countriesRes] = await Promise.all([
        apiFetch<{ data: CitySuggestion[] }>(`/geocode/cities?q=${encoded}`),
        apiFetch<{ data: CountrySuggestion[] }>(`/geocode/countries?q=${encoded}`),
      ]);
      setCitySuggestions(citiesRes.data ?? []);
      setCountrySuggestions(countriesRes.data ?? []);
      setActiveIndex(-1);
    } catch {
      setCitySuggestions([]);
      setCountrySuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (next: string) => {
    editingRef.current = true;
    setQuery(next);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchRemote(next);
    }, 280);
  };

  const pickAll = () => {
    editingRef.current = false;
    onChange(null);
    setQuery("");
    setOpen(false);
    setCitySuggestions([]);
    setCountrySuggestions([]);
  };

  const pickCountry = (country: string, label: string) => {
    editingRef.current = false;
    onChange({ type: "country", country, label });
    setQuery(label);
    setOpen(false);
    setCitySuggestions([]);
    setCountrySuggestions([]);
  };

  const pickCity = (city: string, label: string) => {
    editingRef.current = false;
    onChange({ type: "city", city, label });
    setQuery(label);
    setOpen(false);
    setCitySuggestions([]);
    setCountrySuggestions([]);
  };

  const rows = useMemo(() => {
    const q = query.trim();
    const allRows: DropdownRow[] = [
      { kind: "all", key: "all", label: allLocationsLabel },
    ];
    const seenCountries = new Set<string>();
    const seenCities = new Set<string>();

    const countryRows: DropdownRow[] = [];
    for (const preset of presetCountries) {
      if (seenCountries.has(preset.country)) continue;
      if (!matchesQuery(preset.label, q)) continue;
      seenCountries.add(preset.country);
      countryRows.push({
        kind: "country",
        key: `country:${preset.country}`,
        label: preset.label,
        country: preset.country,
      });
    }
    for (const suggestion of countrySuggestions) {
      if (seenCountries.has(suggestion.country)) continue;
      if (!matchesQuery(suggestion.label, q)) continue;
      seenCountries.add(suggestion.country);
      countryRows.push({
        kind: "country",
        key: `country:${suggestion.country}`,
        label: suggestion.label,
        country: suggestion.country,
      });
    }

    const cityRows: DropdownRow[] = [];
    for (const preset of presetCities) {
      if (seenCities.has(preset.city)) continue;
      if (!matchesQuery(preset.label, q)) continue;
      seenCities.add(preset.city);
      cityRows.push({
        kind: "city",
        key: `city:${preset.city}`,
        label: preset.label,
        city: preset.city,
      });
    }
    for (const suggestion of citySuggestions) {
      if (seenCities.has(suggestion.city)) continue;
      if (!matchesQuery(suggestion.label, q)) continue;
      seenCities.add(suggestion.city);
      cityRows.push({
        kind: "city",
        key: `city:${suggestion.city}`,
        label: suggestion.label,
        city: suggestion.city,
      });
    }

    return { all: allRows, countries: countryRows, cities: cityRows };
  }, [
    query,
    presetCities,
    presetCountries,
    citySuggestions,
    countrySuggestions,
    allLocationsLabel,
  ]);

  const flatRows = useMemo(
    () => [...rows.all, ...rows.countries, ...rows.cities],
    [rows]
  );

  const handlePickRow = (row: DropdownRow) => {
    if (row.kind === "all") pickAll();
    else if (row.kind === "country") pickCountry(row.country, row.label);
    else pickCity(row.city, row.label);
  };

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        editingRef.current = false;
        setQuery(value?.label ?? "");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [value?.label]);

  const showDropdown = open;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <div className="relative">
        <Input
          value={displayValue}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            setOpen(true);
            editingRef.current = true;
            if (query.trim().length >= 2) void fetchRemote(query);
          }}
          onKeyDown={(e) => {
            if (!open || flatRows.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, flatRows.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              const row = flatRows[activeIndex];
              if (row) handlePickRow(row);
            } else if (e.key === "Escape") {
              setOpen(false);
              editingRef.current = false;
              setQuery(value?.label ?? "");
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          className="h-11 max-md:min-h-[44px] pr-9"
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-0 top-0 flex h-full w-9 items-center justify-center text-[var(--color-light)] hover:text-[var(--color-lightest)]"
          aria-label={ariaLabel}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen((prev) => !prev);
            if (!open && query.trim().length >= 2) void fetchRemote(query);
          }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
          )}
        </button>
      </div>
      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-[min(50dvh,20rem)] w-full overflow-y-auto rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)] py-1 shadow-[var(--shadow-lg)]"
        >
          {rows.all.map((row) => {
            const idx = flatRows.indexOf(row);
            return (
              <li key={row.key} role="option" aria-selected={idx === activeIndex}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full px-3 py-2.5 text-left text-sm text-[var(--color-lightest)] transition-colors hover:bg-[var(--color-mid)]/40",
                    idx === activeIndex && "bg-[var(--color-mid)]/50"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickRow(row)}
                >
                  {row.label}
                </button>
              </li>
            );
          })}
          {rows.countries.length > 0 && (
            <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-light)]">
              {countriesSectionLabel}
            </li>
          )}
          {rows.countries.map((row) => {
            const idx = flatRows.indexOf(row);
            return (
              <li key={row.key} role="option" aria-selected={idx === activeIndex}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full px-3 py-2.5 text-left text-sm text-[var(--color-lightest)] transition-colors hover:bg-[var(--color-mid)]/40",
                    idx === activeIndex && "bg-[var(--color-mid)]/50"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickRow(row)}
                >
                  {row.label}
                </button>
              </li>
            );
          })}
          {rows.cities.length > 0 && (
            <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-light)]">
              {citiesSectionLabel}
            </li>
          )}
          {rows.cities.map((row) => {
            const idx = flatRows.indexOf(row);
            return (
              <li key={row.key} role="option" aria-selected={idx === activeIndex}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full px-3 py-2.5 text-left text-sm text-[var(--color-lightest)] transition-colors hover:bg-[var(--color-mid)]/40",
                    idx === activeIndex && "bg-[var(--color-mid)]/50"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickRow(row)}
                >
                  {row.label}
                </button>
              </li>
            );
          })}
          {!loading && flatRows.length === 0 && query.trim().length >= 2 && (
            <li className="px-3 py-2.5 text-sm text-[var(--color-light)]">—</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function buildPresetCountries(
  countries: { country: string }[],
  locale: string
): PresetCountry[] {
  return countries.map((row) => ({
    country: row.country,
    label: countryLabel(row.country, locale),
  }));
}

export function parseMarketLocationFromUrl(
  searchParams: URLSearchParams,
  me?: { city?: string; cityLabel?: string } | null
): MarketLocationFilter | null {
  const country = searchParams.get("country");
  if (country && /^[a-zA-Z]{2}$/.test(country)) {
    const code = country.toUpperCase();
    return { type: "country", country: code, label: "" };
  }
  const city = searchParams.get("city");
  if (city) {
    return { type: "city", city, label: "" };
  }
  if (me?.city) {
    return { type: "city", city: me.city, label: me.cityLabel ?? me.city };
  }
  return null;
}

export function enrichMarketLocationLabel(
  filter: MarketLocationFilter | null,
  locale: string,
  cities: PresetCity[]
): MarketLocationFilter | null {
  if (!filter) return null;
  if (filter.type === "country") {
    if (filter.label) return filter;
    return { ...filter, label: countryLabel(filter.country, locale) };
  }
  if (filter.label) return filter;
  const match = cities.find((c) => c.city === filter.city);
  return { ...filter, label: match?.label ?? filter.city };
}
