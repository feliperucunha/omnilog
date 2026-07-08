import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Share2, User, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
  apiFetchSWR,
  getCachedEntry,
  HEAVY_PAGE_TTL_MS,
  invalidateLogsAndItemsCache,
  requestLogsCacheWarm,
  LOGS_INVALIDATED_EVENT,
} from "@/lib/api";
import {
  buildFeedPath,
  buildLogsListPathFromSearchParams,
  FOLLOWS_PATH,
  loadWithSWR,
  MILESTONES_PATH,
  prefetchDashboardPageCaches,
  registerFollowedUserIds,
  registerLogsPageCacheContext,
  warmFriendFeedCaches,
} from "@/lib/logsPageCache";
import { useAppPtrRefresh } from "@/hooks/useAppPtrRefresh";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  MEDIA_TYPES,
  SPEND_TRACKED_MEDIA_TYPES,
  type MediaType,
  toMediaType,
} from "@geeklogs/shared";
import type { Log } from "@geeklogs/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/useMediaQuery";
import {
  MediaLogs,
  type CollectionListFilter,
  type MediaLogsSort,
  type SharedFilters,
} from "@/pages/MediaLogs";
import { Select } from "@/components/ui/select";
import { BookPagesBadge } from "@/components/BookPagesBadge";
import { ItemImage } from "@/components/ItemImage";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatLogScopeLabel, getLogCardDisplay } from "@/lib/logDisplay";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { getStatusLabel } from "@/lib/statusLabel";
import { logStatusBadgeClass, logStatusBorderClass } from "@/lib/logStatusColors";
import { tapScale, tapTransition } from "@/lib/animations";
import { listStaggerItemClassName, listStaggerItemVariants, listStaggerParentProps } from "@/lib/motionPolicy";
import { itemDetailPath } from "@/lib/itemRoutes";
import {
  LOG_CARD_BODY_GAP,
  LOG_CARD_BODY_PADDING,
  LOG_CARD_HEIGHT_FEED_COLLAPSED,
  LOG_CARD_HEIGHT_FEED_EXPANDED,
  LOG_CARD_IMAGE_COLUMN_ROUNDED_L,
  LOG_CARD_TITLE,
} from "@/lib/logCardLayout";
import { MotionLink } from "@/components/MotionLink";
import * as storage from "@/lib/storage";
import { ReactionButtons } from "@/components/ReactionButtons";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";
import { paperShadow } from "@/lib/paperShadow";
import { decodeLogForDisplay } from "@/lib/decodeDisplayFields";
import { OnboardingSpotlight } from "@/components/OnboardingSpotlight";
import { getFirstVisibleByIds, ONBOARDING_SPOTLIGHT_KEYS } from "@/lib/onboardingSpotlightStorage";
import { tierHasProFeatures } from "@/lib/userTier";

interface FeedEntry {
  log: Log;
  user: { id: string; username: string | null };
}

const BETA_MODAL_STORAGE_KEY = "geeklogs.betaModalSeen";
const SOCIAL_COLLAPSED_STORAGE_KEY = "geeklogs.dashboard.socialCollapsed";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const FEED_SCORE_SOURCE_LABELS: Partial<Record<MediaType, string>> = {
  movies: "IMDB",
  tv: "IMDB",
  anime: "MAL",
  manga: "MAL",
  games: "RAWG",
};
/** Base URL for share profile link (always prod so shared links work). */
const PROFILE_SHARE_BASE_URL = "https://geeklogs.com.br";

/** Milestone progress from GET /me/milestones/progress */
interface ScopeProgress {
  current: number;
  next: { threshold: number; label: string; icon: string } | null;
  progressPct: number;
  earned: Array<{ threshold: number; label: string; icon: string }>;
}
interface PerMediumMilestoneProgress {
  mediaType: string;
  reviews: ScopeProgress;
  logs: ScopeProgress;
}
interface MilestoneProgressResponse {
  perMedium: PerMediumMilestoneProgress[];
  global: { reviews: ScopeProgress; logs: ScopeProgress };
}


const VALID_LOGS_SORTS: MediaLogsSort[] = [
  "dateAsc",
  "dateDesc",
  "gradeAsc",
  "gradeDesc",
  "matchesPlayedAsc",
  "matchesPlayedDesc",
  "weightAsc",
  "weightDesc",
  "timeToBeatAsc",
  "timeToBeatDesc",
];

