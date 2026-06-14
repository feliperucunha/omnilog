import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  MARKET_MEDIA_TYPES,
  MARKET_SORT_OPTIONS,
  DEFAULT_MARKET_SORT,
  isMarketSortValue,
  type MarketListing,
  type MarketLocationFilter,
  type MarketLocationsResponse,
  type MarketMediaType,
  type MarketListingsResponse,
  type MarketSortValue,
} from "@geeklogs/shared";
import { UnifiedSearchBar } from "@/components/UnifiedSearchBar";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";
import { MarketListingCard } from "@/components/MarketListingCard";
import { MarketListingDrawer } from "@/components/MarketListingDrawer";
import {
  MarketLocationCombobox,
  buildPresetCountries,
  enrichMarketLocationLabel,
  parseMarketLocationFromUrl,
} from "@/components/MarketLocationCombobox";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useMe } from "@/contexts/MeContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { showErrorToast } from "@/lib/errorToast";
import { LOG_LIST_CARD_GRID_DENSE } from "@/lib/logCardLayout";
import { listStaggerItemClassName, listStaggerItemVariants, listStaggerParentProps } from "@/lib/motionPolicy";
import { paperShadow } from "@/lib/paperShadow";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export function Market() {
  const { t, locale } = useLocale();
  const { token } = useAuth();
  const { me } = useMe();
  const { setPageTitle, setBelowNavbar } = usePageTitle() ?? {};
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCategory = (searchParams.get("category") as MarketMediaType) || "boardgames";
  const [category, setCategory] = useState<MarketMediaType>(
    MARKET_MEDIA_TYPES.includes(initialCategory) ? initialCategory : "boardgames"
  );
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const initialSort = searchParams.get("sort");
  const [sortBy, setSortBy] = useState<MarketSortValue>(
    initialSort && isMarketSortValue(initialSort) ? initialSort : DEFAULT_MARKET_SORT
  );
  const [locationFilter, setLocationFilter] = useState<MarketLocationFilter | null>(() =>
    parseMarketLocationFromUrl(searchParams, me)
  );
  const [presetCities, setPresetCities] = useState<{ city: string; label: string }[]>([]);
  const [presetCountryCodes, setPresetCountryCodes] = useState<{ country: string }[]>([]);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [drawerListing, setDrawerListing] = useState<MarketListing | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const locationInitialized = useRef(false);
  const skipSortResetOnCategoryChange = useRef(
    Boolean(initialSort && isMarketSortValue(initialSort))
  );

  useEffect(() => {
    setPageTitle?.(t("market.title"));
    return () => setPageTitle?.(null);
  }, [t, setPageTitle]);

  useEffect(() => {
    if (locationInitialized.current || !me?.city) return;
    if (!searchParams.get("city") && !searchParams.get("country")) {
      setLocationFilter({ type: "city", city: me.city, label: me.cityLabel ?? me.city });
    }
    locationInitialized.current = true;
  }, [me?.city, me?.cityLabel, searchParams]);

  useEffect(() => {
    void apiFetch<MarketLocationsResponse>("/market/locations")
      .then((res) => {
        setPresetCities(res.data?.cities ?? []);
        setPresetCountryCodes(res.data?.countries ?? []);
      })
      .catch(() => {
        setPresetCities([]);
        setPresetCountryCodes([]);
      });
  }, []);

  const comboboxCities = useMemo(() => {
    const seen = new Set<string>();
    const rows: { city: string; label: string }[] = [];
    if (me?.city && me.cityLabel && !seen.has(me.city)) {
      rows.push({ city: me.city, label: me.cityLabel });
      seen.add(me.city);
    }
    for (const city of presetCities) {
      if (seen.has(city.city)) continue;
      seen.add(city.city);
      rows.push(city);
    }
    return rows;
  }, [presetCities, me?.city, me?.cityLabel]);

  const comboboxCountries = useMemo(
    () => buildPresetCountries(presetCountryCodes, locale),
    [presetCountryCodes, locale]
  );

  useEffect(() => {
    setLocationFilter((prev) => enrichMarketLocationLabel(prev, locale, comboboxCities));
  }, [locale, comboboxCities]);

  const fetchListings = useCallback(
    async (opts: { append?: boolean; cursor?: string | null } = {}) => {
      const { append = false, cursor = null } = opts;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("mediaType", category);
        params.set("limit", "24");
        if (query.trim()) params.set("q", query.trim());
        if (locationFilter?.type === "country") {
          params.set("country", locationFilter.country);
        } else if (locationFilter?.type === "city") {
          params.set("city", locationFilter.city);
        }
        if (sortBy !== DEFAULT_MARKET_SORT) params.set("sort", sortBy);
        if (cursor) params.set("cursor", cursor);
        const res = await apiFetch<MarketListingsResponse>(
          `/market/listings?${params.toString()}`
        );
        setListings((prev) => (append ? [...prev, ...res.data] : res.data));
        setNextCursor(res.nextCursor);
      } catch (err) {
        if (!append) setListings([]);
        showErrorToast(t, "E017", { originalError: err });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, query, locationFilter, sortBy, t]
  );

  useEffect(() => {
    if (skipSortResetOnCategoryChange.current) {
      skipSortResetOnCategoryChange.current = false;
      return;
    }
    setSortBy(DEFAULT_MARKET_SORT);
  }, [category]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("category", category);
    if (query.trim()) params.set("q", query.trim());
    if (locationFilter?.type === "country") {
      params.set("country", locationFilter.country);
    } else if (locationFilter?.type === "city") {
      params.set("city", locationFilter.city);
    }
    if (sortBy !== DEFAULT_MARKET_SORT) params.set("sort", sortBy);
    setSearchParams(params, { replace: true });
  }, [category, query, locationFilter, sortBy, setSearchParams]);

  useEffect(() => {
    setBelowNavbar?.(
      <div className="w-full min-w-0">
        <StickyCategoryStrip
          items={MARKET_MEDIA_TYPES.map((type) => ({
            value: type,
            label: t(`nav.${type}`),
          }))}
          selectedValue={category}
          onSelect={(v) => setCategory(v as MarketMediaType)}
          showCount={false}
          mobileOnly={false}
          bare
          aria-label={t("dashboard.category")}
        />
      </div>
    );
    return () => setBelowNavbar?.(null);
  }, [category, t, setBelowNavbar]);

  const handleOpenListing = (listing: MarketListing) => {
    setDrawerListing(listing);
    setDrawerOpen(true);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <Card
        className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
        style={paperShadow}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <UnifiedSearchBar
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("market.searchPlaceholder")}
              inputAriaLabel={t("market.searchPlaceholder")}
              clearAriaLabel={t("search.clearSearch")}
              submitAriaLabel={t("search.search")}
              showClear={query.trim() !== ""}
              onClear={() => setQuery("")}
              disableSubmitWhenEmpty={false}
            />
          </div>
          <div className="min-w-0 w-full shrink-0 sm:w-56">
            <MarketLocationCombobox
              value={locationFilter}
              onChange={setLocationFilter}
              presetCities={comboboxCities}
              presetCountries={comboboxCountries}
              placeholder={t("market.location")}
              allLocationsLabel={t("market.allLocations")}
              countriesSectionLabel={t("market.locationCountries")}
              citiesSectionLabel={t("market.locationCities")}
              ariaLabel={t("market.location")}
            />
          </div>
          <div className="min-w-0 w-full shrink-0 sm:w-52">
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as MarketSortValue)}
              options={MARKET_SORT_OPTIONS.map((opt) => ({
                value: opt.value,
                label: t(opt.labelKey),
              }))}
              className="min-w-0 w-full"
              triggerClassName="h-11 min-h-11 max-h-11 max-md:min-h-[44px] md:h-11 md:min-h-11 md:max-h-11 min-w-0 w-full max-w-none"
              aria-label={t("search.sortBy")}
            />
          </div>
        </div>
      </Card>

      {!token && (
        <p className="text-center text-sm text-[var(--color-light)]">
          <Link to="/login" className="text-[var(--color-lightest)] underline hover:no-underline">
            {t("itemPage.logInLink")}
          </Link>{" "}
          {t("market.logInToList")}
        </p>
      )}

      {loading && listings.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-light)]" aria-hidden />
        </div>
      ) : listings.length === 0 ? (
        <p className="py-12 text-center text-[var(--color-light)]">{t("market.noListings")}</p>
      ) : (
        <motion.div
          {...listStaggerParentProps}
          className={cn(LOG_LIST_CARD_GRID_DENSE, "pb-4")}
        >
          {listings.map((listing) => (
            <motion.div
              key={listing.id}
              variants={listStaggerItemVariants}
              className={listStaggerItemClassName}
            >
              <MarketListingCard
                listing={listing}
                t={t}
                locale={locale}
                onOpen={handleOpenListing}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {nextCursor && (
        <div className="flex justify-center pb-8">
          <Button
            type="button"
            variant="secondary"
            disabled={loadingMore}
            onClick={() => void fetchListings({ append: true, cursor: nextCursor })}
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t("common.loading")}
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" aria-hidden />
                {t("market.loadMore")}
              </>
            )}
          </Button>
        </div>
      )}

      <MarketListingDrawer
        listing={drawerListing}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        t={t}
        locale={locale}
        onDeleted={(listingId) => {
          setListings((prev) => prev.filter((l) => l.id !== listingId));
          setDrawerListing(null);
        }}
      />
    </div>
  );
}
