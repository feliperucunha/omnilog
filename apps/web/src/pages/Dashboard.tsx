import { useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from "react";
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
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { getLogCardDisplay } from "@/lib/logDisplay";
import { isCompletedStatus } from "@/lib/logStatusColors";
import { listStaggerItemClassName, listStaggerItemVariants, listStaggerParentProps } from "@/lib/motionPolicy";
import { itemDetailPath } from "@/lib/itemRoutes";
import { cn } from "@/lib/utils";
import * as storage from "@/lib/storage";
import { ReactionButtons } from "@/components/ReactionButtons";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";
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

/** Friend filter pill used in the Social section (All + followed users). */
function FeedFilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors max-md:min-h-[40px]",
        active
          ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/15 text-[var(--color-lightest)]"
          : "border-[var(--color-mid)]/40 bg-[var(--color-dark)] text-[var(--color-light)] hover:text-[var(--color-lightest)]"
      )}
    >
      {children}
      {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--btn-gradient-start)]" aria-hidden />}
    </button>
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
    const players = params.get("players") ?? "";
    let collection: CollectionListFilter = "";
    if (ownQ) collection = "owned";
    else if (wtbQ) collection = "wantToBuy";
    if (!status && sort === "dateDesc" && !q && !collection && !genre && !players) return undefined;
    return {
      status,
      sort,
      search: q,
      collection,
      genre,
      players,
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
    players: "",
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
          if (f.players.trim()) next.set("players", f.players.trim());
          else next.delete("players");
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
                  <span className="shrink-0 rounded-full border border-[var(--color-mid)]/25 bg-[var(--color-mid)]/15 px-2.5 py-1 text-xs font-medium text-[var(--color-lightest)]">
                    {t("social.newEntriesLastWeek", { count: String(newCount) })}
                  </span>
                );
              })()}
            </button>
            {!socialCollapsed && (
              <div
                role="group"
                aria-label={t("social.filterByFriend")}
                className="scrollbar-hide -mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:w-auto md:shrink-0 md:flex-none md:flex-wrap md:justify-end md:overflow-visible md:px-0 md:pb-0"
              >
                <FeedFilterPill active={feedFriendFilter === "all"} onClick={() => setFeedFriendFilter("all")}>
                  {t("social.filterAll")}
                </FeedFilterPill>
                {followedUsers.map((u) => (
                  <FeedFilterPill
                    key={u.id}
                    active={feedFriendFilter === u.id}
                    onClick={() => setFeedFriendFilter(feedFriendFilter === u.id ? "all" : u.id)}
                  >
                    {u.username ?? u.id}
                  </FeedFilterPill>
                ))}
              </div>
            )}
          </div>
          {!socialCollapsed && (
          <div id="dashboard-social-content" role="region" aria-labelledby="dashboard-social-heading">
            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--color-mid)]/15 bg-[var(--color-darkest)]/40 p-3 md:gap-4 md:p-4">
              {feedLoading && feed.length === 0 ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex min-w-0 gap-3 overflow-hidden rounded-2xl border border-[var(--color-surface-border)]/50 bg-[var(--color-dark)] p-4 animate-pulse"
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
            <Card className="rounded-2xl border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-sm)]">
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
                  const profilePath = feedUserProfilePath(feedUser.username ?? feedUser.id, log.mediaType);
                  const verb =
                    display.grade != null
                      ? t("social.ratedEntry")
                      : isCompletedStatus(log.status)
                        ? t("social.finishedEntry")
                        : t("social.loggedEntry");
                  const ago = (() => {
                    const diff = Date.now() - new Date(log.createdAt).getTime();
                    if (diff < 60_000) return t("social.timeAgoJustNow");
                    const mins = Math.floor(diff / 60_000);
                    if (mins < 60) return t("social.timeAgoMinutes", { count: String(mins) });
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return t("social.timeAgoHours", { count: String(hrs) });
                    const days = Math.floor(hrs / 24);
                    return t("social.timeAgoDays", { count: String(days) });
                  })();
                  return (
                    <motion.li
                      key={log.id}
                      variants={listStaggerItemVariants}
                      className={`list-none ${listStaggerItemClassName}`}
                    >
                      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-mid)]/10 bg-[var(--color-dark)] p-2.5 shadow-[var(--shadow-sm)]">
                        <Link
                          to={profilePath}
                          aria-label={feedUser.username ?? t("social.userWithoutUsername")}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--btn-gradient-start)]/20 text-[var(--btn-gradient-start)] hover:bg-[var(--btn-gradient-start)]/30"
                        >
                          <User className="size-4" aria-hidden />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">
                            <Link to={profilePath} className="text-[var(--btn-gradient-start)] hover:underline">
                              @{feedUser.username ?? t("social.userWithoutUsername")}
                            </Link>{" "}
                            <span className="font-normal text-[var(--color-light)]">{verb}</span>{" "}
                            <Link to={itemDetailPath(log.mediaType, log.externalId)} className="font-semibold text-[var(--color-lightest)] hover:underline">
                              {log.title}
                            </Link>
                          </p>
                          <p className="mt-0.5 text-[10px] text-[var(--color-light)]">
                            {t(`nav.${log.mediaType}`)} · {ago}
                          </p>
                        </div>
                        <ReactionButtons
                          logId={log.id}
                          likesCount={log.likesCount ?? 0}
                          dislikesCount={log.dislikesCount ?? 0}
                          userReaction={log.userReaction ?? null}
                          disabled={!token}
                          onReactionChange={(payload) =>
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
                            )
                          }
                        />
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
