import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Download, Eye, HelpCircle, Loader2, Search as SearchIcon, User2 as UserIcon, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsSkeleton } from "@/components/skeletons";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { apiFetch, invalidateApiCache, apiFetchFile, downloadFile } from "@/lib/api";
import { useAppPtrRefresh } from "@/hooks/useAppPtrRefresh";
import { buildLogsExportFilename, userSlugFromMe } from "@/lib/exportFilename";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/errorToast";
import { API_KEY_META, type ApiKeyProvider } from "@/lib/apiKeyMeta";
import { useLocale, LOCALE_OPTIONS, type Locale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { getShowCompleteModal, SHOW_COMPLETE_MODAL_STORAGE_KEY } from "@/contexts/LogCompleteContext";
import * as storage from "@/lib/storage";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import {
  DEFAULT_PROFILE_VISIBILITY,
  MEDIA_TYPES,
  type AnimeMangaTitleLanguage,
  type BoardGameProvider,
  type MediaType,
  type ProfileVisibility,
} from "@geeklogs/shared";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { cn } from "@/lib/utils";
import { tierHasProFeatures, tierHasUnlimitedLogs } from "@/lib/userTier";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BoardGameProviderSelector } from "@/components/BoardGameProviderSelector";
import { AnimeMangaTitleLanguageSelector } from "@/components/AnimeMangaTitleLanguageSelector";
import { MediaCategoryDragList } from "@/components/MediaCategoryDragList";
import { UserSettingsSection } from "@/components/UserSettingsSection";

type KeysStatus = { tmdb: boolean; rawg: boolean; bgg: boolean; ludopedia: boolean; comicvine: boolean };

const FREE_LOG_LIMIT = 500;

const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  "pt-BR": "PT",
  es: "ES",
};

function SettingsCollapsibleSection({
  title,
  open,
  onToggle,
  children,
  className,
  labelRight,
  hidden,
}: {
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  labelRight?: ReactNode;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-1.5",
        className
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1 px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-mid)]/10 focus:outline-none max-md:min-h-[44px]"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-light)] transition-transform" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-light)] transition-transform" aria-hidden />
        )}
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-light)]">
          {title}
        </span>
        {labelRight ? <span className="ml-auto shrink-0">{labelRight}</span> : null}
      </button>
      {open && <div className="mt-1 px-1 pb-1.5 pt-0.5">{children}</div>}
    </div>
  );
}

/** Option-A settings row: label left, control/value right, hover background. */
function SettingsRow({
  label,
  desc,
  right,
  onClick,
  className,
  disabled,
}: {
  label: ReactNode;
  desc?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-[var(--color-lightest)]">
        {label}
        {desc ? (
          <span className="mt-0.5 block text-[10px] font-normal leading-snug text-[var(--color-light)]">
            {desc}
          </span>
        ) : null}
      </span>
      {right != null ? <span className="shrink-0 pl-2">{right}</span> : null}
    </>
  );
  if (!onClick) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--color-mid)]/10",
          disabled && "pointer-events-none opacity-60",
          className
        )}
      >
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--color-mid)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] max-md:min-h-[44px]",
        className
      )}
    >
      {inner}
    </button>
  );
}

