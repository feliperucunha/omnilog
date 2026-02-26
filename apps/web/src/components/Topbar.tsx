import { useNavigate, Link, useLocation } from "react-router-dom";
import { Settings, LogOut, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LOCALE_OPTIONS, type Locale } from "@/contexts/LocaleContext";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  "pt-BR": "PT",
  es: "ES",
};

export function Topbar() {
  const { t, locale, setLocale } = useLocale();
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    if (token) {
      apiFetch("/settings/locale", {
        method: "PUT",
        body: JSON.stringify({ locale: newLocale }),
      }).catch(() => {});
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success(t("toast.loggedOut"));
    navigate("/login");
  };

  const initial = user?.email?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <header
      className={cn(
        "flex h-14 flex-shrink-0 items-center gap-3 sm:gap-4 border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)] px-3 py-2 sm:p-4"
      )}
    >
      {/* Logo (→ dashboard) and Search: mobile only (bottom bar has categories + About) */}
      <div className="flex items-center gap-2 md:hidden">
        <Link
          to="/"
          className="flex items-center focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)] rounded"
          aria-label={t("nav.dashboard")}
        >
          <img src="/logo.svg" alt="" className="h-8 w-auto flex-shrink-0" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9",
            location.pathname === "/search" ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]" : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
          )}
          asChild
          aria-label={t("nav.search")}
        >
          <Link to="/search">
            <Search className="size-4 shrink-0" aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-2 sm:gap-3">
        {/* Theme and locale: in header when logged out, inside avatar menu when logged in */}
        {!token && (
          <>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
            </div>
            <div className="flex items-center gap-1 rounded-md border border-[var(--color-mid)]/30 p-0.5">
              <ToggleGroup
                type="single"
                value={locale}
                onValueChange={(v) => v && handleLocaleChange(v as Locale)}
                className="gap-0"
                aria-label={t("settings.language")}
              >
                {LOCALE_OPTIONS.map((opt) => (
                  <ToggleGroupItem
                    key={opt.value}
                    value={opt.value}
                    className="h-8 px-2 text-xs data-[state=on]:bg-[var(--color-mid)]/50"
                    aria-label={opt.label}
                  >
                    {LOCALE_SHORT_LABELS[opt.value]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </>
        )}
        {token && user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full border border-[var(--color-light)] bg-[var(--color-mid)]/30 p-0 text-lg font-medium text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/50"
                aria-label={t("nav.settings")}
              >
                {initial}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-2">
                <p className="text-xs font-medium text-[var(--color-light)]">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-2 space-y-3">
                <div>
                  <p className="text-xs text-[var(--color-light)] mb-1.5">{t("nav.theme")}</p>
                  <ThemeSwitcher />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-light)] mb-1.5">{t("settings.language")}</p>
                  <ToggleGroup
                    type="single"
                    value={locale}
                    onValueChange={(v) => v && handleLocaleChange(v as Locale)}
                    className="gap-0 inline-flex rounded-md border border-[var(--color-mid)]/30 p-0.5"
                    aria-label={t("settings.language")}
                  >
                    {LOCALE_OPTIONS.map((opt) => (
                      <ToggleGroupItem
                        key={opt.value}
                        value={opt.value}
                        className="h-8 px-2 text-xs data-[state=on]:bg-[var(--color-mid)]/50"
                        aria-label={opt.label}
                      >
                        {LOCALE_SHORT_LABELS[opt.value]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2">
                  <Settings className="size-4" />
                  {t("nav.settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-400 focus:text-red-400 focus:bg-red-500/20"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                {t("nav.logOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
