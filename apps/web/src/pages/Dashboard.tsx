import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Share2, AlertTriangle, User, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchCached, LOGS_INVALIDATED_EVENT } from "@/lib/api";
import { FullPageLoader } from "@/components/FullPageLoader";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, MEDIA_TYPES, type MediaType, toMediaType } from "@dogument/shared";
import type { Log } from "@dogument/shared";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { MediaLogs } from "@/pages/MediaLogs";
import { Select } from "@/components/ui/select";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import * as storage from "@/lib/storage";
import { ReactionButtons } from "@/components/ReactionButtons";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";

interface FeedEntry {
  log: Log;
  user: { id: string; username: string | null };
}

const paperShadow = { boxShadow: "var(--shadow-sm)" };
const BETA_MODAL_STORAGE_KEY = "dogument.betaModalSeen";
const SOCIAL_COLLAPSED_STORAGE_KEY = "dogument.dashboard.socialCollapsed";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Base URL for share profile link (always prod so shared links work). */
const PROFILE_SHARE_BASE_URL = "https://dogument-one.vercel.app";

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


type LogsPayload = { data: Log[]; nextCursor: string | null } | Log[];
const LOGS_PAGE_SIZE = 24;

export function Dashboard() {
  const { t } = useLocale();
  const { token } = useAuth();
  const { me, loading: meLoading } = useMe();
  const { visibleTypes } = useVisibleMediaTypes();
  const { setPageTitle, setRightSlot, setBelowNavbar } = usePageTitle() ?? {};
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const defaultCategory: MediaType = visibleTypes.length > 0 ? toMediaType(visibleTypes[0]) : "movies";
  const [selectedCategory, setSelectedCategory] = useState<MediaType>(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam as MediaType)) return toMediaType(categoryParam);
    return defaultCategory;
  });
  const [counts, setCounts] = useState<Record<MediaType, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedFriendFilter, setFeedFriendFilter] = useState<string>("all");
  const [followedUsers, setFollowedUsers] = useState<Array<{ id: string; username: string | null }>>([]);
  const [showBetaModal, setShowBetaModal] = useState(false);
  /** Log id whose review is expanded in-card (no modal). */
  const [expandedReviewLogId, setExpandedReviewLogId] = useState<string | null>(null);
  const [socialCollapsed, setSocialCollapsed] = useState(false);
  const [milestoneProgress, setMilestoneProgress] = useState<MilestoneProgressResponse | null>(null);
  const isMobile = useIsMobile();
  /** Initial logs for first paint (avoids second skeleton). Cleared when category changes so MediaLogs can show its skeleton. */
  const [initialLogsData, setInitialLogsData] = useState<{
    mediaType: MediaType;
    logs: Log[];
    nextCursor: string | null;
  } | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

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
      setSearchParams({ category: fallback }, { replace: true });
    }
  }, [visibleTypes, selectedCategory, setSearchParams]);

  const setCategory = useCallback(
    (type: MediaType) => {
      setSelectedCategory(type);
      setSearchParams({ category: type }, { replace: true });
    },
    [setSearchParams]
  );

  const fetchCounts = useCallback(() => {
    setError(null);
    setLoading(true);
    apiFetchCached<{ data: Record<MediaType, number> }>("/logs/counts", { ttlMs: 2 * 60 * 1000 })
      .then((res) => setCounts(res.data ?? null))
      .catch((err) => {
        setCounts(null);
        setError(err instanceof Error ? err.message : t("dashboard.couldntLoadLogs"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  /** Fetch first page of logs for selected category so we can show content without a second skeleton. */
  useEffect(() => {
    if (!token || !me || counts === null || visibleTypes.length === 0) return;
    const needInitial =
      !initialLoadDone && (initialLogsData === null || initialLogsData.mediaType !== selectedCategory);
    if (!needInitial) return;
    const params = new URLSearchParams({
      mediaType: selectedCategory,
      sort: "date",
      limit: String(LOGS_PAGE_SIZE),
    });
    let cancelled = false;
    apiFetchCached<LogsPayload>(`/logs?${params.toString()}`, { ttlMs: 2 * 60 * 1000 })
      .then((response) => {
        if (cancelled) return;
        const list = Array.isArray(response) ? response : response.data ?? [];
        const cursor = Array.isArray(response) ? null : (response.nextCursor ?? null);
        setInitialLogsData({ mediaType: selectedCategory, logs: list, nextCursor: cursor });
        setInitialLoadDone(true);
      })
      .catch(() => {
        if (cancelled) return;
        setInitialLogsData({ mediaType: selectedCategory, logs: [], nextCursor: null });
        setInitialLoadDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, me, counts, visibleTypes.length, selectedCategory, initialLoadDone, initialLogsData]);

  useEffect(() => {
    if (!me?.user?.id) return;
    const key = `${BETA_MODAL_STORAGE_KEY}.${me.user.id}`;
    storage.getItem(key).then((value) => {
      if (value !== "true") setShowBetaModal(true);
    });
  }, [me?.user?.id]);

  const handleBetaModalClose = useCallback(() => {
    if (me?.user?.id) void storage.setItem(`${BETA_MODAL_STORAGE_KEY}.${me.user.id}`, "true");
    setShowBetaModal(false);
  }, [me?.user?.id]);

  const betaDrawerCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!token) {
      setFollowedUsers([]);
      return;
    }
    apiFetch<{ data: Array<{ id: string; username: string | null }> }>("/follows")
      .then((res) => setFollowedUsers(res.data ?? []))
      .catch(() => setFollowedUsers([]));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setFeed([]);
      return;
    }
    setFeedLoading(true);
    const url = feedFriendFilter === "all" ? "/logs/feed" : `/logs/feed?userId=${encodeURIComponent(feedFriendFilter)}`;
    apiFetch<{ data: FeedEntry[] }>(url)
      .then((res) => setFeed(res.data ?? []))
      .catch(() => setFeed([]))
      .finally(() => setFeedLoading(false));
  }, [token, feedFriendFilter]);

  useEffect(() => {
    if (!token) {
      setMilestoneProgress(null);
      return;
    }
    apiFetch<MilestoneProgressResponse>("/me/milestones/progress")
      .then(setMilestoneProgress)
      .catch(() => setMilestoneProgress(null));
  }, [token]);

  useEffect(() => {
    const refetchMilestones = () => {
      if (!token) return;
      apiFetch<MilestoneProgressResponse>("/me/milestones/progress")
        .then(setMilestoneProgress)
        .catch(() => setMilestoneProgress(null));
    };
    window.addEventListener(LOGS_INVALIDATED_EVENT, refetchMilestones);
    return () => window.removeEventListener(LOGS_INVALIDATED_EVENT, refetchMilestones);
  }, [token]);

  const handleShare = useCallback(async () => {
    if (!me?.user?.id) return;
    const slug = me.user.username || me.user.id;
    const base = `${PROFILE_SHARE_BASE_URL}/${slug}`;
    const url =
      visibleTypes.includes(selectedCategory) && selectedCategory
        ? `${base}?category=${selectedCategory}`
        : base;
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
    const byTypeMap = Object.fromEntries(
      MEDIA_TYPES.map((type) => [type, counts?.[type] ?? 0])
    ) as Record<MediaType, number>;
    setBelowNavbar?.(
      <StickyCategoryStrip
        items={visibleTypes.map((type) => ({
          value: type,
          label: t(`nav.${type}`),
          count: byTypeMap[type] ?? 0,
        }))}
        selectedValue={selectedCategory}
        onSelect={(v) => setCategory(v as MediaType)}
        mobileOnly
        stickyTop="top-14"
        aria-label={t("dashboard.category")}
      />
    );
    return () => setBelowNavbar?.(null);
  }, [visibleTypes, selectedCategory, counts, t, setBelowNavbar, setCategory]);

  const byType = Object.fromEntries(
    MEDIA_TYPES.map((type) => [type, counts?.[type] ?? 0])
  ) as Record<MediaType, number>;

  const boardGameProvider = me?.boardGameProvider ?? "bgg";
  const apiKeyProvider = getApiKeyProviderForMediaType(selectedCategory, boardGameProvider);
  const hasBoardGameKey = !!(me?.apiKeys?.bgg || me?.apiKeys?.ludopedia);
  const needsApiKeyBanner =
    apiKeyProvider != null &&
    (selectedCategory === "boardgames"
      ? !hasBoardGameKey
      : me?.apiKeys && !me.apiKeys[apiKeyProvider]);

  const showFullPageLoader =
    meLoading ||
    (loading && counts === null) ||
    (!initialLoadDone && (initialLogsData === null || initialLogsData.mediaType !== selectedCategory));
  if (showFullPageLoader) {
    return <FullPageLoader />;
  }

  if (error && counts === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-4">
            <p className="font-medium text-[var(--color-lightest)]">
              {t("dashboard.couldntLoadLogs")}
            </p>
            <p className="text-sm text-[var(--color-light)]">{error}</p>
            <Button
              onClick={fetchCounts}
            >
              {t("common.tryAgain")}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  const betaContent = (onClose: () => void) => (
    <>
      <div className="flex flex-col gap-6 max-md:gap-4">
        <DialogHeader className="max-md:space-y-2">
          <DialogTitle className="text-[var(--color-lightest)] text-xl max-md:text-2xl">
            {t("dashboard.betaModalTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-light)] max-md:text-base max-md:leading-relaxed">
          {t("dashboard.betaModalMessage")}
        </p>
      </div>
      <DrawerFooter>
        <Button onClick={onClose} className="w-fit max-md:w-full max-md:min-h-[48px] max-md:text-base">
          {t("dashboard.betaModalGotIt")}
        </Button>
      </DrawerFooter>
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      {isMobile ? (
        <Drawer open={showBetaModal} onOpenChange={(open) => !open && handleBetaModalClose()}>
          <DrawerContent
            onClose={handleBetaModalClose}
            onReady={(requestClose) => {
              betaDrawerCloseRef.current = requestClose;
            }}
            mobileHeight="30%"
            className="flex flex-col p-6 max-md:pt-6"
          >
            {betaContent(() => betaDrawerCloseRef.current?.() ?? handleBetaModalClose())}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showBetaModal} onOpenChange={(open) => !open && handleBetaModalClose()}>
          <DialogContent onClose={handleBetaModalClose} className="flex flex-col gap-6 px-8 py-6 max-md:px-6">
            {betaContent(handleBetaModalClose)}
          </DialogContent>
        </Dialog>
      )}
      {visibleTypes.length > 0 && (
        <section
            aria-label={t("dashboard.category")}
            className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]"
          >
            {/* Desktop: toggle group */}
            <div className="flex min-w-0 w-full shrink-0 justify-center overflow-hidden">
            <ToggleGroup
              type="single"
              value={selectedCategory}
              onValueChange={(v) => v && setCategory(v as MediaType)}
              className="hidden md:inline-flex flex-wrap justify-center gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-2 md:w-fit"
              aria-label={t("dashboard.category")}
            >
              {visibleTypes.map((type) => (
                <ToggleGroupItem
                  key={type}
                  value={type}
                  className="rounded-md px-4 py-3 text-sm max-md:min-h-[44px] data-[state=on]:bg-gradient-to-br data-[state=on]:from-[var(--btn-gradient-start)] data-[state=on]:to-[var(--btn-gradient-end)] data-[state=on]:text-[var(--btn-text)] md:px-3 md:py-2"
                  aria-label={`${t(`nav.${type}`)} (${byType[type] ?? 0})`}
                >
                  {t(`nav.${type}`)} ({byType[type] ?? 0})
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
            {needsApiKeyBanner && (
            <Link
              to="/settings?open=api-keys"
              className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 max-md:min-h-[44px] text-left no-underline transition-colors text-[var(--color-warning-text)] hover:border-[var(--color-warning-hover-border)] hover:bg-[var(--color-warning-hover-bg)]"
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-[var(--color-warning-icon)]" aria-hidden />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-warning-text)]">
                {t("apiKeyBanner.categoryMessage", {
                  category: t(`nav.${selectedCategory}`),
                  provider: API_KEY_META[apiKeyProvider].name,
                })}
              </p>
              <span className="shrink-0 text-xs font-medium text-[var(--color-warning-text-muted)]">
                {t("apiKeyBanner.addKeyInSettings")} →
              </span>
            </Link>
          )}
          <MediaLogs
            mediaType={selectedCategory}
            embedded
            milestoneProgress={
              milestoneProgress?.perMedium.find((p) => p.mediaType === selectedCategory) ?? null
            }
            initialLogs={
              initialLogsData?.mediaType === selectedCategory ? initialLogsData.logs : undefined
            }
            initialNextCursor={
              initialLogsData?.mediaType === selectedCategory ? initialLogsData.nextCursor : undefined
            }
          />
        </section>
      )}

      {token && (
        <section aria-label={t("social.sectionTitle")} className="flex min-w-0 flex-col gap-4 overflow-hidden">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleSocialCollapsed}
              className="flex min-w-0 items-center gap-2 rounded-md py-1 max-md:min-h-[44px] max-md:py-3 text-left text-lg font-semibold text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/20 focus:outline-none"
              aria-expanded={!socialCollapsed}
              aria-controls="dashboard-social-content"
              id="dashboard-social-heading"
            >
              {socialCollapsed ? (
                <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 truncate">{t("social.sectionTitle")}</span>
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
                className="min-w-0 max-w-[12rem] shrink-0"
                triggerClassName="min-w-0"
              />
            )}
          </div>
          {!socialCollapsed && (
          <div id="dashboard-social-content" role="region" aria-labelledby="dashboard-social-heading">
            <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-dark)]/50 p-4">
              {feedLoading ? (
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
                to="/search"
                className="mt-3 flex justify-center text-sm text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("social.findUsers")}
              </Link>
            </Card>
          ) : (
            <motion.ul
              className="list-none m-0 min-w-0 p-0"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <div className="flex min-w-0 flex-col gap-2">
                {feed.map(({ log, user: feedUser }) => {
                  const isDropped = log.status === "dropped";
                  const isInProgress = log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status);
                  const isCompleted = log.status != null && (COMPLETED_STATUSES as readonly string[]).includes(log.status);
                  const listBorderClass =
                    log.status == null
                      ? "border border-[var(--color-surface-border)]"
                      : isDropped
                        ? "border border-red-500"
                        : isInProgress
                          ? "border border-amber-400"
                          : isCompleted
                            ? "border border-emerald-600"
                            : "border border-[var(--color-mid)]";
                  const isExpanded = expandedReviewLogId === log.id;
                  return (
                  <motion.li key={log.id} variants={staggerItem} className="list-none">
                    <motion.div
                      whileTap={tapScale}
                      transition={tapTransition}
                      className={`flex min-w-0 flex-row overflow-hidden rounded-lg bg-[var(--color-dark)] p-0 ${!isExpanded ? "min-h-[160px] h-[160px]" : "min-h-[140px]"} ${listBorderClass}`}
                      style={paperShadow}
                    >
                      {/* Left: image full height */}
                      <Link
                        to={`/item/${log.mediaType}/${log.externalId}`}
                        className="h-full min-h-full w-28 flex-shrink-0 overflow-hidden rounded-l-lg sm:w-32"
                      >
                        <ItemImage src={log.image} className="h-full w-full object-cover" />
                      </Link>
                      {/* Middle: title, meta, user, review */}
                      <div className={`flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden p-3 sm:p-4 ${!isExpanded ? "min-h-0" : ""}`}>
                        <Link
                          to={`/item/${log.mediaType}/${log.externalId}`}
                          className="min-w-0 truncate font-semibold text-[var(--color-lightest)] no-underline hover:underline text-sm sm:text-base shrink-0"
                        >
                          {log.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-light)] shrink-0">
                          {log.grade != null ? (
                            <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                          ) : (
                            <span>—</span>
                          )}
                          {(() => {
                            const duration = log.startedAt && log.completedAt ? formatTimeToFinish(log.startedAt, log.completedAt) : "";
                            return duration ? (
                              <span className="whitespace-nowrap">{t("dashboard.finishedIn", { duration })}</span>
                            ) : null;
                          })()}
                          {log.mediaType === "boardgames" && (log.own === true || (log.matchesPlayed != null && log.matchesPlayed > 0)) && (
                            <>
                              {log.own === true && (
                                <span className="whitespace-nowrap">{t("itemReviewForm.own")}</span>
                              )}
                              {log.matchesPlayed != null && log.matchesPlayed > 0 && (
                                <span className="whitespace-nowrap">{t("itemReviewForm.matchesPlayed")}: {log.matchesPlayed}</span>
                              )}
                            </>
                          )}
                        </div>
                        <Link
                          to={`/${feedUser.username ?? feedUser.id}`}
                          className="flex w-fit items-center gap-1.5 text-xs text-[var(--color-light)] hover:text-[var(--color-lightest)] hover:underline shrink-0"
                        >
                          <User className="size-3.5 shrink-0" aria-hidden />
                          {feedUser.username ?? t("social.userWithoutUsername")} · {t(`nav.${log.mediaType}`)}
                        </Link>
                        {log.review ? (
                          <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden min-w-0">
                            {(() => {
                              const review = log.review;
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
                    </motion.div>
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
    </div>
  );
}
