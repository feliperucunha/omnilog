import { useCallback, useEffect, useRef, useState } from "react";
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
  type MarketMediaType,
  type MarketListingsResponse,
  type MarketSortValue,
} from "@geeklogs/shared";
import { UnifiedSearchBar } from "@/components/UnifiedSearchBar";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";
import { MarketListingCard } from "@/components/MarketListingCard";
import { MyMarketListingDrawer } from "@/components/MyMarketListingDrawer";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { apiFetch } from "@/lib/api";
import { showErrorToast } from "@/lib/errorToast";
import { LOG_LIST_CARD_GRID_DENSE } from "@/lib/logCardLayout";
import { listStaggerItemClassName, listStaggerItemVariants, listStaggerParentProps } from "@/lib/motionPolicy";
import { paperShadow } from "@/lib/paperShadow";
import { cn } from "@/lib/utils";

export function MyListings() {
  const { t, locale } = useLocale();
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
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [drawerListing, setDrawerListing] = useState<MarketListing | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const skipSortResetOnCategoryChange = useRef(
    Boolean(initialSort && isMarketSortValue(initialSort))
  );

  useEffect(() => {
    setPageTitle?.(t("market.myListingsTitle"));
    return () => setPageTitle?.(null);
  }, [t, setPageTitle]);

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
        if (sortBy !== DEFAULT_MARKET_SORT) params.set("sort", sortBy);
        if (cursor) params.set("cursor", cursor);
        const res = await apiFetch<MarketListingsResponse>(
          `/market/my/listings?${params.toString()}`
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
    [category, query, sortBy, t]
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
    if (sortBy !== DEFAULT_MARKET_SORT) params.set("sort", sortBy);
    setSearchParams(params, { replace: true });
  }, [category, query, sortBy, setSearchParams]);

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

  const handleListingSaved = (updated: MarketListing) => {
    setListings((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setDrawerListing(updated);
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

      {loading && listings.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-light)]" aria-hidden />
        </div>
      ) : listings.length === 0 ? (
        <p className="py-12 text-center text-[var(--color-light)]">{t("market.noMyListings")}</p>
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

      <MyMarketListingDrawer
        listing={drawerListing}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSaved={handleListingSaved}
        onDeleted={(listingId) => {
          setListings((prev) => prev.filter((l) => l.id !== listingId));
          setDrawerListing(null);
        }}
      />
    </div>
  );
}
