import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, Loader2, Share2 } from "lucide-react";
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
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useLocale } from "@/contexts/LocaleContext";
import { apiFetchPublic } from "@/lib/api";
import { showErrorToast } from "@/lib/errorToast";
import { LOG_LIST_CARD_GRID_DENSE } from "@/lib/logCardLayout";
import { listStaggerItemClassName, listStaggerItemVariants, listStaggerParentProps } from "@/lib/motionPolicy";
import { paperShadow } from "@/lib/paperShadow";
import { shareOrCopyPageUrl } from "@/lib/shareOrCopyPageUrl";
import { userStoreShareUrl } from "@/lib/userStoreRoutes";
import { cn } from "@/lib/utils";

const RESERVED_PATHS = new Set([
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "onboarding",
  "search",
  "statistics",
  "about",
  "faq",
  "privacy",
  "terms",
  "tiers",
  "settings",
  "item",
  "market",
  "dashboard",
  "movies",
  "tv",
  "boardgames",
  "games",
  "books",
  "anime",
  "manga",
  "comics",
  "api",
  "store",
]);

type PublicStoreProfile = {
  id: string;
  username: string | null;
};

export function UserStorePage() {
  const { userId } = useParams<{ userId: string }>();
  const { t, locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<PublicStoreProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

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
  const skipSortResetOnCategoryChange = useRef(
    Boolean(initialSort && isMarketSortValue(initialSort))
  );

  const displayName = profile?.username?.trim() || userId || "";
  const storeTitle = t("market.userStoreTitle", { name: displayName });

  useEffect(() => {
    if (!userId || RESERVED_PATHS.has(userId)) {
      setProfileError(true);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    setProfileError(false);
    void apiFetchPublic<PublicStoreProfile>(`/users/${userId}`)
      .then((data) => setProfile(data))
      .catch(() => setProfileError(true))
      .finally(() => setProfileLoading(false));
  }, [userId]);

  const fetchListings = useCallback(
    async (opts: { append?: boolean; cursor?: string | null } = {}) => {
      if (!userId || profileError) return;
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
        const res = await apiFetchPublic<MarketListingsResponse>(
          `/users/${encodeURIComponent(userId)}/market/listings?${params.toString()}`
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
    [userId, profileError, category, query, sortBy, t]
  );

  useEffect(() => {
    if (profileLoading || profileError) return;
    if (skipSortResetOnCategoryChange.current) {
      skipSortResetOnCategoryChange.current = false;
      return;
    }
    setSortBy(DEFAULT_MARKET_SORT);
  }, [category, profileLoading, profileError]);

  useEffect(() => {
    if (profileLoading || profileError) return;
    void fetchListings();
  }, [fetchListings, profileLoading, profileError]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("category", category);
    if (query.trim()) params.set("q", query.trim());
    if (sortBy !== DEFAULT_MARKET_SORT) params.set("sort", sortBy);
    setSearchParams(params, { replace: true });
  }, [category, query, sortBy, setSearchParams]);

  const handleShare = useCallback(() => {
    if (!userId) return;
    const shareId = profile?.username?.trim() || profile?.id || userId;
    void shareOrCopyPageUrl(
      { url: userStoreShareUrl(shareId), title: storeTitle },
      t
    );
  }, [userId, profile?.username, profile?.id, storeTitle, t]);

  if (profileLoading) {
    return (
      <div className="flex justify-center px-4 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-light)]" aria-hidden />
      </div>
    );
  }

  if (profileError || !userId) {
    return (
      <div className="px-4 py-12">
        <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6" style={paperShadow}>
          <p className="text-center text-[var(--color-light)]">{t("market.storeNotFound")}</p>
        </Card>
      </div>
    );
  }

  const profilePath = `/${profile?.username?.trim() || profile?.id || userId}`;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 px-4 py-4 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="min-w-0 text-xl font-semibold text-[var(--color-lightest)] sm:text-2xl">
            <OverflowMarquee>{storeTitle}</OverflowMarquee>
          </h1>
          <p className="mt-1 text-sm text-[var(--color-light)]">
            <Link to={profilePath} className="text-blue-500 hover:underline dark:text-blue-400">
              {t("market.viewSellerProfile")}
            </Link>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 self-start"
          onClick={handleShare}
        >
          <Share2 className="mr-2 h-4 w-4" aria-hidden />
          {t("market.shareStore")}
        </Button>
      </div>

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
        <p className="py-12 text-center text-[var(--color-light)]">{t("market.noStoreListings")}</p>
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
              <MarketListingCard listing={listing} t={t} locale={locale} />
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
    </div>
  );
}
