import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Settings, Info, LogOut, Loader2, CreditCard, Store, FlaskConical } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
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
import { Logo } from "@/components/Logo";
import { getUnauthenticatedEntryPath } from "@/lib/unauthenticatedEntry";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAndroidOverlayBack } from "@/hooks/useAndroidOverlayBack";

const ROUTE_TITLE_KEYS: Record<string, string> = {
  "/": "nav.search",
  "/dashboard": "nav.dashboard",
  "/discover": "nav.discover",
  "/statistics": "nav.statistics",
  "/search": "nav.search",
  "/market": "nav.market",
  "/settings": "nav.settings",
  "/about": "nav.about",
  "/tiers": "nav.plans",
};

const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  "pt-BR": "PT",
  es: "ES",
};

export function Topbar() {
  const { t, locale, setLocale } = useLocale();
  const { token, user, logout, signingOut, setSigningOut } = useAuth();
  const { me } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitleContext = usePageTitle();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const userMenuContentRef = useRef<HTMLDivElement>(null);

  useAndroidOverlayBack(userMenuOpen, () => setUserMenuOpen(false));

  useEffect(() => {
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (userMenuTriggerRef.current?.contains(target)) return;
      if (userMenuContentRef.current?.contains(target)) return;
      setUserMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [userMenuOpen]);

  const fallbackTitleKey = ROUTE_TITLE_KEYS[location.pathname];
  const displayTitle =
    pageTitleContext?.pageTitle ?? (fallbackTitleKey ? t(fallbackTitleKey) : null);

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
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      toast.success(t("toast.loggedOut"));
      navigate(getUnauthenticatedEntryPath(), { replace: true });
    } catch {
      setSigningOut(false);
    }
  };

  const initial = user?.email?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex min-h-16 flex-shrink-0 items-center gap-3 border-b border-[var(--color-surface-border)] bg-[var(--color-darkest)] px-3.5 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-7"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
          <Link
            to={token ? "/dashboard" : "/"}
            className="flex shrink-0 items-center rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-darkest)]"
            aria-label={t("app.name")}
          >
            <Logo alt={t("app.name")} className="h-9 w-auto flex-shrink-0" />
          </Link>
          <div className="min-w-0">
            <div className="display-title text-base leading-snug text-[var(--color-lightest)]">{t("app.name")}</div>
            {displayTitle ? (
              <div className="truncate text-xs text-[var(--color-light)]">{displayTitle}</div>
            ) : null}
          </div>
        </div>
        {location.pathname !== "/market" ? (
          <button
            type="button"
            className="hidden min-h-11 flex-1 items-center gap-2 rounded-[10px] border border-[var(--color-surface-border)] bg-[var(--color-dark)] px-3 text-left text-sm text-[var(--color-light)] md:flex"
            onClick={() => navigate("/market")}
          >
            <Store className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t("nav.market")}</span>
          </button>
        ) : (
          <div className="hidden flex-1 md:block" />
        )}
      </div>

      {pageTitleContext?.rightSlot && (
        <div className="flex flex-shrink-0 items-center">
          {pageTitleContext.rightSlot}
        </div>
      )}

        <div className="ml-auto flex flex-shrink-0 items-center gap-2 sm:gap-3">
        {location.pathname !== "/market" && (
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full bg-[var(--color-lightest)] text-[var(--color-darkest)] shadow-[var(--shadow-sm)] md:hidden"
            onClick={() => navigate("/market")}
            aria-label={t("nav.market")}
          >
            <Store className="size-5" aria-hidden />
          </button>
        )}
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
        {/* {token && me?.tier === "admin" && (
          <button
            type="button"
            onClick={() => navigate(location.pathname === "/sandbox" ? "/dashboard" : "/sandbox")}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-xl border-2 border-[var(--btn-gradient-start)] px-3 text-xs font-semibold text-[var(--color-lightest)] transition-colors",
              location.pathname === "/sandbox"
                ? "btn-gradient"
                : "bg-transparent hover:bg-[var(--btn-gradient-start)]/10"
            )}
            aria-label="Open UI sandbox"
          >
            <FlaskConical className="size-4" aria-hidden />
            <span className="max-md:hidden">UI Lab</span>
          </button>
        )} */}
        {token && user && (
          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                ref={userMenuTriggerRef}
                variant="ghost"
                size="icon"
                className="h-10 w-10 max-md:min-h-[40px] max-md:min-w-[40px] max-md:h-10 max-md:w-10 rounded-full border border-[var(--color-light)] bg-[var(--color-mid)]/30 p-0 text-lg font-medium text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label={t("nav.settings")}
              >
                {initial}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent ref={userMenuContentRef} align="end" className="w-56">
              <div className="px-2 py-2">
                <p className="text-xs font-medium text-[var(--color-light)]">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-0 cursor-default p-0 focus:bg-transparent data-[highlighted]:bg-transparent"
                onSelect={(e) => e.preventDefault()}
              >
                <div className="w-full px-2 py-2">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/40 px-3 py-2">
                      <span className="text-xs font-medium text-[var(--color-light)]">{t("nav.theme")}</span>
                      <ThemeSwitcher />
                    </div>
                    <div className="rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/40 p-1.5">
                      <ToggleGroup
                        type="single"
                        value={locale}
                        onValueChange={(v) => v && handleLocaleChange(v as Locale)}
                        className="grid w-full grid-cols-3 gap-1"
                        aria-label={t("settings.language")}
                      >
                        {LOCALE_OPTIONS.map((opt) => (
                          <ToggleGroupItem
                            key={opt.value}
                            value={opt.value}
                            className="h-9 text-xs font-semibold data-[state=on]:bg-[var(--color-mid)]/50"
                            aria-label={opt.label}
                          >
                            {LOCALE_SHORT_LABELS[opt.value]}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/tiers" className="flex items-center gap-2">
                  <CreditCard className="size-4" />
                  {t("nav.plans")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/my-listings" className="flex items-center gap-2">
                  <Store className="size-4" />
                  {t("nav.myListings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2">
                  <Settings className="size-4" />
                  {t("nav.settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/about" className="flex items-center gap-2">
                  <Info className="size-4" />
                  {t("nav.about")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-400 focus:text-red-400 focus:bg-red-500/20"
                disabled={signingOut}
                onClick={() => void handleLogout()}
              >
                {signingOut ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <LogOut className="size-4" />
                )}
                {signingOut ? t("nav.signingOut") : t("nav.logOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        </div>
    </header>
  );
}