export function Settings() {
  const { t, locale, setLocale } = useLocale();
  const { token } = useAuth();
  const { me, refetch: refetchMe, loading } = useMe();
  const { setPageTitle } = usePageTitle() ?? {};
  useEffect(() => {
    setPageTitle?.(t("settings.title"));
    return () => setPageTitle?.(null);
  }, [t, setPageTitle]);
  const { refetch: refetchVisibleTypes } = useVisibleMediaTypes();
  const [status, setStatus] = useState<KeysStatus | null>(null);
  const [tmdb, setTmdb] = useState("");
  const [rawg, setRawg] = useState("");
  const [bgg, setBgg] = useState("");
  const [ludopedia, setLudopedia] = useState("");
  const [comicvine, setComicvine] = useState("");
  const [saving, setSaving] = useState<ApiKeyProvider | null>(null);
  const [savingMediaTypes, setSavingMediaTypes] = useState(false);
  const [savingBoardGameProvider, setSavingBoardGameProvider] = useState(false);
  const [savingAnimeMangaTitleLanguage, setSavingAnimeMangaTitleLanguage] = useState(false);
  const [selectedMediaTypes, setSelectedMediaTypes] = useState<Set<MediaType>>(new Set(MEDIA_TYPES));
  /** Order of categories: visible types first (this order), then hidden. Determines order on home and search. */
  const [orderedMediaTypes, setOrderedMediaTypes] = useState<MediaType[]>(() => [...MEDIA_TYPES]);
  const [searchParams] = useSearchParams();
  const [profileEditorOpen, setProfileEditorOpen] = useState(() => searchParams.get("tab") === "user");
  const [generalOpen, setGeneralOpen] = useState(true);
  const [profileVisibilityOpen, setProfileVisibilityOpen] = useState(true);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(() => searchParams.get("open") === "api-keys");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<
    { id: string; email: string; username: string | null; loginCount: number; logsCount: number; lastLoginAt: string | null; createdAt: string }[]
  >([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);
  const [adminFeatureFlags, setAdminFeatureFlags] = useState<
    { key: string; enabled: boolean; updatedAt: string }[]
  >([]);
  const [adminFeatureFlagsLoading, setAdminFeatureFlagsLoading] = useState(false);
  const [adminFeatureFlagsError, setAdminFeatureFlagsError] = useState<string | null>(null);
  const [adminFlagSavingKey, setAdminFlagSavingKey] = useState<string | null>(null);
  const [digestSending, setDigestSending] = useState(false);
  const [recapSaving, setRecapSaving] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>(
    () => ({ ...DEFAULT_PROFILE_VISIBILITY })
  );
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSelectedCategories, setExportSelectedCategories] = useState<Set<MediaType>>(() => new Set(MEDIA_TYPES));
  const [showCompleteModal, setShowCompleteModal] = useState(() => getShowCompleteModal());
  const exportOpenSnapshotRef = useRef<Set<MediaType>>(new Set());
  const prevExportModalOpenRef = useRef(false);
  const isMobile = useIsMobile();
  const [settingsSearch, setSettingsSearch] = useState("");
  const [searchReadOnly, setSearchReadOnly] = useState(true);

  const settingsSearchMatches = useCallback(
    (...terms: (string | undefined | null)[]) => {
      const q = settingsSearch.trim().toLowerCase();
      if (!q) return true;
      return terms.some((term) => term?.toLowerCase().includes(q));
    },
    [settingsSearch]
  );

  useEffect(() => {
    if (exportModalOpen && !prevExportModalOpenRef.current) {
      exportOpenSnapshotRef.current = new Set(exportSelectedCategories);
    }
    prevExportModalOpenRef.current = exportModalOpen;
  }, [exportModalOpen, exportSelectedCategories]);

  useEffect(() => {
    if (searchParams.get("open") === "api-keys") {
      setAdvancedOpen(true);
      setSettingsSearch("");
    }
    if (searchParams.get("tab") === "user") setProfileEditorOpen(true);
  }, [searchParams]);

  const generalSectionVisible = settingsSearchMatches(
    t("settings.general"),
    t("settings.subscription"),
    t("settings.language"),
    t("nav.theme"),
    t("settings.recapEmailsTitle"),
    t("settings.showCompleteModal")
  );
  const profileVisibilitySectionVisible = settingsSearchMatches(
    t("settings.profileVisibilityTitle"),
    t("settings.profileVisibilityShowPublicProfile"),
    t("settings.profileVisibilityShowLogCount"),
    t("settings.profileVisibilityShowReviews")
  );
  const navigationSectionVisible = settingsSearchMatches(
    t("settings.appNavigationTitle"),
    t("settings.boardGameProviderLabel"),
    t("settings.animeMangaTitleLanguageLabel")
  );
  const exportSectionVisible = settingsSearchMatches(
    t("tiers.exportLogs"),
    t("settings.exportModalTitle")
  );
  const apiKeysSectionVisible = settingsSearchMatches(
    t("settings.apiKeys"),
    t("settings.apiKeysIntro"),
    "tmdb",
    "rawg",
    "bgg",
    "ludopedia",
    "comicvine"
  );
  const adminSectionVisible =
    me?.tier === "admin" &&
    settingsSearchMatches(
      t("settings.adminSection"),
      t("settings.adminUsersTitle"),
      t("settings.adminFeatureFlagsTitle")
    );
  const noAppResults =
    settingsSearch.trim() !== "" &&
    !generalSectionVisible &&
    !profileVisibilitySectionVisible &&
    !navigationSectionVisible &&
    !exportSectionVisible &&
    !apiKeysSectionVisible &&
    !adminSectionVisible;

  useEffect(() => {
    if (me?.tier !== "admin" || !adminOpen) return;
    setAdminUsersLoading(true);
    setAdminUsersError(null);
    setAdminFeatureFlagsLoading(true);
    setAdminFeatureFlagsError(null);
    void Promise.all([
      apiFetch<{ data: typeof adminUsers }>("/admin/users")
        .then((res) => setAdminUsers(res.data ?? []))
        .catch((err) =>
          setAdminUsersError(err instanceof Error ? err.message : t("settings.adminUsersError"))
        ),
      apiFetch<{ data: typeof adminFeatureFlags }>("/admin/feature-flags")
        .then((res) => setAdminFeatureFlags(res.data ?? []))
        .catch((err) =>
          setAdminFeatureFlagsError(
            err instanceof Error ? err.message : t("settings.adminFeatureFlagsError")
          )
        ),
    ]).finally(() => {
      setAdminUsersLoading(false);
      setAdminFeatureFlagsLoading(false);
    });
  }, [me?.tier, adminOpen, t]);

  const handleSendMonthlyDigest = async () => {
    setDigestSending(true);
    try {
      const res = await apiFetch<{
        data: { sent: boolean; period: { monthLabel: string }; to: string; statsUserId: string };
      }>("/admin/monthly-digest/send", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res.data.sent) {
        toast.success(t("settings.adminDigestSent", { month: res.data.period.monthLabel }));
      } else {
        toast.error(t("settings.adminDigestFailed"));
      }
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setDigestSending(false);
    }
  };

  const handleToggleAdminFeatureFlag = async (flagKey: string, enabled: boolean) => {
    setAdminFlagSavingKey(flagKey);
    try {
      await apiFetch(`/admin/feature-flags/${encodeURIComponent(flagKey)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      setAdminFeatureFlags((prev) =>
        prev.map((f) => (f.key === flagKey ? { ...f, enabled } : f))
      );
      invalidateApiCache("/search");
      await refetchMe();
      toast.success(t("settings.adminFeatureFlagUpdated"));
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setAdminFlagSavingKey(null);
    }
  };

  useEffect(() => {
    if (me?.apiKeys) {
      setStatus({
        tmdb: me.apiKeys.tmdb,
        rawg: me.apiKeys.rawg,
        bgg: me.apiKeys.bgg,
        ludopedia: me.apiKeys.ludopedia,
        comicvine: me.apiKeys.comicvine,
      });
    }
  }, [me?.apiKeys]);

  useEffect(() => {
    if (me?.visibleMediaTypes?.length) {
      const visible = me.visibleMediaTypes as MediaType[];
      setSelectedMediaTypes(new Set(visible));
      const rest = MEDIA_TYPES.filter((t) => !visible.includes(t));
      setOrderedMediaTypes([...visible, ...rest]);
    }
  }, [me?.visibleMediaTypes]);

  useEffect(() => {
    if (me?.profileVisibility) {
      setProfileVisibility(me.profileVisibility);
    }
  }, [me?.profileVisibility]);

  useAppPtrRefresh(() => {
    invalidateApiCache("/me");
    void refetchMe();
    void refetchVisibleTypes();
  });

  const handleProfileVisibilityChange = async (
    key: keyof ProfileVisibility,
    value: boolean
  ) => {
    if (!token) return;
    const prev = profileVisibility;
    const next = { ...prev, [key]: value };
    setProfileVisibility(next);
    setVisibilitySaving(true);
    try {
      await apiFetch<ProfileVisibility>("/settings/profile-visibility", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      await refetchMe();
      toast.success(t("settings.profileVisibilitySaved"));
    } catch (err) {
      setProfileVisibility(prev);
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setVisibilitySaving(false);
    }
  };

  const handleSave = async (provider: ApiKeyProvider) => {
    const value =
      provider === "tmdb"
        ? tmdb.trim()
        : provider === "rawg"
          ? rawg.trim()
          : provider === "bgg"
            ? bgg.trim()
            : provider === "ludopedia"
              ? ludopedia.trim()
              : comicvine.trim();
    if (!value) {
      showErrorToast(t, "E007");
      return;
    }
    setSaving(provider);
    try {
      const body: Record<string, string> = {};
      if (provider === "tmdb") body.tmdb = value;
      else if (provider === "rawg") body.rawg = value;
      else if (provider === "bgg") body.bgg = value;
      else if (provider === "ludopedia") body.ludopedia = value;
      else body.comicvine = value;
      await apiFetch("/settings/api-keys", { method: "PUT", body: JSON.stringify(body) });
      if (provider === "bgg" || provider === "ludopedia") {
        await apiFetch("/settings/board-game-provider", {
          method: "PUT",
          body: JSON.stringify({ provider }),
        });
      }
      invalidateApiCache("/search");
      await refetchMe();
      setStatus((prev) =>
        prev ? { ...prev, [provider]: true } : { tmdb: false, rawg: false, bgg: false, ludopedia: false, comicvine: false }
      );
      if (provider === "tmdb") setTmdb("");
      if (provider === "rawg") setRawg("");
      if (provider === "bgg") setBgg("");
      if (provider === "ludopedia") setLudopedia("");
      if (provider === "comicvine") setComicvine("");
      toast.success(t("toast.keySaved", { name: API_KEY_META[provider].name }));
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setSaving(null);
    }
  };

  const handleBoardGameProviderChange = async (provider: BoardGameProvider) => {
    if (me?.boardGameProvider === provider) return;
    setSavingBoardGameProvider(true);
    try {
      await apiFetch("/settings/board-game-provider", {
        method: "PUT",
        body: JSON.stringify({ provider }),
      });
      await refetchMe();
      invalidateApiCache("/search");
      toast.success(t("settings.boardGameProviderSaved"));
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setSavingBoardGameProvider(false);
    }
  };

  const handleAnimeMangaTitleLanguageChange = async (language: AnimeMangaTitleLanguage) => {
    if ((me?.animeMangaTitleLanguage ?? "original") === language) return;
    setSavingAnimeMangaTitleLanguage(true);
    try {
      await apiFetch("/settings/anime-manga-title-language", {
        method: "PUT",
        body: JSON.stringify({ language }),
      });
      await refetchMe();
      invalidateApiCache("/search");
      invalidateApiCache("/items");
      toast.success(t("settings.animeMangaTitleLanguageSaved"));
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setSavingAnimeMangaTitleLanguage(false);
    }
  };

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    if (token) {
      apiFetch("/settings/locale", {
        method: "PUT",
        body: JSON.stringify({ locale: newLocale }),
      }).catch(() => {});
    }
  };

  const recapEmailsEnabled = me?.recapEmailsEnabled !== false;

  const handleRecapEmailsChange = async (enabled: boolean) => {
    if (!token) return;
    setRecapSaving(true);
    try {
      await apiFetch("/settings/recap-emails", {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      await refetchMe();
      toast.success(t("settings.recapEmailsSaved"));
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setRecapSaving(false);
    }
  };

  const saveVisibleMediaTypes = async (types: MediaType[]) => {
    if (types.length === 0) return;
    setSavingMediaTypes(true);
    try {
      await apiFetch("/settings/visible-media-types", {
        method: "PUT",
        body: JSON.stringify({ types }),
      });
      await refetchVisibleTypes();
      toast.success(t("toast.mediaTypesSaved"));
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setSavingMediaTypes(false);
    }
  };

  const handleToggleMediaType = async (type: MediaType) => {
    const next = new Set(selectedMediaTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    const typesArray = orderedMediaTypes.filter((t) => next.has(t));
    if (typesArray.length === 0) return;
    setSelectedMediaTypes(next);
    await saveVisibleMediaTypes(typesArray);
  };

  const handleExportDownload = useCallback(
    async (onClose?: () => void): Promise<boolean> => {
      const selected = Array.from(exportSelectedCategories);
      if (selected.length === 0) {
        showErrorToast(t, "E009");
        return false;
      }
      setExporting(true);
      try {
        const userSlug = userSlugFromMe(me);
        for (let i = 0; i < selected.length; i++) {
          const mt = selected[i];
          const { blob } = await apiFetchFile(`/logs/export?mediaType=${encodeURIComponent(mt)}`);
          const filename = buildLogsExportFilename({
            page: "settings",
            userSlug,
            categoryKey: mt,
          });
          await downloadFile(blob, filename);
          if (i < selected.length - 1) await new Promise((r) => setTimeout(r, 300));
        }
        toast.success(t("tiers.exportSuccess"));
        onClose?.();
        return true;
      } catch (err) {
        showErrorToast(t, "E010", { originalError: err });
        return false;
      } finally {
        setExporting(false);
      }
    },
    [exportSelectedCategories, me, t]
  );

  const exportDrawerBeforeDismiss = useCallback(async (): Promise<boolean> => {
    const snap = exportOpenSnapshotRef.current;
    const cur = exportSelectedCategories;
    const dirty = snap.size !== cur.size || [...snap].some((x) => !cur.has(x));
    if (!dirty) return true;
    if (cur.size === 0) return true;
    return handleExportDownload();
  }, [exportSelectedCategories, handleExportDownload]);

  const closeExportModal = useCallback(() => setExportModalOpen(false), []);

  const exportModalContent = useCallback(
    () => (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="min-w-0">
            <OverflowMarquee>{t("settings.exportModalTitle")}</OverflowMarquee>
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-light)]">{t("settings.exportModalDesc")}</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              className="text-[var(--color-accent)] underline hover:no-underline"
              onClick={() => setExportSelectedCategories(new Set(MEDIA_TYPES))}
            >
              {t("settings.exportSelectAll")}
            </button>
            <span className="text-[var(--color-mid)]">·</span>
            <button
              type="button"
              className="text-[var(--color-accent)] underline hover:no-underline"
              onClick={() => setExportSelectedCategories(new Set())}
            >
              {t("settings.exportDeselectAll")}
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto rounded border border-[var(--color-mid)]/30 p-2">
            {MEDIA_TYPES.map((mt) => (
              <label
                key={mt}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-[var(--color-mid)]/10",
                  exportSelectedCategories.has(mt) && "bg-[var(--color-mid)]/10"
                )}
              >
                <input
                  type="checkbox"
                  checked={exportSelectedCategories.has(mt)}
                  onChange={(e) => {
                    const next = new Set(exportSelectedCategories);
                    if (e.target.checked) next.add(mt);
                    else next.delete(mt);
                    setExportSelectedCategories(next);
                  }}
                  className="h-4 w-4 rounded border-[var(--color-mid)]"
                  aria-label={t(`nav.${mt}`)}
                />
                <span className="text-sm text-[var(--color-lightest)]">{t(`nav.${mt}`)}</span>
              </label>
            ))}
          </div>
        </div>
        <Button
          type="button"
          className="gap-2 w-full sm:w-auto"
          disabled={exporting || exportSelectedCategories.size === 0}
          onClick={() => void handleExportDownload(closeExportModal)}
        >
          <Download className="h-4 w-4" aria-hidden />
          {exporting ? t("common.saving") : t("settings.exportDownload")}
        </Button>
      </div>
    ),
    [t, exporting, exportSelectedCategories, handleExportDownload, closeExportModal]
  );

  if (loading && !me) {
    return <SettingsSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="flex flex-col gap-8">
        {me && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--btn-gradient-start)] text-lg font-black text-white">
                {(me.user.username?.[0] ?? me.user.email[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--color-lightest)]">
                  {me.user.username ? `@${me.user.username}` : me.user.email}
                </p>
                <p className="text-[11px] text-[var(--color-light)]">
                  {me.tier === "pro" ? (
                    me.daysRemaining != null ? (
                      <>
                        {t("tiers.pro")} ·{" "}
                        {me.daysRemaining === 1
                          ? t("settings.subscriptionDaysLeftOne")
                          : t("settings.subscriptionDaysLeft", { count: String(me.daysRemaining) })}
                      </>
                    ) : (
                      t("tiers.pro")
                    )
                  ) : me.tier === "admin" ? (
                    t("tiers.admin")
                  ) : me.tier === "beta" ? (
                    t("tiers.beta")
                  ) : (
                    t("tiers.free")
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileEditorOpen((prev) => !prev)}
                aria-expanded={profileEditorOpen}
                className="shrink-0 rounded-lg border border-[var(--color-mid)]/40 px-2.5 py-1 text-[10px] font-semibold text-[var(--color-light)] transition-colors hover:bg-[var(--color-mid)]/10"
              >
                {profileEditorOpen ? t("common.close") : t("settings.editProfileLabel")}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {profileEditorOpen && (
                <motion.div
                  key="profile-editor"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-4">
                    <UserSettingsSection />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="rounded-xl bg-[var(--btn-gradient-start)]/10 p-3">
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-semibold text-[var(--color-lightest)]">{t("settings.usageTitle")}</span>
                {tierHasUnlimitedLogs(me.tier) ? (
                  <span className="truncate text-[var(--color-light)]">
                    {t("tiers.usageUnlimited", { count: String(me.logCount ?? 0) })}
                  </span>
                ) : (
                  <span className="truncate text-[var(--color-light)]">
                    {t("tiers.usage", {
                      count: String(me.logCount ?? 0),
                      limit: String(FREE_LOG_LIMIT),
                    })}
                  </span>
                )}
              </div>
              {!tierHasUnlimitedLogs(me.tier) && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-mid)]/30">
                  <div
                    className="h-full rounded-full bg-[var(--btn-gradient-start)]"
                    style={{
                      width: `${Math.min(100, Math.max(2, ((me.logCount ?? 0) / FREE_LOG_LIMIT) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setProfileEditorOpen(true)}
                className="flex flex-col gap-1 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3 text-left transition-colors hover:bg-[var(--color-mid)]/10"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
                  <UserIcon className="size-3.5" aria-hidden />
                </span>
                <span className="text-xs font-bold text-[var(--color-lightest)]">{t("settings.quickProfile")}</span>
                <span className="truncate text-[10px] text-[var(--color-light)]">{t("settings.quickProfileDesc")}</span>
              </button>
              <button
                type="button"
                onClick={() => setProfileVisibilityOpen(true)}
                className="flex flex-col gap-1 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3 text-left transition-colors hover:bg-[var(--color-mid)]/10"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
                  <Eye className="size-3.5" aria-hidden />
                </span>
                <span className="text-xs font-bold text-[var(--color-lightest)]">{t("settings.quickPrivacy")}</span>
                <span className="truncate text-[10px] text-[var(--color-light)]">{t("settings.quickPrivacyDesc")}</span>
              </button>
              <Link
                to="/tiers"
                className="flex flex-col gap-1 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3 text-left transition-colors hover:bg-[var(--color-mid)]/10"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
                  <Zap className="size-3.5" aria-hidden />
                </span>
                <span className="text-xs font-bold text-[var(--color-lightest)]">{t("settings.quickPlan")}</span>
                <span className="truncate text-[10px] text-[var(--color-light)]">{t("settings.quickPlanDesc")}</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (tierHasProFeatures(me.tier)) setExportModalOpen(true);
                  else setExportOpen(true);
                }}
                className="flex flex-col gap-1 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3 text-left transition-colors hover:bg-[var(--color-mid)]/10"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
                  <Download className="size-3.5" aria-hidden />
                </span>
                <span className="text-xs font-bold text-[var(--color-lightest)]">{t("tiers.exportLogs")}</span>
                <span className="truncate text-[10px] text-[var(--color-light)]">{t("settings.exportModalDesc")}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5">
              <SearchIcon className="size-4 shrink-0 text-[var(--color-light)]" aria-hidden />
              <input
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
                placeholder={t("settings.searchPlaceholder")}
                type="search"
                name="settings_search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                readOnly={searchReadOnly}
                onFocus={() => setSearchReadOnly(false)}
                onPointerDown={() => setSearchReadOnly(false)}
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                data-ddg-inputtype="unrecognized"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-lightest)] outline-none placeholder:text-[var(--color-light)] [&::-webkit-search-cancel-button]:hidden"
                aria-label={t("settings.searchPlaceholder")}
              />
              {settingsSearch && (
                <button
                  type="button"
                  onClick={() => setSettingsSearch("")}
                  className="shrink-0 rounded p-1 text-[var(--color-light)] transition-colors hover:text-[var(--color-lightest)]"
                  aria-label={t("settings.searchClear")}
                >
                  <ChevronRight className="size-4 rotate-90" aria-hidden />
                </button>
              )}
            </div>
          </div>
        )}

        <>
        <SettingsCollapsibleSection
          title={t("settings.general")}
          open={generalOpen}
          onToggle={() => setGeneralOpen((prev) => !prev)}
          hidden={!generalSectionVisible}
        >
          <div className="flex flex-col gap-0.5">
            <SettingsRow
              label={t("settings.subscription")}
              desc={
                me
                  ? me.tier === "pro"
                    ? me.daysRemaining != null
                      ? me.daysRemaining === 1
                        ? t("settings.subscriptionDaysLeftOne")
                        : t("settings.subscriptionDaysLeft", { count: String(me.daysRemaining) })
                      : t("tiers.manageSubscription")
                    : me.tier === "admin"
                      ? t("tiers.admin")
                      : me.tier === "beta"
                        ? t("settings.subscriptionBeta")
                        : t("settings.viewPlans")
                  : undefined
              }
              right={
                me ? (
                  <Link
                    to="/tiers"
                    className="text-[10px] font-semibold text-[var(--btn-gradient-start)] hover:underline"
                  >
                    {me.tier === "pro" && me.daysRemaining == null
                      ? t("tiers.manageSubscription")
                      : me.tier === "beta"
                        ? t("settings.viewPlans")
                        : me.tier === "admin"
                          ? t("tiers.admin")
                          : t("settings.viewPlans")}
                  </Link>
                ) : undefined
              }
            />
            <SettingsRow
              label={t("settings.language")}
              right={
                <ToggleGroup
                  type="single"
                  value={locale}
                  onValueChange={(v) => v && handleLocaleChange(v as Locale)}
                  className="inline-flex rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-0.5 gap-0"
                  aria-label={t("settings.language")}
                >
                  {LOCALE_OPTIONS.map((opt) => (
                    <ToggleGroupItem
                      key={opt.value}
                      value={opt.value}
                      className="h-7 px-3 text-xs font-medium data-[state=on]:bg-[var(--color-mid)]/50 data-[state=on]:text-[var(--color-lightest)] rounded-md"
                      aria-label={opt.label}
                    >
                      {LOCALE_SHORT_LABELS[opt.value]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              }
            />
            <SettingsRow
              label={t("nav.theme")}
              right={<ThemeSwitcher />}
            />
            <SettingsRow
              label={t("settings.recapEmailsTitle")}
              right={
                <Switch
                  checked={recapEmailsEnabled}
                  disabled={recapSaving || !me}
                  onCheckedChange={(v) => void handleRecapEmailsChange(v)}
                  aria-label={t("settings.recapEmailsTitle")}
                />
              }
            />
            <SettingsRow
              label={t("settings.showCompleteModal")}
              right={
                <Switch
                  checked={showCompleteModal}
                  onCheckedChange={(checked) => {
                    setShowCompleteModal(checked);
                    void storage.setItem(SHOW_COMPLETE_MODAL_STORAGE_KEY, checked ? "true" : "false");
                  }}
                  aria-label={t("settings.showCompleteModal")}
                />
              }
            />
          </div>
        </SettingsCollapsibleSection>

        <SettingsCollapsibleSection
          title={t("settings.profileVisibilityTitle")}
          open={profileVisibilityOpen}
          onToggle={() => setProfileVisibilityOpen((prev) => !prev)}
          hidden={!profileVisibilitySectionVisible}
        >
          <div className="flex flex-col gap-0.5">
            {me?.user.username ? (
              <SettingsRow
                label={t("settings.profileVisibilityViewProfile")}
                right={<ChevronRight className="h-3.5 w-3.5 text-[var(--color-light)]" aria-hidden />}
                onClick={() => {
                  window.location.href = `/${me.user.username}`;
                }}
              />
            ) : null}
            <p className="px-2 pb-0.5 pt-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-light)]">
              {t("settings.profileVisibilitySectionProfile")}
            </p>
            {(
              [
                ["showPublicProfile", "settings.profileVisibilityShowPublicProfile"],
                ["showLogCount", "settings.profileVisibilityShowLogCount"],
                ["showPinnedBadges", "settings.profileVisibilityShowPinnedBadges"],
                ["showMilestoneBadges", "settings.profileVisibilityShowMilestoneBadges"],
              ] as const
            ).map(([key, labelKey]) => (
              <SettingsRow
                key={key}
                label={t(labelKey)}
                right={
                  <Switch
                    checked={profileVisibility[key]}
                    disabled={visibilitySaving || !me}
                    onCheckedChange={(v) => void handleProfileVisibilityChange(key, v)}
                    aria-label={t(labelKey)}
                  />
                }
              />
            ))}
            <p className="px-2 pb-0.5 pt-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-light)]">
              {t("settings.profileVisibilitySectionMarket")}
            </p>
            {(
              [["showMarketListings", "settings.profileVisibilityShowMarketListings"]] as const
            ).map(([key, labelKey]) => (
              <SettingsRow
                key={key}
                label={t(labelKey)}
                disabled={!profileVisibility.showPublicProfile}
                right={
                  <Switch
                    checked={profileVisibility[key]}
                    disabled={visibilitySaving || !me || !profileVisibility.showPublicProfile}
                    onCheckedChange={(v) => void handleProfileVisibilityChange(key, v)}
                    aria-label={t(labelKey)}
                  />
                }
              />
            ))}
            <p className="px-2 pb-0.5 pt-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-light)]">
              {t("settings.profileVisibilitySectionBoardGames")}
            </p>
            {(
              [
                [
                  "showTaggedBoardGameMatches",
                  "settings.profileVisibilityShowTaggedBoardGameMatches",
                ],
              ] as const
            ).map(([key, labelKey]) => (
              <SettingsRow
                key={key}
                label={t(labelKey)}
                disabled={!profileVisibility.showPublicProfile}
                right={
                  <Switch
                    checked={profileVisibility[key]}
                    disabled={
                      visibilitySaving || !me || !profileVisibility.showPublicProfile
                    }
                    onCheckedChange={(v) => void handleProfileVisibilityChange(key, v)}
                    aria-label={t(labelKey)}
                  />
                }
              />
            ))}
            <p className="px-2 pb-0.5 pt-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-light)]">
              {t("settings.profileVisibilitySectionLogs")}
            </p>
            {(
              [
                ["showStatus", "settings.profileVisibilityShowStatus"],
                ["showRatings", "settings.profileVisibilityShowRatings"],
                ["showReviews", "settings.profileVisibilityShowReviews"],
                ["showGenres", "settings.profileVisibilityShowGenres"],
                ["showApiScores", "settings.profileVisibilityShowApiScores"],
                ["showProgress", "settings.profileVisibilityShowProgress"],
                ["showCompletionTime", "settings.profileVisibilityShowCompletionTime"],
                ["showCollectionTags", "settings.profileVisibilityShowCollectionTags"],
                ["showTvMetadata", "settings.profileVisibilityShowTvMetadata"],
                ["showEnrichmentDetails", "settings.profileVisibilityShowEnrichmentDetails"],
              ] as const
            ).map(([key, labelKey]) => (
              <SettingsRow
                key={key}
                label={t(labelKey)}
                disabled={!profileVisibility.showPublicProfile}
                right={
                  <Switch
                    checked={profileVisibility[key]}
                    disabled={
                      visibilitySaving || !me || !profileVisibility.showPublicProfile
                    }
                    onCheckedChange={(v) => void handleProfileVisibilityChange(key, v)}
                    aria-label={t(labelKey)}
                  />
                }
              />
            ))}
          </div>
        </SettingsCollapsibleSection>

        <SettingsCollapsibleSection
          title={t("settings.appNavigationTitle")}
          open={navigationOpen}
          onToggle={() => setNavigationOpen((prev) => !prev)}
          hidden={!navigationSectionVisible}
        >
          <div className="flex flex-col gap-0.5">
            {me && tierHasProFeatures(me.tier) ? (
              <MediaCategoryDragList
                  order={orderedMediaTypes}
                  onReorder={(next) => {
                    setOrderedMediaTypes(next);
                    const typesToSave = next.filter((t) => selectedMediaTypes.has(t));
                    if (typesToSave.length > 0) void saveVisibleMediaTypes(typesToSave);
                  }}
                  selected={selectedMediaTypes}
                  onToggle={handleToggleMediaType}
                  disabled={savingMediaTypes}
                  isPending={savingMediaTypes}
                  pendingLabel={t("settings.saving")}
                  labelForType={(type) => t(`nav.${type}`)}
                  gripAriaLabel={t("settings.dragToReorder")}
                  listAriaLabel={t("settings.visibleMediaTypesLabel")}
                />
            ) : (
              <SettingsRow
                label={t("settings.appNavigationProOnlyIntro")}
                right={
                  <Button variant="outline" className="h-7 px-3 text-xs" asChild>
                    <Link to="/tiers">{t("settings.publicProfileUpgrade")}</Link>
                  </Button>
                }
              />
            )}

            <div
              className={cn(
                "flex flex-col gap-0.5",
                savingBoardGameProvider && "pointer-events-none opacity-60"
              )}
              aria-busy={savingBoardGameProvider}
            >
              <SettingsRow
                label={t("settings.boardGameProviderLabel")}
                right={
                  <BoardGameProviderSelector
                    value={me?.boardGameProvider ?? "bgg"}
                    onValueChange={(next) => void handleBoardGameProviderChange(next)}
                    disabled={savingBoardGameProvider}
                  />
                }
              />
            </div>

            <div
              className={cn(
                "flex flex-col gap-0.5",
                savingAnimeMangaTitleLanguage && "pointer-events-none opacity-60"
              )}
              aria-busy={savingAnimeMangaTitleLanguage}
            >
              <SettingsRow
                label={t("settings.animeMangaTitleLanguageLabel")}
                right={
                  <AnimeMangaTitleLanguageSelector
                    value={me?.animeMangaTitleLanguage ?? "original"}
                    onValueChange={(next) => void handleAnimeMangaTitleLanguageChange(next)}
                    disabled={savingAnimeMangaTitleLanguage}
                  />
                }
              />
            </div>
          </div>
        </SettingsCollapsibleSection>

        {me && (
          <SettingsCollapsibleSection
            title={t("tiers.exportLogs")}
            open={exportOpen}
            onToggle={() => setExportOpen((prev) => !prev)}
            hidden={!exportSectionVisible}
            className={!tierHasProFeatures(me.tier) ? "opacity-75" : undefined}
          >
            <div className="flex flex-col gap-0.5">
              <SettingsRow
                label={t("settings.exportModalTitle")}
                right={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 gap-1.5 px-3 text-xs"
                    onClick={() => {
                      if (tierHasProFeatures(me.tier)) setExportModalOpen(true);
                    }}
                    asChild={!tierHasProFeatures(me.tier)}
                  >
                    {tierHasProFeatures(me.tier) ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        {t("tiers.exportLogs")}
                      </span>
                    ) : (
                      <Link to="/tiers" className="inline-flex items-center gap-1.5">
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        {t("tiers.exportLogs")}
                      </Link>
                    )}
                  </Button>
                }
              />
            </div>
          </SettingsCollapsibleSection>
        )}

        {me && tierHasProFeatures(me.tier) && (
          <>
            {isMobile ? (
              <Drawer open={exportModalOpen} onOpenChange={(open) => !open && setExportModalOpen(false)}>
                <DrawerContent
                  onClose={() => setExportModalOpen(false)}
                  onBeforeDismiss={exportDrawerBeforeDismiss}
                  mobileHeight="95%"
                  className="flex flex-col gap-4 p-6"
                >
                  {exportModalContent()}
                </DrawerContent>
              </Drawer>
            ) : (
              <Dialog open={exportModalOpen} onOpenChange={(open) => !open && setExportModalOpen(false)}>
                <DialogContent onClose={() => setExportModalOpen(false)} className="flex flex-col gap-4 px-6 py-6 sm:max-w-md">
                  {exportModalContent()}
                </DialogContent>
              </Dialog>
            )}
          </>
        )}

        <SettingsCollapsibleSection
          title={t("settings.apiKeys")}
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((prev) => !prev)}
          hidden={!apiKeysSectionVisible}
        >
          <div>
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-[var(--color-darkest)]/40 px-2 py-2">
                <div className="flex-1 space-y-0.5">
                  <p className="text-[11px] text-[var(--color-light)]">
                    {t("settings.apiKeysIntro")}
                  </p>
                  <p className="text-[10px] text-[var(--color-light)]">
                    {t("settings.apiKeyTutorialIntro")}
                  </p>
                </div>
                <a
                  href="mailto:felipe.cunha@geeklogs.com.br"
                  className="shrink-0 rounded p-1 text-[var(--color-light)] transition-colors hover:text-[var(--color-lightest)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)]"
                  aria-label={t("settings.apiKeysSupport")}
                  title={t("settings.apiKeysSupport")}
                >
                  <HelpCircle className="h-4 w-4" aria-hidden />
                </a>
              </div>
              <div className="flex flex-col gap-4">
                {(Object.keys(API_KEY_META) as ApiKeyProvider[]).map((provider) => {
                  const meta = API_KEY_META[provider];
                  const isSet = status?.[provider];
                  const isBoardGameApiKey = provider === "bgg" || provider === "ludopedia";
                  const isBoardGameKeySaving = isBoardGameApiKey && saving === provider;
                  const value =
                    provider === "tmdb"
                      ? tmdb
                      : provider === "rawg"
                        ? rawg
                        : provider === "bgg"
                          ? bgg
                          : provider === "ludopedia"
                            ? ludopedia
                            : comicvine;
                  const setValue =
                    provider === "tmdb"
                      ? setTmdb
                      : provider === "rawg"
                        ? setRawg
                        : provider === "bgg"
                          ? setBgg
                          : provider === "ludopedia"
                            ? setLudopedia
                            : setComicvine;
                  return (
                    <Card
                      key={provider}
                      className={cn(
                        "rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3",
                        isBoardGameApiKey && "relative overflow-hidden",
                      )}
                    >
                      <div
                        className={cn("flex flex-col gap-2.5", isBoardGameKeySaving && "pointer-events-none opacity-60")}
                        aria-busy={isBoardGameKeySaving}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="min-w-0 flex-1 text-sm font-semibold text-[var(--color-lightest)]">
                            <OverflowMarquee>{meta.name}</OverflowMarquee>
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            {provider === "bgg" && (
                              <span className="rounded border border-[var(--color-mid)]/50 bg-[var(--color-darkest)]/80 px-2 py-0.5 text-[10px] text-[var(--color-light)]">
                                {t("settings.bggApprovalBadge")}
                              </span>
                            )}
                            {isSet && (
                              <span className="rounded bg-[var(--color-darkest)] px-2 py-0.5 text-[10px] text-[var(--color-light)]">
                                {t("settings.keySaved")}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-[11px] text-[var(--color-light)]">
                          {t(`settings.apiKeyTutorial.${provider}`)}
                        </p>
                        <a
                          href={meta.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-fit text-[11px] text-[var(--color-light)] underline hover:text-[var(--color-lightest)]"
                        >
                          {t("settings.getApiKey")}
                        </a>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-medium text-[var(--color-light)]">{t("settings.apiKeyLabel")}</Label>
                          <Input
                            type="password"
                            placeholder={isSet ? t("settings.enterNewKeyToReplace") : t("settings.pasteKey", { name: meta.name })}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoComplete="off"
                          />
                        </div>
                        <Button
                          className="h-7 w-fit px-3 text-xs"
                          onClick={() => handleSave(provider)}
                          disabled={!value.trim() || saving === provider}
                        >
                          {saving === provider ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                              {t("settings.saving")}
                            </span>
                          ) : isSet ? (
                            t("settings.updateKey")
                          ) : (
                            t("settings.saveKey")
                          )}
                        </Button>
                      </div>
                      {isBoardGameKeySaving && (
                        <div
                          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-[var(--color-dark)]/75 backdrop-blur-[2px]"
                          role="status"
                          aria-live="polite"
                          aria-label={t("settings.saving")}
                        >
                          <Loader2 className="h-10 w-10 animate-spin text-[var(--btn-gradient-start)]" aria-hidden />
                          <span className="text-sm font-medium text-[var(--color-lightest)]">{t("settings.saving")}</span>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
          </div>
        </SettingsCollapsibleSection>

        {me?.tier === "admin" && (
          <SettingsCollapsibleSection
            title={t("settings.adminSection")}
            open={adminOpen}
            onToggle={() => setAdminOpen((prev) => !prev)}
            hidden={!adminSectionVisible}
          >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-4 lg:items-start">
                  <section
                    className="min-w-0 lg:col-span-8"
                    aria-labelledby="admin-users-heading"
                  >
                    <h3
                      id="admin-users-heading"
                      className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-light)]"
                    >
                      {t("settings.adminUsersTitle")}
                    </h3>
                    {adminUsersLoading && (
                      <p className="px-2 text-[11px] text-[var(--color-light)]">{t("common.loading")}</p>
                    )}
                    {adminUsersError && (
                      <p className="px-2 text-[11px] text-red-400">{adminUsersError}</p>
                    )}
                    {!adminUsersLoading && !adminUsersError && adminUsers.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-[var(--color-mid)]/30">
                        <table className="w-full min-w-[600px] text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50">
                              <th className="px-2.5 py-1.5 font-semibold text-[var(--color-lightest)]">
                                {t("settings.adminTableEmail")}
                              </th>
                              <th className="px-2.5 py-1.5 font-semibold text-[var(--color-lightest)]">
                                {t("settings.adminTableUsername")}
                              </th>
                              <th className="px-2.5 py-1.5 font-semibold text-[var(--color-lightest)]">
                                {t("settings.adminTableLogins")}
                              </th>
                              <th className="px-2.5 py-1.5 font-semibold text-[var(--color-lightest)]">
                                {t("settings.adminTableLogs")}
                              </th>
                              <th className="px-2.5 py-1.5 font-semibold text-[var(--color-lightest)]">
                                {t("settings.adminTableLastLogin")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminUsers.map((u) => (
                              <tr key={u.id} className="border-b border-[var(--color-mid)]/20">
                                <td className="px-2.5 py-1.5 text-[var(--color-lightest)]">{u.email}</td>
                                <td className="px-2.5 py-1.5 text-[var(--color-light)]">{u.username ?? "—"}</td>
                                <td className="px-2.5 py-1.5 text-[var(--color-light)]">{u.loginCount}</td>
                                <td className="px-2.5 py-1.5 text-[var(--color-light)]">{u.logsCount}</td>
                                <td className="px-2.5 py-1.5 text-[var(--color-light)]">
                                  {u.lastLoginAt
                                    ? new Date(u.lastLoginAt).toLocaleString(locale, {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      })
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {!adminUsersLoading && !adminUsersError && adminUsers.length === 0 && adminOpen && (
                      <p className="px-2 text-[11px] text-[var(--color-light)]">{t("settings.adminNoUsers")}</p>
                    )}

                    <section className="mt-4" aria-labelledby="admin-digest-heading">
                      <h3
                        id="admin-digest-heading"
                        className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-light)]"
                      >
                        {t("settings.adminDigestTitle")}
                      </h3>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={digestSending}
                        onClick={() => void handleSendMonthlyDigest()}
                        className="h-7 max-md:min-h-[44px]"
                      >
                        {digestSending ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                            {t("common.loading")}
                          </>
                        ) : (
                          t("settings.adminDigestSend")
                        )}
                      </Button>
                    </section>
                  </section>

                  <section
                    className="min-w-0 border-t border-[var(--color-mid)]/20 pt-4 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
                    aria-labelledby="admin-feature-flags-heading"
                  >
                    <h3
                      id="admin-feature-flags-heading"
                      className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-light)]"
                    >
                      {t("settings.adminFeatureFlagsTitle")}
                    </h3>
                    {adminFeatureFlagsLoading && (
                      <p className="px-2 text-[11px] text-[var(--color-light)]">{t("common.loading")}</p>
                    )}
                    {adminFeatureFlagsError && (
                      <p className="px-2 text-[11px] text-red-400">{adminFeatureFlagsError}</p>
                    )}
                    {!adminFeatureFlagsLoading &&
                      !adminFeatureFlagsError &&
                      adminFeatureFlags.length === 0 && (
                        <p className="px-2 text-[11px] text-[var(--color-light)]">
                          {t("settings.adminFeatureFlagsEmpty")}
                        </p>
                      )}
                    <ul className="flex flex-col gap-1">
                      {adminFeatureFlags.map((f) => (
                        <li
                          key={f.key}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/30 px-2.5 py-2"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-[11px] font-medium text-[var(--color-lightest)]">
                              {t(`settings.adminFlag_${f.key}`)}
                            </p>
                            <p className="text-[10px] leading-relaxed text-[var(--color-light)]">
                              {t(`settings.adminFlag_${f.key}_hint`)}
                            </p>
                            <p className="font-mono text-[9px] text-[var(--color-mid)]">{f.key}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {adminFlagSavingKey === f.key && (
                              <span className="text-[10px] text-[var(--color-light)]">
                                {t("settings.adminFeatureFlagsSaving")}
                              </span>
                            )}
                            <Switch
                              checked={f.enabled}
                              disabled={adminFlagSavingKey === f.key}
                              onCheckedChange={(v) => {
                                void handleToggleAdminFeatureFlag(f.key, v);
                              }}
                              aria-label={t(`settings.adminFlag_${f.key}`)}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
          </SettingsCollapsibleSection>
        )}
        {noAppResults && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/30 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-[var(--color-lightest)]">
              {t("settings.searchNoResultsTitle")}
            </p>
            <p className="text-xs text-[var(--color-light)]">
              {t("settings.searchNoResultsHint")}
            </p>
            <button
              type="button"
              onClick={() => setSettingsSearch("")}
              className="text-xs font-medium text-[var(--btn-gradient-start)] underline-offset-2 hover:underline"
            >
              {t("settings.searchClear")}
            </button>
          </div>
        )}
        </>
      </div>
    </motion.div>
  );
}
