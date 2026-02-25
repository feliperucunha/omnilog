import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { apiFetch, invalidateApiCache } from "@/lib/api";
import { toast } from "sonner";
import { API_KEY_META, type ApiKeyProvider } from "@/lib/apiKeyMeta";

export type { ApiKeyProvider };

interface ApiKeyPromptProps {
  provider: ApiKeyProvider;
  name: string;
  link: string;
  tutorial: string;
  onSaved: () => void;
}

export function ApiKeyPrompt({
  provider,
  name,
  link,
  tutorial,
  onSaved,
}: ApiKeyPromptProps) {
  const { t } = useLocale();
  const { token } = useAuth();
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      toast.error(t("toast.enterApiKey"));
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (provider === "tmdb") body.tmdb = trimmed;
      else if (provider === "rawg") body.rawg = trimmed;
      else if (provider === "bgg") body.bgg = trimmed;
      else body.comicvine = trimmed;
      await apiFetch("/settings/api-keys", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      invalidateApiCache("/search");
      toast.success(t("toast.apiKeySaved"));
      setKey("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-4">
          <CardHeader className="p-0">
            <h3 className="text-lg font-semibold text-[var(--color-lightest)]">
              {t("apiKeyPrompt.apiKeyNeededFor", { name })}
            </h3>
          </CardHeader>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-light)]">
            {tutorial}
          </p>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-light)] underline hover:text-[var(--color-lightest)]"
          >
            {t("settings.getApiKey")}
          </a>
          {token ? (
            <>
              <div className="space-y-2">
                <Label>{t("apiKeyPrompt.yourApiKey")}</Label>
                <Input
                  type="password"
                  placeholder={t("settings.pasteKey", { name: API_KEY_META[provider].name })}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={!key.trim() || saving}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? t("settings.saving") : t("apiKeyPrompt.saveToAccount")}
              </Button>
            </>
          ) : (
            <Card className="border-[var(--color-mid)] bg-[var(--color-darkest)] p-4">
              <p className="text-sm text-[var(--color-light)]">
                {t("apiKeyPrompt.logInToSave")}
              </p>
            </Card>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