/** Matches StickyCategoryStrip layout while /me (or cached order) is not ready yet. */
function CategoryOrderSkeletonStrip() {
  return (
    <div
      className="scrollbar-hide flex min-h-[3rem] min-w-0 overflow-x-auto scroll-smooth [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [touch-action:pan-x]"
      aria-busy
    >
      <div className="flex min-w-max items-stretch gap-6 pl-2.5 pr-2.5 md:pl-3 md:pr-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex shrink-0 flex-col items-center justify-start pt-3">
            <div className="h-4 w-16 max-w-[5rem] animate-pulse rounded bg-[var(--color-mid)]/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { t } = useLocale();
  const { token } = useAuth();
  const { me } = useMe();
  const { visibleTypes, visibleTypesOrderReady } = useVisibleMediaTypes();
  const { setPageTitle, setRightSlot, setBelowNavbar } = usePageTitle() ?? {};
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const logsInitialFilters = useMemo((): Partial<SharedFilters> | undefined => {
    const params = new URLSearchParams(searchParamsKey);
    const status = params.get("status") ?? "";
    const sortRaw = params.get("sort") ?? "dateDesc";
    const sort = VALID_LOGS_SORTS.includes(sortRaw as MediaLogsSort) ? (sortRaw as MediaLogsSort) : "dateDesc";
    const q = params.get("q") ?? "";
    const ownQ = params.get("own") === "true";
    const wtbQ = params.get("wantToBuy") === "true";
    const genre = params.get("genre") ?? "";
    let collection: CollectionListFilter = "";
    if (ownQ) collection = "owned";
    else if (wtbQ) collection = "wantToBuy";
    if (!status && sort === "dateDesc" && !q && !collection && !genre) return undefined;
    return {
      status,
      sort,
      search: q,
      collection,
      genre,
    };
  }, [searchParamsKey]);
  const categoryParam = searchParams.get("category");
  const defaultCategory: MediaType = visibleTypes.length > 0 ? toMediaType(visibleTypes[0]) : "movies";
  const [selectedCategory, setSelectedCategory] = useState<MediaType>(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam as MediaType)) return toMediaType(categoryParam);
    return defaultCategory;
  });
  const [counts, setCounts] = useState<Record<MediaType, number> | null>(() => {
    const cached = getCachedEntry<{ data: Record<MediaType, number> }>("GET", "/logs/counts");
    return cached?.data?.data ?? null;
  });
  /** Background fetch for category strip counts only — never blocks the main dashboard shell. */
  const [countsLoading, setCountsLoading] = useState(
    () => !getCachedEntry<{ data: Record<MediaType, number> }>("GET", "/logs/counts")
  );
  const [countsError, setCountsError] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>(() => {
    const cached = getCachedEntry<{ data: FeedEntry[] }>("GET", buildFeedPath());
    if (!cached?.data?.data) return [];
    return cached.data.data.map((e) => ({ ...e, log: decodeLogForDisplay(e.log) }));
  });
  const [feedLoading, setFeedLoading] = useState(
    () => !getCachedEntry<{ data: FeedEntry[] }>("GET", buildFeedPath())
  );
  const [feedFriendFilter, setFeedFriendFilter] = useState<string>("all");
  const [followedUsers, setFollowedUsers] = useState<Array<{ id: string; username: string | null }>>([]);
  const [showBetaModal, setShowBetaModal] = useState(false);
  /** Log id whose review is expanded in-card (no modal). */
  const [expandedReviewLogId, setExpandedReviewLogId] = useState<string | null>(null);
  const [socialCollapsed, setSocialCollapsed] = useState(false);
  const [milestoneProgress, setMilestoneProgress] = useState<MilestoneProgressResponse | null>(null);
  const isMobile = useIsMobile();
  /** Current filters from MediaLogs (for share URL). */
  const shareFiltersRef = useRef<SharedFilters>({
    status: "",
    sort: "dateDesc",
    search: "",
    collection: "",
    genre: "",
  });

  /** Load collapsed prefs from persistent storage (Android/Capacitor). */
  useEffect(() => {
    let cancelled = false;
    storage.getItem(SOCIAL_COLLAPSED_STORAGE_KEY).then((social) => {
      if (cancelled) return;
      if (social === "true") setSocialCollapsed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSocialCollapsed = useCallback(() => {
    setSocialCollapsed((prev) => {
      const next = !prev;
      void storage.setItem(SOCIAL_COLLAPSED_STORAGE_KEY, next ? "true" : "false");
      return next;
    });
  }, []);

  useEffect(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam as MediaType)) setSelectedCategory(toMediaType(categoryParam));
    else if (!categoryParam && visibleTypes.length > 0) setSelectedCategory(toMediaType(visibleTypes[0]));
  }, [categoryParam, visibleTypes]);

  useEffect(() => {
    if (visibleTypes.length > 0 && !visibleTypes.includes(selectedCategory)) {
      const fallback = toMediaType(visibleTypes[0]);
      setSelectedCategory(fallback);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("category", fallback);
        return next;
      }, { replace: true });
    }
  }, [visibleTypes, selectedCategory, setSearchParams]);

  const setCategory = useCallback(
    (type: MediaType) => {
      setSelectedCategory(type);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("category", type);
        return next;
      }, { replace: true });
    },
    [setSearchParams]
  );

  const isPro = tierHasProFeatures(me?.tier);
  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);

  const cachedCategoryLogs = useMemo(() => {
    const path = buildLogsListPathFromSearchParams(
      selectedCategory,
      new URLSearchParams(searchParamsKey)
    );
    const entry = getCachedEntry<Log[] | { data: Log[]; nextCursor: string | null }>("GET", path);
    if (!entry) return null;
    const raw = Array.isArray(entry.data) ? entry.data : entry.data.data;
    const cursor = Array.isArray(entry.data) ? null : (entry.data.nextCursor ?? null);
    return {
      logs: (raw ?? []).map(decodeLogForDisplay),
      cursor,
    };
  }, [selectedCategory, searchParamsKey]);

  const fetchCounts = useCallback(() => {
    setCountsError(null);
    const path = "/logs/counts";
    const cached = getCachedEntry<{ data: Record<MediaType, number> }>("GET", path);
    if (cached) {
      setCounts(cached.data.data ?? null);
      setCountsLoading(false);
    } else {
      setCountsLoading(true);
    }

    void apiFetchSWR<{ data: Record<MediaType, number> }>(path, {
      ttlMs: HEAVY_PAGE_TTL_MS,
      onUpdate: (res) => {
        const payload = res as { data: Record<MediaType, number> };
        setCounts(payload.data ?? null);
        setCountsError(null);
      },
    })
      .then(({ data }) => {
        setCounts(data.data ?? null);
        setCountsError(null);
      })
      .catch((err) => {
        if (!cached) setCounts(null);
        setCountsError(err instanceof Error ? err.message : t("dashboard.couldntLoadLogs"));
      })
      .finally(() => setCountsLoading(false));
  }, [t]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const applyFeedResponse = useCallback((res: { data: FeedEntry[] }) => {
    setFeed((res.data ?? []).map((e) => ({ ...e, log: decodeLogForDisplay(e.log) })));
  }, []);

  const fetchFollows = useCallback(() => {
    if (!token) {
      setFollowedUsers([]);
      registerFollowedUserIds([]);
      return;
    }
    void loadWithSWR<{ data: Array<{ id: string; username: string | null }> }>(
      FOLLOWS_PATH,
      (res) => {
        const list = res.data ?? [];
        setFollowedUsers(list);
        const ids = list.map((u) => u.id);
        registerFollowedUserIds(ids);
        warmFriendFeedCaches(ids);
      },
      { onError: () => {
        setFollowedUsers([]);
        registerFollowedUserIds([]);
      } }
    );
  }, [token]);

  const fetchFeed = useCallback(() => {
    if (!token) {
      setFeed([]);
      return;
    }
    const path =
      feedFriendFilter === "all" ? buildFeedPath() : buildFeedPath(feedFriendFilter);
    const cached = getCachedEntry<{ data: FeedEntry[] }>("GET", path);
    if (cached) {
      applyFeedResponse(cached.data);
      setFeedLoading(false);
    } else {
      setFeedLoading((prev) => (feed.length === 0 ? true : prev));
    }

    void apiFetchSWR<{ data: FeedEntry[] }>(path, {
      ttlMs: HEAVY_PAGE_TTL_MS,
      onUpdate: (res) => applyFeedResponse(res as { data: FeedEntry[] }),
    })
      .then(({ data }) => {
        applyFeedResponse(data);
      })
      .catch(() => {
        if (!cached) setFeed([]);
      })
      .finally(() => setFeedLoading(false));
  }, [token, feedFriendFilter, applyFeedResponse]);

  const fetchMilestones = useCallback(() => {
    if (!token) {
      setMilestoneProgress(null);
      return;
    }
    void loadWithSWR<MilestoneProgressResponse>(MILESTONES_PATH, setMilestoneProgress, {
      onError: () => setMilestoneProgress(null),
    });
  }, [token]);

  useEffect(() => {
    if (!visibleTypesOrderReady || visibleTypes.length === 0) return;
    registerLogsPageCacheContext({
      mediaTypes: visibleTypes,
      tzOffsetMinutes,
      isPro,
    });
    prefetchDashboardPageCaches(
      visibleTypes,
      selectedCategory,
      new URLSearchParams(searchParamsKey)
    );
  }, [visibleTypes, visibleTypesOrderReady, tzOffsetMinutes, isPro, selectedCategory, searchParamsKey]);

  useEffect(() => {
    fetchFollows();
  }, [fetchFollows]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  useEffect(() => {
    if (!me?.user?.id) return;
    if (me.announcements?.betaBanner?.enabled === false) {
      setShowBetaModal(false);
      return;
    }
    const key = `${BETA_MODAL_STORAGE_KEY}.${me.user.id}`;
    void storage.getItem(key).then((value) => {
      setShowBetaModal(value !== "true");
    });
  }, [me?.user?.id, me?.announcements?.betaBanner?.enabled]);

  const handleBetaModalClose = useCallback(() => {
    if (me?.user?.id) void storage.setItem(`${BETA_MODAL_STORAGE_KEY}.${me.user.id}`, "true");
    setShowBetaModal(false);
  }, [me?.user?.id]);

  const handleEmbeddedMediaLogsFiltersChange = useCallback(
    (f: SharedFilters) => {
      shareFiltersRef.current = f;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("category", selectedCategory);
          if (f.status) next.set("status", f.status);
          else next.delete("status");
          if (f.sort !== "dateDesc") next.set("sort", f.sort);
          else next.delete("sort");
          if (f.search.trim()) next.set("q", f.search.trim());
          else next.delete("q");
          next.delete("own");
          next.delete("wantToBuy");
          if (f.collection === "owned") next.set("own", "true");
          else if (f.collection === "wantToBuy") next.set("wantToBuy", "true");
          if (f.genre.trim()) next.set("genre", f.genre.trim());
          else next.delete("genre");
          next.delete("purchased");
          next.delete("purchaseDate");
          if (next.toString() === prev.toString()) return prev;
          return next;
        },
        { replace: true }
      );
    },
    [selectedCategory, setSearchParams]
  );

  useAppPtrRefresh(() => {
    fetchCounts();
    if (!token) return;
    fetchMilestones();
    fetchFeed();
    fetchFollows();
    invalidateLogsAndItemsCache();
    requestLogsCacheWarm();
  });

  useEffect(() => {
    const onLogsInvalidated = () => {
      fetchCounts();
      fetchMilestones();
      fetchFeed();
    };
    window.addEventListener(LOGS_INVALIDATED_EVENT, onLogsInvalidated);
    return () => window.removeEventListener(LOGS_INVALIDATED_EVENT, onLogsInvalidated);
  }, [fetchCounts, fetchMilestones, fetchFeed]);

  /** When opening a friend from the feed, keep the same list filters as on the home category list (search, sort, status, collection). */
  const feedUserProfilePath = useCallback(
    (slug: string, logMediaType: MediaType) => {
      const next = new URLSearchParams();
      next.set("category", logMediaType);
      const q = searchParams.get("q");
      if (q?.trim()) next.set("q", q.trim());
      const status = searchParams.get("status");
      if (status) next.set("status", status);
      const sort = searchParams.get("sort");
      if (sort) next.set("sort", sort);
      if (searchParams.get("own") === "true") next.set("own", "true");
      if (searchParams.get("wantToBuy") === "true") next.set("wantToBuy", "true");
      const genre = searchParams.get("genre");
      if (genre) next.set("genre", genre);
      return `/${slug}?${next.toString()}`;
    },
    [searchParams]
  );

  const handleShare = useCallback(async () => {
    if (!me?.user?.id) return;
    const slug = me.user.username || me.user.id;
    const base = `${PROFILE_SHARE_BASE_URL}/${slug}`;
    const params = new URLSearchParams();
    if (visibleTypes.includes(selectedCategory) && selectedCategory) {
      params.set("category", selectedCategory);
      const f = shareFiltersRef.current;
      if (f.status) params.set("status", f.status);
      if (f.sort && f.sort !== "dateDesc") params.set("sort", f.sort);
      if (f.search.trim()) params.set("q", f.search.trim());
      if (f.collection === "owned") params.set("own", "true");
      else if (f.collection === "wantToBuy") params.set("wantToBuy", "true");
      if (f.genre.trim()) params.set("genre", f.genre.trim());
    }
    const query = params.toString();
    const url = query ? `${base}?${query}` : base;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("dashboard.linkCopied"));
    } catch (err) {
      showErrorToast(t, "E017", { originalError: err });
    }
  }, [me?.user?.id, visibleTypes, selectedCategory, t]);

  useEffect(() => {
    setPageTitle?.(t("dashboard.title"));
    return () => {
      setPageTitle?.(null);
      setRightSlot?.(null);
      setBelowNavbar?.(null);
    };
  }, [t, setPageTitle, setRightSlot, setBelowNavbar]);

  useEffect(() => {
    if (me?.user?.id) {
      setRightSlot?.(
        <Button type="button" variant="outline" size="sm" onClick={handleShare} aria-label={t("dashboard.share")}>
          <Share2 className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{t("dashboard.share")}</span>
        </Button>
      );
    } else {
      setRightSlot?.(null);
    }
    return () => setRightSlot?.(null);
  }, [me?.user?.id, handleShare, t, setRightSlot]);

  useEffect(() => {
    if (visibleTypes.length === 0) {
      setBelowNavbar?.(null);
      return;
    }
    if (!visibleTypesOrderReady) {
      setBelowNavbar?.(
        <div className="sticky top-14 z-20 w-full shrink-0 self-start">
          <CategoryOrderSkeletonStrip />
        </div>
      );
      return () => setBelowNavbar?.(null);
    }
    const byTypeMap = Object.fromEntries(
      MEDIA_TYPES.map((type) => [type, counts?.[type] ?? 0])
    ) as Record<MediaType, number>;
    setBelowNavbar?.(
      <StickyCategoryStrip
        items={visibleTypes.map((type) => ({
          value: type,
          label: t(`nav.${type}`),
          ...(counts != null ? { count: byTypeMap[type] ?? 0 } : {}),
        }))}
        selectedValue={selectedCategory}
        onSelect={(v) => setCategory(v as MediaType)}
        mobileOnly={false}
        bare
        aria-label={t("dashboard.category")}
      />
    );
    return () => setBelowNavbar?.(null);
  }, [visibleTypes, visibleTypesOrderReady, selectedCategory, counts, t, setBelowNavbar, setCategory]);

  const betaMessageParagraphs = t("dashboard.betaModalMessage").split("\n\n");

  const betaBody = (
    <div className="flex flex-col gap-4 max-md:gap-3">
      <DialogHeader className="max-md:space-y-2">
        <DialogTitle className="min-w-0 text-[var(--color-lightest)] text-xl max-md:text-2xl">
          <OverflowMarquee>{t("dashboard.betaModalTitle")}</OverflowMarquee>
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 text-sm text-[var(--color-light)] max-md:text-base max-md:leading-relaxed">
        {betaMessageParagraphs.map((paragraph, i) => (
          <p key={i} className="m-0">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );

  const betaUnderstoodButton = (
    <Button
      type="button"
      className="w-full max-md:min-h-[48px] max-md:text-base md:w-fit"
      onClick={handleBetaModalClose}
    >
      {t("dashboard.betaModalGotIt")}
    </Button>
  );

  const getDashboardImportSpotlightTarget = useCallback(
    () =>
      getFirstVisibleByIds([
        "onboarding-dashboard-import-desktop",
        "onboarding-dashboard-import-mobile",
      ]),
    []
  );

  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      {countsError != null && counts === null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
        >
          <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 shadow-[var(--shadow-md)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-lightest)]">{t("dashboard.couldntLoadCounts")}</p>
                <p className="mt-1 text-sm text-[var(--color-light)]">{countsError}</p>
              </div>
              <Button type="button" variant="outline" className="shrink-0" onClick={fetchCounts} disabled={countsLoading}>
                {t("common.tryAgain")}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
      {isMobile ? (
        <Drawer open={showBetaModal} onOpenChange={(open) => !open && handleBetaModalClose()}>
          <DrawerContent
            onClose={handleBetaModalClose}
            mobileHeight="auto"
            className="flex flex-col gap-0 px-4 pb-0 pt-2 max-md:px-4"
          >
            <div className="px-2 pb-2 pt-4">{betaBody}</div>
            <DrawerFooter className="border-t border-[var(--color-surface-border)] px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {betaUnderstoodButton}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showBetaModal} onOpenChange={(open) => !open && handleBetaModalClose()}>
          <DialogContent onClose={handleBetaModalClose} className="flex max-h-[min(90vh,720px)] flex-col gap-6 overflow-y-auto px-8 py-6 max-md:px-6">
            {betaBody}
            <div className="shrink-0 border-t border-[var(--color-surface-border)] pt-4">{betaUnderstoodButton}</div>
          </DialogContent>
        </Dialog>
      )}
      {visibleTypes.length > 0 && (
        <section
            aria-label={t("dashboard.category")}
            className="flex min-w-0 flex-col gap-4 overflow-hidden max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none md:rounded-xl md:border md:border-[var(--color-category-border)] md:bg-[var(--color-category-bg)] md:p-4 md:shadow-[var(--shadow-category)]"
          >
          <MediaLogs
            key={selectedCategory}
            mediaType={selectedCategory}
            embedded
            milestoneProgress={
              milestoneProgress?.perMedium.find((p) => p.mediaType === selectedCategory) ?? null
            }
            initialLogs={cachedCategoryLogs?.logs}
            initialNextCursor={cachedCategoryLogs?.cursor ?? undefined}
            initialFilters={logsInitialFilters}
            initialFiltersSyncKey={searchParamsKey}
            onFiltersChange={handleEmbeddedMediaLogsFiltersChange}
          />
        </section>
      )}

      {token && (
        <section aria-label={t("social.sectionTitle")} className="flex min-w-0 flex-col gap-4 overflow-hidden">
          <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
            <button
              type="button"
              onClick={toggleSocialCollapsed}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 max-md:min-h-[44px] max-md:py-3 text-left text-lg font-semibold text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/20 focus:outline-none"
              aria-expanded={!socialCollapsed}
              aria-controls="dashboard-social-content"
              id="dashboard-social-heading"
            >
              {socialCollapsed ? (
                <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />
              )}
              <OverflowMarquee className="min-w-0 flex-1">{t("social.sectionTitle")}</OverflowMarquee>
              {(() => {
                const now = Date.now();
                const newCount = feed.filter((e) => now - new Date(e.log.createdAt).getTime() < ONE_WEEK_MS).length;
                return (
                  <span className="shrink-0 text-sm font-normal text-[var(--color-light)]">
                    {t("social.newEntriesLastWeek", { count: String(newCount) })}
                  </span>
                );
              })()}
            </button>
            {!socialCollapsed && (
              <Select
                value={feedFriendFilter}
                onValueChange={setFeedFriendFilter}
                options={[
                  { value: "all", label: t("social.filterAll") },
                  ...followedUsers.map((u) => ({
                    value: u.id,
                    label: u.username ?? u.id,
                  })),
                ]}
                aria-label={t("social.filterByFriend")}
                className="min-w-0 w-full max-md:h-auto max-md:self-auto md:w-[11rem] md:max-w-[min(100%,12rem)] md:shrink-0"
                triggerClassName="h-10 w-full min-w-0 max-w-none max-md:min-h-[44px] md:h-10 md:min-h-10 md:max-h-10"
                contentScrollable={followedUsers.length > 6}
              />
            )}
          </div>
          {!socialCollapsed && (
          <div id="dashboard-social-content" role="region" aria-labelledby="dashboard-social-heading">
            <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-dark)]/50 p-4">
              {feedLoading && feed.length === 0 ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex min-w-0 gap-3 overflow-hidden rounded-md border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 animate-pulse"
                >
                  <div className="h-12 w-9 shrink-0 rounded bg-[var(--color-mid)]/30" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-[var(--color-mid)]/30" />
                    <div className="h-3 w-1/4 rounded bg-[var(--color-mid)]/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : feed.length === 0 ? (
            <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-sm)]">
              <p className="text-center text-[var(--color-light)]">
                {t("social.emptyFeed")}
              </p>
              <Link
                to="/"
                className="mt-3 flex justify-center text-sm text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("social.findUsers")}
              </Link>
            </Card>
          ) : (
            <motion.ul className="list-none m-0 min-w-0 p-0" {...listStaggerParentProps}>
              <div className="flex min-w-0 flex-col gap-2">
                {feed.map(({ log, user: feedUser }) => {
                  const display = getLogCardDisplay(log);
                  const scopeLabel = formatLogScopeLabel(t, display);
                  const listBorderClass = logStatusBorderClass(log.status);
                  const badgeClass = logStatusBadgeClass(log.status);
                  const isExpanded = expandedReviewLogId === log.id;
                  return (
                  <motion.li
                    key={log.id}
                    variants={listStaggerItemVariants}
                    className={`list-none ${listStaggerItemClassName}`}
                  >
                    <div
                      className={`flex min-w-0 flex-row overflow-hidden rounded-lg bg-[var(--color-dark)] p-0 ${!isExpanded ? LOG_CARD_HEIGHT_FEED_COLLAPSED : LOG_CARD_HEIGHT_FEED_EXPANDED} ${listBorderClass}`}
                      style={paperShadow}
                    >
                      {/* Left: image full height */}
                      <MotionLink
                        to={itemDetailPath(log.mediaType, log.externalId)}
                        whileTap={tapScale}
                        transition={tapTransition}
                        className={LOG_CARD_IMAGE_COLUMN_ROUNDED_L}
                      >
                        <div className="absolute inset-0 min-h-0 rounded-l-lg">
                          <ItemImage
                            src={log.image}
                            className="h-full w-full min-h-0 rounded-l-lg"
                            mediaType={log.mediaType}
                            boardGameSource={log.boardGameSource}
                          />
                        </div>
                        {(() => {
                          const sourceLabel = FEED_SCORE_SOURCE_LABELS[log.mediaType];
                          const showScore = sourceLabel != null && typeof log.apiScore === "number" && log.apiScore > 0;
                          if (!showScore) return null;
                          return (
                            <span
                              className="absolute top-1 right-1 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-yellow-300 backdrop-blur-sm sm:top-1.5 sm:right-1.5 sm:text-[10px] whitespace-nowrap"
                              title={`${sourceLabel} ${log.apiScore!.toFixed(1)} / 10`}
                            >
                              {sourceLabel} {log.apiScore!.toFixed(1)}
                            </span>
                          );
                        })()}
                        {log.status && (
                          <span
                            className={`absolute bottom-1 right-1 z-10 rounded px-1.5 py-0.5 text-[9px] font-medium sm:bottom-1.5 sm:right-1.5 sm:text-[10px] whitespace-nowrap ${badgeClass}`}
                            title={getStatusLabel(t, log.status, log.mediaType)}
                          >
                            {getStatusLabel(t, log.status, log.mediaType)}
                          </span>
                        )}
                      </MotionLink>
                      {/* Middle: title, meta, user, review */}
                      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden ${LOG_CARD_BODY_GAP} ${LOG_CARD_BODY_PADDING} ${!isExpanded ? "min-h-0" : ""}`}>
                        <MotionLink
                          to={itemDetailPath(log.mediaType, log.externalId)}
                          whileTap={tapScale}
                          transition={tapTransition}
                          className="block min-w-0 shrink-0 font-semibold text-[var(--color-lightest)] no-underline hover:underline"
                        >
                          <OverflowMarquee className={LOG_CARD_TITLE}>
                            {log.title}
                          </OverflowMarquee>
                        </MotionLink>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-light)] shrink-0">
                          {display.grade != null ? (
                            <StarRating value={gradeToStars(display.grade)} readOnly size="sm" showGradeText={false} />
                          ) : (
                            <span>—</span>
                          )}
                          {scopeLabel ? (
                            <span className="rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-mid)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--color-lightest)] whitespace-nowrap">
                              {scopeLabel}
                            </span>
                          ) : null}
                          {(log.mediaType === "tv" || log.mediaType === "movies" || log.mediaType === "anime") &&
                            log.networks?.[0] && (
                            <span className="rounded-full bg-[var(--color-mid)]/30 px-2 py-0.5 text-[10px] font-medium text-[var(--color-lightest)] whitespace-nowrap">
                              {log.networks[0]}
                            </span>
                          )}
                          {log.mediaType === "books" && (
                            <BookPagesBadge pagesCount={log.pagesCount} />
                          )}
                          {log.mediaType === "boardgames" && (() => {
                            const min = typeof log.playersMin === "number" && log.playersMin > 0 ? log.playersMin : null;
                            const max = typeof log.playersMax === "number" && log.playersMax > 0 ? log.playersMax : null;
                            if (min == null && max == null) return null;
                            const label =
                              min != null && max != null && min !== max
                                ? t("mediaLogs.boardgamePlayersBadgeRange", { min: String(min), max: String(max) })
                                : t("mediaLogs.boardgamePlayersBadgeSingle", { count: String(min ?? max) });
                            return (
                              <span className="rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-mid)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--color-lightest)] whitespace-nowrap">
                                {label}
                              </span>
                            );
                          })()}
                          {(() => {
                            const duration = log.startedAt && log.completedAt ? formatTimeToFinish(log.startedAt, log.completedAt) : "";
                            return duration ? (
                              <span className="whitespace-nowrap">{t("dashboard.finishedIn", { duration })}</span>
                            ) : null;
                          })()}
                          {(SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(log.mediaType) &&
                            (log.own === true ||
                              log.wantToBuy === true ||
                              (log.mediaType === "boardgames" &&
                                log.matchesPlayed != null &&
                                log.matchesPlayed > 0)) && (
                            <>
                              {log.own === true && (
                                <span className="whitespace-nowrap">{t("itemReviewForm.own")}</span>
                              )}
                              {log.wantToBuy === true && (
                                <span className="whitespace-nowrap">{t("itemReviewForm.wantToBuy")}</span>
                              )}
                              {log.mediaType === "boardgames" &&
                                log.matchesPlayed != null &&
                                log.matchesPlayed > 0 && (
                                <span className="whitespace-nowrap">
                                  {t("itemReviewForm.matchesPlayed")}: {log.matchesPlayed}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <Link
                          to={feedUserProfilePath(feedUser.username ?? feedUser.id, log.mediaType)}
                          className="flex w-fit items-center gap-1.5 text-xs text-[var(--color-light)] hover:text-[var(--color-lightest)] hover:underline shrink-0"
                        >
                          <User className="size-3.5 shrink-0" aria-hidden />
                          {feedUser.username ?? t("social.userWithoutUsername")} · {t(`nav.${log.mediaType}`)}
                        </Link>
                        {display.review ? (
                          <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden min-w-0">
                            {(() => {
                              const review = display.review!;
                              return (
                                <>
                                  {isExpanded ? (
                                    <div className="min-h-0 overflow-hidden shrink-0">
                                      <p className="text-xs text-[var(--color-light)] whitespace-pre-wrap break-words">
                                        {review}
                                      </p>
                                    </div>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    className="w-fit shrink-0 h-auto p-0 text-xs text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                                    onClick={() => setExpandedReviewLogId(isExpanded ? null : log.id)}
                                  >
                                    {isExpanded ? t("social.viewLess") : t("social.viewReview")}
                                  </Button>
                                  <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1 mt-auto">
                                    <ReactionButtons
                                      logId={log.id}
                                      likesCount={log.likesCount ?? 0}
                                      dislikesCount={log.dislikesCount ?? 0}
                                      userReaction={log.userReaction ?? null}
                                      disabled={!token}
                                      onReactionChange={(payload) => {
                                        setFeed((prev) =>
                                          prev.map((e) =>
                                            e.log.id === log.id
                                              ? {
                                                  ...e,
                                                  log: {
                                                    ...e.log,
                                                    likesCount: payload.likesCount,
                                                    dislikesCount: payload.dislikesCount,
                                                    userReaction: payload.userReaction,
                                                  },
                                                }
                                              : e
                                          )
                                        );
                                      }}
                                    />
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1 mt-auto">
                            <ReactionButtons
                              logId={log.id}
                              likesCount={log.likesCount ?? 0}
                              dislikesCount={log.dislikesCount ?? 0}
                              userReaction={log.userReaction ?? null}
                              disabled={!token}
                              onReactionChange={(payload) => {
                                setFeed((prev) =>
                                  prev.map((e) =>
                                    e.log.id === log.id
                                      ? {
                                          ...e,
                                          log: {
                                            ...e.log,
                                            likesCount: payload.likesCount,
                                            dislikesCount: payload.dislikesCount,
                                            userReaction: payload.userReaction,
                                          },
                                        }
                                      : e
                                  )
                                );
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.li>
                  );
                })}
              </div>
            </motion.ul>
              )}
            </div>
          </div>
          )}
        </section>
      )}
      <OnboardingSpotlight
        storageKey={ONBOARDING_SPOTLIGHT_KEYS.dashboardImport}
        getTarget={getDashboardImportSpotlightTarget}
        message={t("onboarding.spotlightDashboardImport")}
        enabled={visibleTypes.length > 0 && visibleTypesOrderReady}
      />
    </div>
  );
}
