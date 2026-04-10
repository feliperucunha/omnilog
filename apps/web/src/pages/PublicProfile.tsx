import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useParams, useSearchParams, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchPublic } from "@/lib/api";
import { PublicProfileSkeleton } from "@/components/skeletons";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { MEDIA_TYPES, type MediaType, toMediaType } from "@geeklogs/shared";
import {
  MediaLogs,
  type CollectionListFilter,
  type MediaLogsSort,
  type CategoryMilestoneProgress,
} from "@/pages/MediaLogs";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";
import { LevelBadge } from "@/components/LevelBadge";
import { MEDIA_BADGE_ICONS } from "@/lib/mediaBadgeIcons";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Per-medium milestone progress (same shape as GET /me/milestones/progress). */
interface PublicMilestoneProgress {
  perMedium: CategoryMilestoneProgress[];
}

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
  "movies",
  "tv",
  "boardgames",
  "games",
  "books",
  "anime",
  "manga",
  "comics",
  "api",
]);

interface ProfileBadge {
  id: string;
  name: string;
  icon: string;
  medium: string | null;
}

interface PublicProfileResponse {
  id: string;
  username: string | null;
  visibleMediaTypes: string[];
  logCount: number;
  selectedBadges?: ProfileBadge[];
}

export function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { t } = useLocale();
  const { token } = useAuth();
  const { me } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [counts, setCounts] = useState<Record<MediaType, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [publicMilestoneProgress, setPublicMilestoneProgress] = useState<PublicMilestoneProgress | null>(null);
  const [pinnedHighlightsOpen, setPinnedHighlightsOpen] = useState(false);
  const [milestoneBadgesOpen, setMilestoneBadgesOpen] = useState(false);
  const isOwnProfile = !!me?.user?.id && !!profile?.id && me.user.id === profile.id;

  const visibleTypes = profile?.visibleMediaTypes ?? [];
  const defaultCategory: MediaType = visibleTypes.length > 0 ? toMediaType(visibleTypes[0]) : "movies";
  const [selectedCategory, setSelectedCategory] = useState<MediaType>(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam as MediaType)) return toMediaType(categoryParam);
    return defaultCategory;
  });

  useEffect(() => {
    if (!userId || RESERVED_PATHS.has(userId)) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetchPublic<PublicProfileResponse>(`/users/${userId}`),
      apiFetchPublic<{ data: Record<MediaType, number> }>(`/users/${userId}/logs/counts`),
    ])
      .then(([p, countsRes]) => {
        setProfile(p);
        setCounts(countsRes.data ?? null);
        if (p.visibleMediaTypes.length > 0) {
          const validFromUrl =
            categoryParam &&
            MEDIA_TYPES.includes(categoryParam as MediaType) &&
            p.visibleMediaTypes.includes(categoryParam);
          setSelectedCategory(
            validFromUrl ? toMediaType(categoryParam) : toMediaType(p.visibleMediaTypes[0])
          );
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load profile");
        setProfile(null);
        setCounts(null);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!token || !profile?.id || isOwnProfile) return;
    apiFetch<{ following: boolean }>(`/follows/status/${profile.id}`)
      .then((res) => setFollowing(res.following))
      .catch(() => {});
  }, [token, profile?.id, isOwnProfile]);

  useEffect(() => {
    if (!userId || !profile) return;
    apiFetchPublic<PublicMilestoneProgress>(`/users/${userId}/milestones/progress`)
      .then(setPublicMilestoneProgress)
      .catch(() => setPublicMilestoneProgress(null));
  }, [userId, profile?.id]);

  const handleFollowClick = useCallback(async () => {
    if (!profile?.id || followLoading) return;
    setFollowLoading(true);
    try {
      if (following) {
        await apiFetch(`/follows/${profile.id}`, { method: "DELETE" });
        setFollowing(false);
      } else {
        await apiFetch("/follows", {
          method: "POST",
          body: JSON.stringify({ userId: profile.id }),
        });
        setFollowing(true);
        toast.success(t("social.followSuccess"));
      }
    } catch (err) {
      showErrorToast(t, "E017", { originalError: err });
    } finally {
      setFollowLoading(false);
    }
  }, [profile?.id, following, followLoading, t]);

  useEffect(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam as MediaType)) setSelectedCategory(toMediaType(categoryParam));
    else if (!categoryParam && visibleTypes.length > 0) setSelectedCategory(toMediaType(visibleTypes[0]));
  }, [categoryParam, visibleTypes]);

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

  const VALID_SORTS: MediaLogsSort[] = [
    "dateAsc", "dateDesc", "gradeAsc", "gradeDesc",
    "matchesPlayedAsc", "matchesPlayedDesc", "timeToBeatAsc", "timeToBeatDesc",
  ];
  const searchParamsKey = searchParams.toString();
  const initialFilters = useMemo(() => {
    const params = new URLSearchParams(searchParamsKey);
    const statusParam = params.get("status") ?? "";
    const sortParamRaw = params.get("sort") ?? "dateDesc";
    const sortParam = VALID_SORTS.includes(sortParamRaw as MediaLogsSort) ? (sortParamRaw as MediaLogsSort) : "dateDesc";
    const qParam = params.get("q") ?? "";
    const ownQ = params.get("own") === "true";
    const wtbQ = params.get("wantToBuy") === "true";
    const genreParam = params.get("genre") ?? "";
    let collection: CollectionListFilter = "";
    if (ownQ) collection = "owned";
    else if (wtbQ) collection = "wantToBuy";
    if (!statusParam && sortParam === "dateDesc" && !qParam && !collection && !genreParam) return undefined;
    return {
      status: statusParam,
      sort: sortParam,
      search: qParam,
      collection,
      genre: genreParam,
    };
  }, [searchParamsKey]);

  const byType = Object.fromEntries(
    MEDIA_TYPES.map((type) => [type, counts?.[type] ?? 0])
  ) as Record<MediaType, number>;

  if (!userId || RESERVED_PATHS.has(userId)) {
    return <Navigate to="/" replace />;
  }

  if (loading && !profile) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        <PublicProfileSkeleton />
      </motion.div>
    );
  }

  if (error && !profile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <p className="font-medium text-[var(--color-lightest)]">{error}</p>
          <Link to="/" className="mt-4 inline-block text-sm text-[var(--color-light)] underline hover:no-underline">
            {t("nav.dashboard")}
          </Link>
        </Card>
      </motion.div>
    );
  }

  const title = profile?.username
    ? t("publicProfile.titleWithName", { name: profile.username })
    : t("publicProfile.title");

  const selectedBadges = profile?.selectedBadges ?? [];

  return (
    <>
      {/* Category strip right below the navbar, full-bleed, sticky at top of scroll area */}
      {visibleTypes.length > 0 && (
        <div className="sticky top-0 z-20 shrink-0 border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)]">
          <StickyCategoryStrip
            items={visibleTypes.map((type) => ({
              value: type,
              label: t(`nav.${type}`),
              count: byType[type as MediaType] ?? 0,
            }))}
            selectedValue={selectedCategory}
            onSelect={(v) => setCategory(v as MediaType)}
            mobileOnly={false}
            bare
            aria-label={t("dashboard.category")}
          />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden px-4 md:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div
            role="heading"
            aria-level={1}
            className="min-w-0 text-xl font-bold text-[var(--color-lightest)] sm:text-2xl"
          >
            <OverflowMarquee>{title}</OverflowMarquee>
          </div>
          {selectedBadges.length > 0 && (
            <div className="flex min-w-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => setPinnedHighlightsOpen((o) => !o)}
                aria-expanded={pinnedHighlightsOpen}
                aria-controls={pinnedHighlightsOpen ? "public-profile-pinned-highlights" : undefined}
                className="flex w-full max-w-full min-w-0 items-center justify-between gap-2 rounded-md py-1 text-left text-sm font-medium text-[var(--color-light)] transition-colors hover:text-[var(--color-lightest)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)]"
              >
                <span className="min-w-0 truncate">
                  {t("publicProfile.pinnedHighlights", { count: String(selectedBadges.length) })}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[var(--color-light)] transition-transform duration-200",
                    pinnedHighlightsOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {pinnedHighlightsOpen && (
                  <motion.div
                    id="public-profile-pinned-highlights"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center gap-2 pt-1" role="list">
                      {selectedBadges.map((b) => (
                        <span
                          key={b.id}
                          role="listitem"
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-dark)]/80 px-3 py-1 text-sm text-[var(--color-lightest)]"
                          title={b.name}
                        >
                          <span aria-hidden>{b.icon}</span>
                          <OverflowMarquee className="max-w-[140px]">{b.name}</OverflowMarquee>
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        {token && !isOwnProfile && (
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <Button
              type="button"
              variant={following ? "secondary" : "default"}
              size="sm"
              onClick={handleFollowClick}
              disabled={followLoading}
            >
              {followLoading ? t("common.saving") : following ? t("social.following") : t("social.follow")}
            </Button>
          </div>
        )}
      </div>

      {publicMilestoneProgress && visibleTypes.length > 0 && (() => {
        const hasAnyEarned = visibleTypes.some((type) => {
          const pm = publicMilestoneProgress.perMedium.find((p) => p.mediaType === type);
          return (pm?.reviews.earned.length ?? 0) > 0 || (pm?.logs.earned.length ?? 0) > 0;
        });
        if (!hasAnyEarned) return null;
        return (
          <section
            aria-label={t("dashboard.badgesSectionTitle")}
            className="flex min-w-0 flex-col gap-0 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]"
          >
            <button
              type="button"
              onClick={() => setMilestoneBadgesOpen((o) => !o)}
              aria-expanded={milestoneBadgesOpen}
              aria-controls={milestoneBadgesOpen ? "public-profile-milestone-badges" : undefined}
              className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)]"
            >
              <h2 className="min-w-0 flex-1 text-lg font-semibold text-[var(--color-lightest)]">
                <OverflowMarquee>{t("dashboard.badgesSectionTitle")}</OverflowMarquee>
              </h2>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-[var(--color-light)] transition-transform duration-200",
                  milestoneBadgesOpen && "rotate-180"
                )}
                aria-hidden
              />
            </button>
            <AnimatePresence initial={false}>
              {milestoneBadgesOpen && (
                <motion.div
                  id="public-profile-milestone-badges"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                  role="region"
                  aria-label={t("dashboard.badgesSectionTitle")}
                >
                  <div className="flex min-w-0 flex-wrap gap-4 pt-3">
                    {visibleTypes.map((type) => {
                      const pm = publicMilestoneProgress.perMedium.find((p) => p.mediaType === type);
                      const reviews = pm?.reviews ?? { current: 0, earned: [] };
                      const logs = pm?.logs ?? { current: 0, earned: [] };
                      const scope = reviews.earned.length > 0 ? reviews : logs;
                      const kind = scope === reviews ? "reviews" : "logs";
                      const categoryLabel = t(`nav.${type}`);
                      const displayName = profile?.username ?? profile?.id ?? "";
                      if (scope.earned.length === 0) return null;
                      const latest = scope.earned[scope.earned.length - 1]!;
                      const level = scope.earned.length;
                      return (
                        <div key={type} className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="shrink-0 text-xs text-[var(--color-light)]">{categoryLabel}:</span>
                          <LevelBadge
                            icon={MEDIA_BADGE_ICONS[type as MediaType]}
                            level={level}
                            title={latest.label}
                            popupDetail={{
                              user: displayName,
                              categoryLabel,
                              count: scope === reviews ? reviews.current : logs.current,
                              kind,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })()}

      {visibleTypes.length > 0 && (
        <section
          aria-label={t("dashboard.category")}
          className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]"
        >
          <MediaLogs
            mediaType={selectedCategory}
            embedded
            publicUserId={userId}
            initialFilters={initialFilters}
            initialFiltersSyncKey={searchParamsKey}
            onFiltersChange={(f) => {
              setSearchParams((prev) => {
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
                return next;
              }, { replace: true });
            }}
          />
        </section>
      )}
      </div>
    </>
  );
}
