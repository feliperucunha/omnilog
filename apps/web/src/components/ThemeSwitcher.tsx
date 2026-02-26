import { Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ThemeSwitcher() {
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
    <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full">
      {/* Track background (warm for light, cool for dark) */}
      <div
        className={cn(
          "absolute inset-0 rounded-full transition-colors",
          isDark ? "bg-blue-600 dark:bg-blue-700" : "bg-amber-400 dark:bg-amber-500"
        )}
        aria-hidden
      />
      <Switch
        checked={isDark}
        onCheckedChange={handleToggle}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="absolute inset-0 z-10 h-full w-full border-0 bg-transparent focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600 data-[state=checked]:bg-transparent"
      />
      <Sun
        className="pointer-events-none absolute left-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white drop-shadow-sm"
        aria-hidden
      />
      <Moon
        className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white drop-shadow-sm"
        aria-hidden
      />
    </div>
  );
}
