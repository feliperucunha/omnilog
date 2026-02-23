import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

export function ThemeSwitcher() {
  const { t } = useLocale();
  const { colorScheme, setColorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const { token } = useAuth();

  const handleToggle = (checked: boolean) => {
    const next = checked ? "dark" : "light";
    setColorScheme(next);
    if (token) {
      apiFetch("/settings/theme", {
        method: "PUT",
        body: JSON.stringify({ theme: next }),
      }).catch(() => {});
    }
  };

  return (
    <div className="flex cursor-pointer items-center gap-2">
      <span className="text-xs text-[var(--color-light)]">
        {isDark ? t("theme.dark") : t("theme.light")}
      </span>
      <Switch
        checked={isDark}
        onCheckedChange={handleToggle}
        aria-label="Toggle dark mode"
      />
    </div>
  );
}
