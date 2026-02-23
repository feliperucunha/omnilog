import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, invalidateApiCache } from "@/lib/api";
import { toast } from "sonner";
import { API_KEY_META, type ApiKeyProvider } from "@/lib/apiKeyMeta";
import { useLocale, LOCALE_OPTIONS, type Locale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { MEDIA_TYPES, type MediaType } from "@logeverything/shared";
import { cn } from "@/lib/utils";

type KeysStatus = { tmdb: boolean; rawg: boolean; bgg: boolean; comicvine: boolean };

export function Settings() {
  const { t, locale, setLocale } = useLocale();
  const { me, refetch: refetchMe, loading } = useMe();
  const { refetch: refetchVisibleTypes } = useVisibleMediaTypes();
  const [status, setStatus] = useState<KeysStatus | null>(null);
  const [tmdb, setTmdb] = useState("");
  const [rawg, setRawg] = useState("");
  const [bgg, setBgg] = useState("");
  const [comicvine, setComicvine] = useState("");
  const [saving, setSaving] = useState<ApiKeyProvider | null>(null);
  const [savingLocale, setSavingLocale] = useState(false);
  const [savingMediaTypes, setSavingMediaTypes] = useState(false);
  const [selectedMediaTypes, setSelectedMediaTypes] = useState<Set<MediaType>>(new Set(MEDIA_TYPES));
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (me?.apiKeys) {
      setStatus({
        tmdb: me.apiKeys.tmdb,
        rawg: me.apiKeys.rawg,
        bgg: me.apiKeys.bgg,
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
    const value = provider === "tmdb" ? tmdb.trim() : provider === "rawg" ? rawg.trim() : provider === "bgg" ? bgg.trim() : comicvine.trim();
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
      else body.comicvine = value;
      await apiFetch("/settings/api-keys", { method: "PUT", body: JSON.stringify(body) });
      invalidateApiCache("/search");
      await refetchMe();
      setStatus((prev) => (prev ? { ...prev, [provider]: true } : { tmdb: false, rawg: false, bgg: false, comicvine: false }));
      if (provider === "tmdb") setTmdb("");
      if (provider === "rawg") setRawg("");
      if (provider === "bgg") setBgg("");
      if (provider === "comicvine") setComicvine("");
      toast.success(t("toast.keySaved", { name: API_KEY_META[provider].name }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.failedToSave"));
    } finally {
      setSaving(null);
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

  const handleLocaleChange = async (newLocale: Locale) => {
    setSavingLocale(true);
    setLocale(newLocale);
    try {
      await apiFetch("/settings/locale", {
        method: "PUT",
        body: JSON.stringify({ locale: newLocale }),
      });
    } catch {
      // Locale already updated locally
    } finally {
      setSavingLocale(false);
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
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-[var(--color-lightest)]">
              {t("settings.languageLabel")}
            </h3>
            <div className="space-y-2">
              <Label>{t("settings.language")}</Label>
              <select
                value={locale}
                onChange={(e) => handleLocaleChange(e.target.value as Locale)}
                disabled={savingLocale}
                className="flex h-10 w-full max-w-xs rounded-md border border-[var(--color-mid)] bg-[var(--color-darkest)] px-3 py-2 text-sm text-[var(--color-lightest)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)] disabled:opacity-50"
              >
                {LOCALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
              className="w-fit bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
              onClick={handleSaveMediaTypes}
              disabled={savingMediaTypes}
            >
              {savingMediaTypes ? t("settings.saving") : t("settings.saveMediaTypes")}
            </Button>
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
                  const value = provider === "tmdb" ? tmdb : provider === "rawg" ? rawg : provider === "bgg" ? bgg : comicvine;
                  const setValue = provider === "tmdb" ? setTmdb : provider === "rawg" ? setRawg : provider === "bgg" ? setBgg : setComicvine;
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
                          className="w-fit bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
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
