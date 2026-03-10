import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Share2, AlertTriangle, User, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchCached } from "@/lib/api";
import { DashboardSkeleton } from "@/components/skeletons";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, MEDIA_TYPES, type MediaType, toMediaType } from "@logeverything/shared";
import type { Log } from "@logeverything/shared";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaLogs } from "@/pages/MediaLogs";
import { ItemImage } from "@/components/ItemImage";
import { GenreBadges } from "@/components/GenreBadges";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { ReactionButtons } from "@/components/ReactionButtons";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";

interface FeedEntry {
  log: Log;
  user: { id: string; username: string | null };
}

const paperShadow = { boxShadow: "var(--shadow-sm)" };
/** Character count for review preview before "View more". ~2 lines on mobile. */
const REVIEW_PREVIEW_LENGTH = 120;
const BETA_MODAL_STORAGE_KEY = "logeverything.betaModalSeen";
const SOCIAL_COLLAPSED_STORAGE_KEY = "logeverything.dashboard.socialCollapsed";
const BADGES_COLLAPSED_STORAGE_KEY = "logeverything.dashboard.badgesCollapsed";

function getSocialCollapsedDefault(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SOCIAL_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getBadgesCollapsedDefault(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(BADGES_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

interface BadgeProgressResponse {
  earnedBadges: Array<{ id: string; name: string; icon: string; medium: string | null; rarity: string }>;
  nextBadges: Array<{
    badge: { id: string; name: string; icon: string; medium: string | null; rarity: string };
    current: number;
    target: number;
    progressPct: number;
  }>;
  perMedium: Array<{
    mediaType: string;
    currentBadge: { id: string; name: string; icon: string } | null;
    nextBadge: {
      badge: { id: string; name: string; icon: string; medium: string | null; rarity: string };
      current: number;
      target: number;
      progressPct: number;
    } | null;
  }>;
  xpTotal: number;
  level: number;
}

function getBetaModalSeen(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(`${BETA_MODAL_STORAGE_KEY}.${userId}`) === "true";
  } catch {
    return true;
  }
}

function setBetaModalSeen(userId: string): void {
  try {
    localStorage.setItem(`${BETA_MODAL_STORAGE_KEY}.${userId}`, "true");
  } catch {
    // ignore
  }
}

export function Dashboard() {
  const { t } = useLocale();
  const { token } = useAuth();
  const { me } = useMe();
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
  const [showBetaModal, setShowBetaModal] = useState(false);
  /** Log id whose review is expanded in-card (no modal). */
  const [expandedReviewLogId, setExpandedReviewLogId] = useState<string | null>(null);
  const [socialCollapsed, setSocialCollapsed] = useState(getSocialCollapsedDefault);
  const [badgesCollapsed, setBadgesCollapsed] = useState(getBadgesCollapsedDefault);
  const [badgeProgress, setBadgeProgress] = useState<BadgeProgressResponse | null>(null);

  const toggleBadgesCollapsed = useCallback(() => {
    setBadgesCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(BADGES_COLLAPSED_STORAGE_KEY, next ? "true" : "false");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleSocialCollapsed = useCallback(() => {
    setSocialCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOCIAL_COLLAPSED_STORAGE_KEY, next ? "true" : "false");
      } catch {
        // ignore
      }
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

  useEffect(() => {
    if (me?.user?.id && !getBetaModalSeen(me.user.id)) setShowBetaModal(true);
  }, [me?.user?.id]);

  const handleBetaModalClose = useCallback(() => {
    if (me?.user?.id) setBetaModalSeen(me.user.id);
    setShowBetaModal(false);
  }, [me?.user?.id]);

  useEffect(() => {
    if (!token) {
      setFeed([]);
      return;
    }
    setFeedLoading(true);
    apiFetch<{ data: FeedEntry[] }>("/logs/feed")
      .then((res) => setFeed(res.data ?? []))
      .catch(() => setFeed([]))
      .finally(() => setFeedLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setBadgeProgress(null);
      return;
    }
    apiFetch<BadgeProgressResponse>("/me/badges/progress")
      .then(setBadgeProgress)
      .catch(() => setBadgeProgress(null));
  }, [token]);

  const handleShare = useCallback(async () => {
    if (!me?.user?.id) return;
    const slug = me.user.username || me.user.id;
    const base = `${window.location.origin}/${slug}`;
    const url =
      visibleTypes.includes(selectedCategory) && selectedCategory
        ? `${base}?category=${selectedCategory}`
        : base;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("dashboard.linkCopied"));
    } catch {
      toast.error(t("common.tryAgain"));
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

  if (loading && counts === null) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <DashboardSkeleton />
      </motion.div>
    );
  }

  if (error && counts === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
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

  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      <Dialog open={showBetaModal} onOpenChange={(open) => !open && handleBetaModalClose()}>
        <DialogContent onClose={handleBetaModalClose}>
          <DialogHeader>
            <DialogTitle className="text-[var(--color-lightest)]">
              {t("dashboard.betaModalTitle")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-light)]">
            {t("dashboard.betaModalMessage")}
          </p>
          <Button onClick={handleBetaModalClose} className="w-fit">
            {t("dashboard.betaModalGotIt")}
          </Button>
        </DialogContent>
      </Dialog>
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
                  className="rounded-md px-4 py-3 text-sm data-[state=on]:bg-gradient-to-br data-[state=on]:from-[var(--btn-gradient-start)] data-[state=on]:to-[var(--btn-gradient-end)] data-[state=on]:text-[var(--btn-text)] md:px-3 md:py-2"
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
              className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-left no-underline transition-colors text-[var(--color-warning-text)] hover:border-[var(--color-warning-hover-border)] hover:bg-[var(--color-warning-hover-bg)]"
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
            badgeProgress={
              badgeProgress?.perMedium.find((p) => p.mediaType === selectedCategory) ?? null
            }
          />
        </section>
      )}

      {token && (
        <section aria-label={t("dashboard.badgesSectionTitle")} className="flex min-w-0 flex-col gap-4 overflow-hidden">
          <button
            type="button"
            onClick={toggleBadgesCollapsed}
            className="flex min-w-0 items-center gap-2 rounded-md py-1 text-left text-lg font-semibold text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)]"
            aria-expanded={!badgesCollapsed}
            aria-controls="dashboard-badges-content"
            id="dashboard-badges-heading"
          >
            {badgesCollapsed ? (
              <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 truncate">{t("dashboard.badgesSectionTitle")}</span>
            {badgeProgress && (
              <span className="shrink-0 text-sm font-normal text-[var(--color-light)]">
                {t("dashboard.badgesEarnedCount", { count: String(badgeProgress.earnedBadges.length) })}
              </span>
            )}
          </button>
          {!badgesCollapsed && (
            <div id="dashboard-badges-content" role="region" aria-labelledby="dashboard-badges-heading">
              {!badgeProgress ? (
                <div className="min-h-[80px] flex items-center justify-center rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-dark)]/50">
                  <span className="text-sm text-[var(--color-light)]">{t("common.loading")}</span>
                </div>
              ) : (
                <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-dark)]/50 p-4">
                  {badgeProgress.nextBadges.length > 0 ? (
                    <div className="flex min-w-0 flex-col gap-2">
                      <p className="text-sm font-medium text-[var(--color-lightest)]">
                        {t("dashboard.badgesNextBadge")}
                      </p>
                      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                        <span className="shrink-0 text-2xl" aria-hidden>
                          {badgeProgress.nextBadges[0].badge.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--color-lightest)]">
                            {badgeProgress.nextBadges[0].badge.name}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-darkest)]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, badgeProgress.nextBadges[0].progressPct)}%`,
                                  minWidth: badgeProgress.nextBadges[0].current > 0 ? "4px" : 0,
                                }}
                              />
                            </div>
                            <span className="shrink-0 text-xs text-[var(--color-light)]">
                              {t("dashboard.badgesProgressLabel", {
                                current: String(badgeProgress.nextBadges[0].current),
                                target: String(badgeProgress.nextBadges[0].target),
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-light)]">
                      {t("dashboard.badgesNoNextBadge")}
                    </p>
                  )}
                  {badgeProgress.earnedBadges.length > 0 && (
                    <div className="flex min-w-0 flex-wrap gap-2">
                      {badgeProgress.earnedBadges.slice(0, 8).map((b) => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-2.5 py-1 text-xs text-[var(--color-lightest)]"
                          title={b.name}
                        >
                          <span aria-hidden>{b.icon}</span>
                          <span className="max-w-[100px] truncate sm:max-w-[140px]">{b.name}</span>
                        </span>
                      ))}
                      {badgeProgress.earnedBadges.length > 8 && (
                        <span className="text-xs text-[var(--color-light)]">
                          +{badgeProgress.earnedBadges.length - 8}
                        </span>
                      )}
                    </div>
                  )}
                  {badgeProgress.earnedBadges.length === 0 && badgeProgress.nextBadges.length === 0 && (
                    <p className="text-sm text-[var(--color-light)]">
                      {t("dashboard.badgesWriteReviews")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {token && (
        <section aria-label={t("social.sectionTitle")} className="flex min-w-0 flex-col gap-4 overflow-hidden">
          <button
            type="button"
            onClick={toggleSocialCollapsed}
            className="flex min-w-0 items-center gap-2 rounded-md py-1 text-left text-lg font-semibold text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)]"
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
          </button>
          {!socialCollapsed && (
          <div id="dashboard-social-content" role="region" aria-labelledby="dashboard-social-heading">
          {feedLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex min-w-0 gap-3 overflow-hidden rounded-md border border-[var(--color-dark)] bg-[var(--color-dark)] p-4 animate-pulse"
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
            <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-sm)]">
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
                      ? "border border-[var(--color-dark)]"
                      : isDropped
                        ? "border-2 border-red-500"
                        : isInProgress
                          ? "border-2 border-amber-400"
                          : isCompleted
                            ? "border-2 border-emerald-600"
                            : "border-2 border-[var(--color-mid)]";
                  return (
                  <motion.li key={log.id} variants={staggerItem} className="list-none">
                    <motion.div
                      whileTap={tapScale}
                      transition={tapTransition}
                      className={`flex min-w-0 flex-col overflow-hidden rounded-md bg-[var(--color-dark)] p-4 ${listBorderClass}`}
                      style={paperShadow}
                    >
                      <div className="flex min-w-0 gap-3">
                        <Link
                          to={`/item/${log.mediaType}/${log.externalId}`}
                          className="flex min-w-0 shrink-0 items-start gap-3 overflow-hidden text-inherit no-underline hover:opacity-90"
                        >
                          <ItemImage src={log.image} className="h-12 w-9 shrink-0 rounded" />
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                            <p className="min-w-0 truncate font-medium text-[var(--color-lightest)]">
                              {log.title}
                            </p>
                            {log.genres && log.genres.length > 0 && (
                              <GenreBadges genres={log.genres} maxCount={1} />
                            )}
                            <div className="flex shrink-0 items-center gap-2 mt-0.5">
                              {log.startedAt && log.completedAt && (
                                <span className="whitespace-nowrap text-xs text-[var(--color-light)]">
                                  {t("dashboard.finishedIn", {
                                    duration: formatTimeToFinish(log.startedAt, log.completedAt),
                                  })}
                                </span>
                              )}
                              {log.grade != null ? (
                                <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                              ) : (
                                <span className="text-[var(--color-light)]">—</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Link
                          to={`/${feedUser.username ?? feedUser.id}`}
                          className="text-xs text-[var(--color-light)] hover:text-[var(--color-lightest)] hover:underline"
                        >
                          {feedUser.username ?? t("social.userWithoutUsername")} · {t(`nav.${log.mediaType}`)}
                        </Link>
                        <Link
                          to={`/${feedUser.username ?? feedUser.id}`}
                          className="flex shrink-0 rounded p-1 text-[var(--color-light)] hover:bg-[var(--color-darkest)] hover:text-[var(--color-lightest)]"
                          aria-label={t("social.viewProfile", { name: feedUser.username ?? feedUser.id })}
                        >
                          <User className="size-3.5" aria-hidden />
                        </Link>
                      </div>
                      {log.review && (
                        <div className="mt-3 flex flex-col gap-2 border-t border-[var(--color-darkest)] pt-3">
                          {(() => {
                            const review = log.review;
                            const isExpanded = expandedReviewLogId === log.id;
                            const truncated = review.length > REVIEW_PREVIEW_LENGTH;
                            const preview = truncated && !isExpanded
                              ? review.slice(0, REVIEW_PREVIEW_LENGTH)
                              : review;
                            return (
                              <>
                                <p className="text-xs text-[var(--color-light)] whitespace-pre-wrap break-words">
                                  {preview}
                                  {truncated && !isExpanded && " ... "}
                                </p>
                                {truncated && (
                                  <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    className="w-fit h-auto p-0 text-xs text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                                    onClick={() => setExpandedReviewLogId(isExpanded ? null : log.id)}
                                  >
                                    {isExpanded ? t("social.viewLess") : t("social.viewMore")}
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                          <div className="flex flex-wrap items-center gap-2">
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
                        </div>
                      )}
                    </motion.div>
                  </motion.li>
                  );
                })}
              </div>
            </motion.ul>
          )}
          </div>
          )}
        </section>
      )}
    </div>
  );
}
