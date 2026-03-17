import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchPublic } from "@/lib/api";
import { PublicProfileSkeleton } from "@/components/skeletons";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { MEDIA_TYPES, type MediaType, toMediaType } from "@dogument/shared";
import { MediaLogs, type MediaLogsSort, type CategoryMilestoneProgress } from "@/pages/MediaLogs";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";
import { LevelBadge } from "@/components/LevelBadge";
import { MEDIA_BADGE_ICONS } from "@/lib/mediaBadgeIcons";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";

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
  "about",
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
  const statusParam = searchParams.get("status") ?? "";
  const sortParamRaw = searchParams.get("sort") ?? "dateAsc";
  const sortParam = VALID_SORTS.includes(sortParamRaw as MediaLogsSort) ? (sortParamRaw as MediaLogsSort) : "dateAsc";
  const qParam = searchParams.get("q") ?? "";
  const ownParam = searchParams.get("own") === "true" ? "owned" : "";
  const initialFilters =
    statusParam || sortParam !== "dateAsc" || qParam || ownParam
      ? { status: statusParam, sort: sortParam, search: qParam, own: ownParam as "" | "owned" }
      : undefined;

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
          <h1 className="text-xl font-bold text-[var(--color-lightest)] sm:text-2xl">{title}</h1>
          {selectedBadges.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-label={t("settings.profileBadges")}>
              {selectedBadges.map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-dark)]/80 px-3 py-1 text-sm text-[var(--color-lightest)]"
                  title={b.name}
                >
                  <span aria-hidden>{b.icon}</span>
                  <span className="truncate max-w-[140px]">{b.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {token && !isOwnProfile && (
            <Button
              type="button"
              variant={following ? "secondary" : "default"}
              size="sm"
              onClick={handleFollowClick}
              disabled={followLoading}
            >
              {followLoading ? t("common.saving") : following ? t("social.following") : t("social.follow")}
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/">{t("publicProfile.backToApp")}</Link>
          </Button>
        </div>
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
            className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]"
          >
            <h2 className="text-lg font-semibold text-[var(--color-lightest)]">
              {t("dashboard.badgesSectionTitle")}
            </h2>
            <div className="flex min-w-0 flex-wrap gap-4">
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
                    <span className="shrink-0 text-sm text-[var(--color-light)]">{categoryLabel}:</span>
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
          />
        </section>
      )}
      </div>
    </>
  );
}
