import { Link, useLocation } from "react-router-dom";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LOCALE_OPTIONS, type Locale } from "@/contexts/LocaleContext";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  "pt-BR": "PT",
  es: "ES",
};

export function AuthNavbar() {
  const { t, locale, setLocale } = useLocale();
  const { token } = useAuth();
  const { pathname } = useLocation();
  const showAuthLinks = !token && pathname !== "/";
  const showLogin = showAuthLinks && pathname !== "/login";
  const showRegister = showAuthLinks && pathname !== "/register";

  return (
    <header
      className={cn(
        "relative z-20 flex min-h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)]/90 pt-[max(0.5rem,env(safe-area-inset-top))] px-4 pb-3 backdrop-blur-md"
      )}
    >
      <Link
        to="/"
        className="flex min-w-0 items-center rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)]"
        aria-label={t("app.name")}
      >
        <Logo alt={t("app.name")} className="h-9 w-auto flex-shrink-0" />
        <span className="brand-title ml-1 text-lg font-bold text-(--btn-gradient-end) dark:text-(--btn-gradient-start) sm:text-xl">
          {t("app.name")}
        </span>
      </Link>
      <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
        {showLogin && (
          <Button asChild variant="ghost" size="sm" className="hidden min-h-10 px-3 sm:inline-flex">
            <Link to="/login">{t("nav.logIn")}</Link>
          </Button>
        )}
        {showRegister && (
          <Button asChild size="sm" className="min-h-10 px-3">
            <Link to="/register">{t("nav.register")}</Link>
          </Button>
        )}
        {showLogin && (
          <Button asChild variant="outline" size="sm" className="min-h-10 px-3 sm:hidden">
            <Link to="/login">{t("nav.logIn")}</Link>
          </Button>
        )}
        <ThemeSwitcher />
        <div className="flex items-center gap-1 rounded-md border border-[var(--color-mid)]/30 p-0.5">
          <ToggleGroup
            type="single"
            value={locale}
            onValueChange={(v) => v && setLocale(v as Locale)}
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
      </div>
    </header>
  );
}
