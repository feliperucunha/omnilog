import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, Download, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSkeleton } from "@/components/skeletons";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { apiFetch, invalidateApiCache, apiFetchFile } from "@/lib/api";
import { toast } from "sonner";
import { API_KEY_META, type ApiKeyProvider } from "@/lib/apiKeyMeta";
import { useLocale, LOCALE_OPTIONS, type Locale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { getShowCompleteModal, SHOW_COMPLETE_MODAL_STORAGE_KEY } from "@/contexts/LogCompleteContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { BOARD_GAME_PROVIDERS, MEDIA_TYPES, type BoardGameProvider, type MediaType } from "@dogument/shared";
import { cn } from "@/lib/utils";

type KeysStatus = { tmdb: boolean; rawg: boolean; bgg: boolean; ludopedia: boolean; comicvine: boolean };

const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  "pt-BR": "PT",
  es: "ES",
};

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
  const [selectedMediaTypes, setSelectedMediaTypes] = useState<Set<MediaType>>(new Set(MEDIA_TYPES));
  const [searchParams] = useSearchParams();
  const [advancedOpen, setAdvancedOpen] = useState(() => searchParams.get("open") === "api-keys");
  const [exporting, setExporting] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(() => getShowCompleteModal());
  type EarnedBadge = { id: string; name: string; description: string; icon: string; medium: string | null; rarity: string; earnedAt: string };
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [selectedBadgeIds, setSelectedBadgeIds] = useState<string[]>([]);
  const [profileBadgesLoading, setProfileBadgesLoading] = useState(true);
  const [savingProfileBadges, setSavingProfileBadges] = useState(false);

  useEffect(() => {
    if (searchParams.get("open") === "api-keys") setAdvancedOpen(true);
  }, [searchParams]);

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
      setSelectedMediaTypes(new Set(me.visibleMediaTypes as MediaType[]));
    }
  }, [me?.visibleMediaTypes]);

  useEffect(() => {
    if (!token) return;
    setProfileBadgesLoading(true);
    Promise.all([
      apiFetch<{ data: EarnedBadge[] }>("/me/badges"),
      apiFetch<{ badgeIds: string[] }>("/settings/profile-badges"),
    ])
      .then(([badgesRes, profileRes]) => {
        setEarnedBadges(badgesRes.data ?? []);
        setSelectedBadgeIds(profileRes.badgeIds ?? []);
      })
      .catch(() => {})
      .finally(() => setProfileBadgesLoading(false));
  }, [token]);

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
      toast.error(t("toast.enterKeyToSave"));
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
      toast.error(err instanceof Error ? err.message : t("toast.failedToSave"));
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
      toast.error(err instanceof Error ? err.message : t("toast.failedToSave"));
    } finally {
      setSavingBoardGameProvider(false);
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

  const handleToggleProfileBadge = async (badgeId: string) => {
    const next = selectedBadgeIds.includes(badgeId)
      ? selectedBadgeIds.filter((id) => id !== badgeId)
      : selectedBadgeIds.length >= 3
        ? [...selectedBadgeIds.slice(1), badgeId]
        : [...selectedBadgeIds, badgeId];
    setSelectedBadgeIds(next);
    setSavingProfileBadges(true);
    try {
      await apiFetch("/settings/profile-badges", {
        method: "PUT",
        body: JSON.stringify({ badgeIds: next }),
      });
      toast.success(t("settings.profileBadgesSaved"));
    } catch (err) {
      setSelectedBadgeIds(selectedBadgeIds);
      toast.error(err instanceof Error ? err.message : t("toast.failedToSave"));
    } finally {
      setSavingProfileBadges(false);
    }
  };

  const handleToggleMediaType = async (type: MediaType) => {
    const next = new Set(selectedMediaTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    const typesArray = Array.from(next);
    if (typesArray.length === 0) return;
    setSelectedMediaTypes(next);
    setSavingMediaTypes(true);
    try {
      await apiFetch("/settings/visible-media-types", {
        method: "PUT",
        body: JSON.stringify({ types: typesArray }),
      });
      await refetchVisibleTypes();
      toast.success(t("toast.mediaTypesSaved"));
    } catch (err) {
      setSelectedMediaTypes(selectedMediaTypes);
      toast.error(err instanceof Error ? err.message : t("toast.failedToSave"));
    } finally {
      setSavingMediaTypes(false);
    }
  };

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
        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <h2 className="text-base font-semibold text-[var(--color-lightest)] mb-1">
            {t("settings.general")}
          </h2>
          <p className="text-sm text-[var(--color-light)] mb-5">
            {t("settings.generalIntro")}
          </p>
          <div className="divide-y divide-[var(--color-mid)]/20">
            {me && (
              <div className="flex flex-col gap-2 py-4 first:pt-0">
                <span className="text-sm font-medium text-[var(--color-lightest)]">
                  {t("settings.subscription")}
                </span>
                <p className="text-sm text-[var(--color-light)]">
                  {me.tier === "pro" ? (
                    me.daysRemaining != null ? (
                      <>
                        {me.daysRemaining === 1
                          ? t("settings.subscriptionDaysLeftOne")
                          : t("settings.subscriptionDaysLeft", { count: String(me.daysRemaining) })}
                        {" · "}
                        <Link to="/tiers" className="underline hover:no-underline text-[var(--color-lightest)]">
                          {t("tiers.manageSubscription")}
                        </Link>
                      </>
                    ) : (
                      <Link to="/tiers" className="underline hover:no-underline text-[var(--color-lightest)]">
                        {t("tiers.manageSubscription")}
                      </Link>
                    )
                  ) : (
                    <Link to="/tiers" className="underline hover:no-underline text-[var(--color-lightest)]">
                      {t("settings.viewPlans")}
                    </Link>
                  )}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <span className="text-sm font-medium text-[var(--color-lightest)]">
                  {t("settings.language")}
                </span>
              </div>
              <div className="shrink-0">
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
                      className="h-9 px-4 text-sm font-medium data-[state=on]:bg-[var(--color-mid)]/50 data-[state=on]:text-[var(--color-lightest)] rounded-md"
                      aria-label={opt.label}
                    >
                      {LOCALE_SHORT_LABELS[opt.value]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
            <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <span className="text-sm font-medium text-[var(--color-lightest)]">
                  {t("nav.theme")}
                </span>
              </div>
              <div className="shrink-0">
                <ThemeSwitcher />
              </div>
            </div>
            <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 last:pb-0">
              <label className="flex cursor-pointer flex-col gap-1 min-w-0 focus-within:outline-none">
                <span className="text-sm font-medium text-[var(--color-lightest)]">
                  {t("settings.showCompleteModal")}
                </span>
                <span id="show-complete-modal-desc" className="text-xs text-[var(--color-light)]">
                  {t("settings.showCompleteModalIntro")}
                </span>
              </label>
              <div className="shrink-0">
                <input
                  type="checkbox"
                  checked={showCompleteModal}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowCompleteModal(checked);
                    localStorage.setItem(SHOW_COMPLETE_MODAL_STORAGE_KEY, checked ? "true" : "false");
                  }}
                  className="h-4 w-4 rounded border-[var(--color-mid)] bg-[var(--color-darkest)] text-[var(--btn-gradient-start)] focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)]"
                  aria-describedby="show-complete-modal-desc"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-[var(--color-lightest)]">
              {t("settings.profileBadges")}
            </h3>
            <p className="text-sm text-[var(--color-light)]">
              {t("settings.profileBadgesIntro")}
            </p>
            {profileBadgesLoading ? (
              <p className="text-sm text-[var(--color-light)]">{t("common.loading")}</p>
            ) : earnedBadges.length === 0 ? (
              <p className="text-sm text-[var(--color-light)]">
                {t("settings.profileBadgesNoBadges")}
              </p>
            ) : (
              <>
                <p className="text-xs text-[var(--color-light)]">
                  {t("settings.profileBadgesSelected", { count: String(selectedBadgeIds.length) })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {earnedBadges.map((b) => {
                    const selected = selectedBadgeIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleToggleProfileBadge(b.id)}
                        disabled={savingProfileBadges}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                          selected
                            ? "border-[var(--btn-gradient-start)] bg-[var(--color-mid)]/30 text-[var(--color-lightest)]"
                            : "border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 text-[var(--color-light)] hover:bg-[var(--color-darkest)]"
                        )}
                        title={b.description}
                      >
                        <span aria-hidden>{b.icon}</span>
                        <span className="max-w-[180px] truncate">{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-[var(--color-lightest)]">
              {t("settings.publicProfileCustomization")}
            </h3>
            {me?.tier === "pro" ? (
              <>
                <p className="text-sm text-[var(--color-light)]">
                  {t("settings.visibleMediaTypesIntro")}
                </p>
                <div className="flex flex-wrap gap-4">
                  {MEDIA_TYPES.map((type) => (
                    <label
                      key={type}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-[var(--color-darkest)]/50",
                        "focus-within:ring-2 focus-within:ring-[var(--color-mid)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--color-dark)]"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMediaTypes.has(type)}
                        onChange={() => handleToggleMediaType(type)}
                        disabled={savingMediaTypes}
                        className="h-4 w-4 rounded border-[var(--color-mid)] bg-[var(--color-darkest)] text-[var(--color-mid)] focus:ring-[var(--color-mid)]"
                      />
                      <span className="text-sm text-[var(--color-lightest)]">
                        {t(`nav.${type}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--color-light)]">
                  {t("settings.publicProfileProOnlyIntro")}
                </p>
                <Button variant="outline" className="w-fit" asChild>
                  <Link to="/tiers">{t("settings.publicProfileUpgrade")}</Link>
                </Button>
              </>
            )}
          </div>
        </Card>

        {me && (
          <Card
            className={cn(
              "border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]",
              me.tier !== "pro" && "opacity-75"
            )}
          >
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-semibold text-[var(--color-lightest)]">
                {t("tiers.exportLogs")}
              </h3>
              <p className="text-sm text-[var(--color-light)]">
                {t("tiers.proExportDesc")}
              </p>
              {me.tier === "pro" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit gap-2"
                  disabled={exporting}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      const { blob, filename } = await apiFetchFile("/logs/export");
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = filename;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success(t("tiers.exportSuccess"));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : t("tiers.exportFailed"));
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {exporting ? t("common.saving") : t("tiers.exportLogs")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-fit gap-2 opacity-70"
                  asChild
                >
                  <Link to="/tiers">
                    <Download className="h-4 w-4" aria-hidden />
                    {t("tiers.exportLogs")}
                  </Link>
                </Button>
              )}
            </div>
          </Card>
        )}

        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-[var(--color-lightest)]">
              {t("settings.boardGameProviderLabel")}
            </h3>
            <p className="text-sm text-[var(--color-light)]">
              {t("settings.boardGameProviderIntro")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                value={me?.boardGameProvider ?? "bgg"}
                onValueChange={(v) => v && handleBoardGameProviderChange(v as BoardGameProvider)}
                disabled={savingBoardGameProvider}
                className="inline-flex rounded-md border border-[var(--color-mid)]/30 p-0.5"
                aria-label={t("settings.boardGameProviderLabel")}
              >
                {BOARD_GAME_PROVIDERS.map((provider) => (
                  <ToggleGroupItem
                    key={provider}
                    value={provider}
                    className="h-8 px-3 text-sm"
                    aria-label={provider === "bgg" ? t("settings.boardGameProviderBgg") : t("settings.boardGameProviderLudopedia")}
                  >
                    {provider === "bgg" ? t("settings.boardGameProviderBgg") : t("settings.boardGameProviderLudopedia")}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </Card>

        <div className="rounded-md border border-[var(--color-dark)] bg-[var(--color-dark)] shadow-[var(--shadow-md)]">
          <button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-[var(--color-lightest)] transition-colors hover:bg-[var(--color-darkest)]/50 focus:outline-none"
            aria-expanded={advancedOpen}
          >
            {advancedOpen ? (
              <ChevronDown className="h-5 w-5 shrink-0 text-[var(--color-light)]" aria-hidden />
            ) : (
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-light)]" aria-hidden />
            )}
            <span className="font-semibold">{t("settings.apiKeys")}</span>
          </button>
          {advancedOpen && (
            <div className="border-t border-[var(--color-dark)] px-4 pb-4 pt-2">
              <div className="mb-4 flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-[var(--color-light)]">
                    {t("settings.apiKeysIntro")}
                  </p>
                  <p className="text-sm text-[var(--color-light)]">
                    {t("settings.apiKeyTutorialIntro")}
                  </p>
                </div>
                <a
                  href="mailto:feliperubenmv@gmail.com"
                  className="shrink-0 rounded p-1 text-[var(--color-light)] transition-colors hover:text-[var(--color-lightest)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)]"
                  aria-label={t("settings.apiKeysSupport")}
                  title={t("settings.apiKeysSupport")}
                >
                  <HelpCircle className="h-5 w-5" aria-hidden />
                </a>
              </div>
              <div className="flex flex-col gap-4">
                {(Object.keys(API_KEY_META) as ApiKeyProvider[]).map((provider) => {
                  const meta = API_KEY_META[provider];
                  const isSet = status?.[provider];
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
                      className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-lg font-semibold text-[var(--color-lightest)]">
                            {meta.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            {provider === "bgg" && (
                              <span className="rounded border border-[var(--color-mid)]/50 bg-[var(--color-darkest)]/80 px-2 py-0.5 text-xs text-[var(--color-light)]">
                                {t("settings.bggApprovalBadge")}
                              </span>
                            )}
                            {isSet && (
                              <span className="rounded bg-[var(--color-darkest)] px-2 py-0.5 text-xs text-[var(--color-light)]">
                                {t("settings.keySaved")}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-[var(--color-light)]">
                          {t(`settings.apiKeyTutorial.${provider}`)}
                        </p>
                        <a
                          href={meta.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--color-light)] underline hover:text-[var(--color-lightest)]"
                        >
                          {t("settings.getApiKey")}
                        </a>
                        <div className="space-y-2">
                          <Label>{t("settings.apiKeyLabel")}</Label>
                          <Input
                            type="password"
                            placeholder={isSet ? t("settings.enterNewKeyToReplace") : t("settings.pasteKey", { name: meta.name })}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoComplete="off"
                          />
                        </div>
                        <Button
                          className="w-fit"
                          onClick={() => handleSave(provider)}
                          disabled={!value.trim() || saving === provider}
                        >
                          {saving === provider ? t("settings.saving") : isSet ? t("settings.updateKey") : t("settings.saveKey")}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
