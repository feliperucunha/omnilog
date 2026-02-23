import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { apiFetch } from "@/lib/api";
import { MEDIA_TYPES, type MediaType } from "@logeverything/shared";
import { cn } from "@/lib/utils";

export function Onboarding() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { colorScheme, setColorScheme } = useTheme();
  const { refetch: refetchVisibleTypes } = useVisibleMediaTypes();
  const [selectedTypes, setSelectedTypes] = useState<Set<MediaType>>(new Set(MEDIA_TYPES));
  const [theme, setTheme] = useState<"light" | "dark">(colorScheme);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleToggleType = (type: MediaType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await apiFetch("/settings/onboarding", {
        method: "PUT",
        body: JSON.stringify({ theme, types: Array.from(selectedTypes) }),
      });
      setColorScheme(theme);
      setUser({ ...user, onboarded: true });
      await refetchVisibleTypes();
      navigate("/", { replace: true });
    } catch {
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-darkest)] p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-xl flex flex-col gap-8 border border-border rounded-2xl p-6"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
            {t("onboarding.title")}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-light)]">
            {t("onboarding.subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Label className="text-base font-medium text-[var(--color-lightest)]">
            {t("onboarding.themeLabel")}
          </Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTheme("light");
                setColorScheme("light");
              }}
              className={cn(
                "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors",
                theme === "light"
                  ? "border-[var(--color-mid)] bg-[var(--color-mid)]/30 text-[var(--color-lightest)]"
                  : "border-[var(--color-mid)]/50 bg-transparent text-[var(--color-light)] hover:border-[var(--color-mid)] hover:text-[var(--color-lightest)]"
              )}
            >
              {t("theme.light")}
            </button>
            <button
              type="button"
              onClick={() => {
                setTheme("dark");
                setColorScheme("dark");
              }}
              className={cn(
                "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors",
                theme === "dark"
                  ? "border-[var(--color-mid)] bg-[var(--color-mid)]/30 text-[var(--color-lightest)]"
                  : "border-[var(--color-mid)]/50 bg-transparent text-[var(--color-light)] hover:border-[var(--color-mid)] hover:text-[var(--color-lightest)]"
              )}
            >
              {t("theme.dark")}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Label className="text-base font-medium text-[var(--color-lightest)]">
            {t("onboarding.mediaTypesLabel")}
          </Label>
          <p className="text-sm text-[var(--color-light)]">
            {t("onboarding.mediaTypesHint")}
          </p>
          <div className="flex flex-wrap gap-3">
            {MEDIA_TYPES.map((type) => (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-colors",
                  selectedTypes.has(type)
                    ? "border-[var(--color-mid)] bg-[var(--color-mid)]/30 text-[var(--color-lightest)]"
                    : "border-[var(--color-mid)]/50 bg-transparent text-[var(--color-light)] hover:border-[var(--color-mid)] hover:text-[var(--color-lightest)]"
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={() => handleToggleType(type)}
                  className="h-4 w-4 rounded border-[var(--color-mid)] bg-[var(--color-darkest)] text-[var(--color-mid)] focus:ring-[var(--color-mid)]"
                />
                <span className="text-sm font-medium">{t(`nav.${type}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <Button
          className="w-full bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
          onClick={handleComplete}
          disabled={loading || selectedTypes.size === 0}
        >
          {loading ? t("onboarding.continuing") : t("onboarding.continue")}
        </Button>
      </motion.div>
    </div>
  );
}
