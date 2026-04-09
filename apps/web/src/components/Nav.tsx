import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Home,
  BarChart3,
  Search,
  Settings,
  LogIn,
  UserPlus,
  Info,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const iconSize = 18;

/** Single active tab: pathname equality only (avoids prefix quirks; home is exactly `/`). */
function navItemIsActive(to: string, pathname: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to;
}

function NavLinkItem({
  to,
  label,
  icon,
  iconOnly,
  bottomBar,
  className,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  iconOnly?: boolean;
  /** Mobile bottom bar: icon + text stacked. */
  bottomBar?: boolean;
  className?: string;
}) {
  const { pathname } = useLocation();
  const isActive = navItemIsActive(to, pathname);

  return (
    <Link
      to={to}
      className={cn(
        "flex rounded-lg text-[var(--color-lightest)] transition-colors hover:bg-[var(--color-mid)]/50 [-webkit-tap-highlight-color:transparent]",
        bottomBar
          ? "flex-1 flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-0"
          : iconOnly
            ? "flex-1 justify-center py-4 items-center"
            : "items-center gap-3 px-3 py-2.5 text-sm font-medium",
        isActive && "bg-[var(--color-mid)]/50",
        className
      )}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
    >
      <span
        className={cn(
          bottomBar && "shrink-0 flex items-center justify-center",
          !bottomBar && !iconOnly && "flex h-5 w-5 shrink-0 items-center justify-center"
        )}
      >
        {icon}
      </span>
      {(bottomBar || !iconOnly) && (
        <span
          className={cn(
            bottomBar
              ? "max-w-full truncate text-center text-[10px] font-medium leading-tight"
              : "min-w-0 flex-1 truncate text-left text-sm font-medium"
          )}
          title={label}
        >
          {label}
        </span>
      )}
    </Link>
  );
}

export function Nav() {
  const { t } = useLocale();
  const { token } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Android WebView: after a system back gesture the previously tapped nav link can
    // stay focused while the new route activates another item—both looked "selected".
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    const ae = document.activeElement;
    if (!(ae instanceof HTMLElement) || ae.tagName !== "A") return;
    const inMainNav = ae.closest('nav[aria-label="Main navigation"]');
    if (inMainNav) ae.blur();
  }, [location.pathname, location.search, location.hash]);

  const navItems: { to: string; labelKey: string; icon: React.ReactNode }[] = [
    { to: "/", labelKey: "nav.dashboard", icon: <Home size={iconSize} /> },
    { to: "/statistics", labelKey: "nav.statistics", icon: <BarChart3 size={iconSize} /> },
    { to: "/search", labelKey: "nav.search", icon: <Search size={iconSize} /> },
    { to: "/settings", labelKey: "nav.settings", icon: <Settings size={iconSize} /> },
    { to: "/tiers", labelKey: "nav.plans", icon: <CreditCard size={iconSize} /> },
    { to: "/about", labelKey: "nav.about", icon: <Info size={iconSize} /> },
  ];

  /** Mobile bottom bar: same as nav but without About; icon + text per item. */
  const bottomBarItems = navItems.filter((item) => item.to !== "/about");

  return (
    <>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-[var(--color-mid)]/30 bg-[var(--color-dark)] md:flex"
      >
        <Link
          to="/"
          className="flex h-14 min-w-0 items-center gap-3 border-b border-[var(--color-mid)]/30 px-4 text-[var(--color-lightest)] no-underline"
        >
          <Logo alt={t("app.name")} className="h-10 w-auto flex-shrink-0 md:h-10" />
          <span
            className="brand-title min-w-0 flex-1 truncate font-bold text-lg text-[var(--btn-gradient-end)] dark:text-[var(--btn-gradient-start)] md:text-xl"
            title={t("app.name")}
          >
            {t("app.name")}
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3 min-h-0" aria-label="Main navigation">
          {token ? (
            <>
              {navItems.map((item) => (
                <NavLinkItem
                  key={item.to}
                  to={item.to}
                  label={t(item.labelKey)}
                  icon={item.icon}
                />
              ))}
            </>
          ) : (
            <>
              <NavLinkItem
                to="/"
                label={t("nav.dashboard")}
                icon={<Home size={iconSize} />}
              />
              <NavLinkItem
                to="/search"
                label={t("nav.search")}
                icon={<Search size={iconSize} />}
              />
              <NavLinkItem to="/about" label={t("nav.about")} icon={<Info size={iconSize} />} />
              <NavLinkItem to="/tiers" label={t("nav.plans")} icon={<CreditCard size={iconSize} />} />
              <NavLinkItem to="/login" label={t("nav.logIn")} icon={<LogIn size={iconSize} />} />
              <NavLinkItem to="/register" label={t("nav.register")} icon={<UserPlus size={iconSize} />} />
            </>
          )}
        </nav>
      </aside>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-1 items-stretch border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)] pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="Main navigation"
      >
        {token ? (
          bottomBarItems.map((item) => (
            <NavLinkItem
              key={item.to}
              to={item.to}
              label={t(item.labelKey)}
              icon={item.icon}
              bottomBar
            />
          ))
        ) : (
          <>
            <NavLinkItem to="/" label={t("nav.dashboard")} icon={<Home size={iconSize} />} bottomBar />
            <NavLinkItem to="/search" label={t("nav.search")} icon={<Search size={iconSize} />} bottomBar />
            <NavLinkItem to="/tiers" label={t("nav.plans")} icon={<CreditCard size={iconSize} />} bottomBar />
            <NavLinkItem to="/about" label={t("nav.about")} icon={<Info size={iconSize} />} bottomBar />
            <NavLinkItem to="/login" label={t("nav.logIn")} icon={<LogIn size={iconSize} />} bottomBar />
            <NavLinkItem to="/register" label={t("nav.register")} icon={<UserPlus size={iconSize} />} bottomBar />
          </>
        )}
      </nav>
    </>
  );
}
