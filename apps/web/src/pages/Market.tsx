import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  MARKET_MEDIA_TYPES,
  type MarketListing,
  type MarketMediaType,
  type MarketListingsResponse,
} from "@geeklogs/shared";
import { UnifiedSearchBar } from "@/components/UnifiedSearchBar";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";
import { MarketListingCard } from "@/components/MarketListingCard";
import { MarketListingDrawer } from "@/components/MarketListingDrawer";
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

const ALL_LOCATIONS = "";

type LocationOption = { city: string; label: string };

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
  const [locationCity, setLocationCity] = useState(
    searchParams.get("city") ?? me?.city ?? ALL_LOCATIONS
  );
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [drawerListing, setDrawerListing] = useState<MarketListing | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const locationInitialized = useRef(false);

  useEffect(() => {
    setPageTitle?.(t("market.title"));
    return () => setPageTitle?.(null);
  }, [t, setPageTitle]);

  useEffect(() => {
    if (locationInitialized.current || !me?.city) return;
    if (!searchParams.get("city")) {
      setLocationCity(me.city);
    }
    locationInitialized.current = true;
  }, [me?.city, searchParams]);

  useEffect(() => {
    void apiFetch<{ data: LocationOption[] }>("/market/locations")
      .then((res) => setLocationOptions(res.data ?? []))
      .catch(() => setLocationOptions([]));
  }, []);

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
        if (locationCity) params.set("city", locationCity);
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
    [category, query, locationCity, t]
  );

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("category", category);
    if (query.trim()) params.set("q", query.trim());
    if (locationCity) params.set("city", locationCity);
    setSearchParams(params, { replace: true });
  }, [category, query, locationCity, setSearchParams]);

  const locationSelectOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: ALL_LOCATIONS, label: t("market.allLocations") },
    ];
    const seen = new Set<string>();
    if (me?.city && me.cityLabel) {
      opts.push({ value: me.city, label: me.cityLabel });
      seen.add(me.city);
    }
    for (const loc of locationOptions) {
      if (seen.has(loc.city)) continue;
      seen.add(loc.city);
      opts.push({ value: loc.city, label: loc.label });
    }
    return opts;
  }, [locationOptions, me?.city, me?.cityLabel, t]);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
          <div className="min-w-0 w-full sm:w-48">
            <Select
              value={locationCity}
              onValueChange={setLocationCity}
              options={locationSelectOptions}
              placeholder={t("market.location")}
              aria-label={t("market.location")}
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
