import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { apiFetch, invalidateApiCache, apiFetchFile } from "@/lib/api";
import { toast } from "sonner";
import { API_KEY_META, type ApiKeyProvider } from "@/lib/apiKeyMeta";
import { useLocale, LOCALE_OPTIONS, type Locale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { BOARD_GAME_PROVIDERS, MEDIA_TYPES, type BoardGameProvider, type MediaType } from "@logeverything/shared";
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

  const handleToggleMediaType = (type: MediaType) => {
    setSelectedMediaTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleSaveMediaTypes = async () => {
    setSavingMediaTypes(true);
    try {
      await apiFetch("/settings/visible-media-types", {
        method: "PUT",
        body: JSON.stringify({ types: Array.from(selectedMediaTypes) }),
      });
      await refetchVisibleTypes();
      toast.success(t("toast.mediaTypesSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.failedToSave"));
    } finally {
      setSavingMediaTypes(false);
    }
  };

  if (loading && !me) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-[200px] rounded-md" />
        <Skeleton className="h-[200px] rounded-md" />
        <Skeleton className="h-[200px] rounded-md" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
          {t("settings.title")}
        </h1>

        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-lightest)] mb-2">
                {t("nav.theme")}
              </h3>
              <ThemeSwitcher />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-lightest)] mb-2">
                {t("settings.language")}
              </h3>
              <ToggleGroup
                type="single"
                value={locale}
                onValueChange={(v) => v && handleLocaleChange(v as Locale)}
                className="inline-flex rounded-md border border-[var(--color-mid)]/30 p-0.5 gap-0"
                aria-label={t("settings.language")}
              >
                {LOCALE_OPTIONS.map((opt) => (
                  <ToggleGroupItem
                    key={opt.value}
                    value={opt.value}
                    className="h-8 px-3 text-sm data-[state=on]:bg-[var(--color-mid)]/50"
                    aria-label={opt.label}
                  >
                    {LOCALE_SHORT_LABELS[opt.value]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </Card>

        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-[var(--color-lightest)]">
              {t("settings.visibleMediaTypesLabel")}
            </h3>
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
                    className="h-4 w-4 rounded border-[var(--color-mid)] bg-[var(--color-darkest)] text-[var(--color-mid)] focus:ring-[var(--color-mid)]"
                  />
                  <span className="text-sm text-[var(--color-lightest)]">
                    {t(`nav.${type}`)}
                  </span>
                </label>
              ))}
            </div>
            <Button
              className="w-fit"
              onClick={handleSaveMediaTypes}
              disabled={savingMediaTypes}
            >
              {savingMediaTypes ? t("settings.saving") : t("settings.saveMediaTypes")}
            </Button>
          </div>
        </Card>

        {me?.tier === "pro" && (
          <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-semibold text-[var(--color-lightest)]">
                {t("tiers.exportLogs")}
              </h3>
              <p className="text-sm text-[var(--color-light)]">
                {t("tiers.proExportDesc")}
              </p>
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
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-[var(--color-lightest)] transition-colors hover:bg-[var(--color-darkest)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-inset"
            aria-expanded={advancedOpen}
          >
            {advancedOpen ? (
              <ChevronDown className="h-5 w-5 shrink-0 text-[var(--color-light)]" aria-hidden />
            ) : (
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-light)]" aria-hidden />
            )}
            <span className="font-semibold">{t("settings.advanced")}</span>
          </button>
          {advancedOpen && (
            <div className="border-t border-[var(--color-dark)] px-4 pb-4 pt-2">
              <p className="mb-4 text-sm text-[var(--color-light)]">
                {t("settings.apiKeysIntro")}
              </p>
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
                          {isSet && (
                            <span className="rounded bg-[var(--color-darkest)] px-2 py-0.5 text-xs text-[var(--color-light)]">
                              {t("settings.keySaved")}
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-[var(--color-light)]">
                          {meta.tutorial}
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
