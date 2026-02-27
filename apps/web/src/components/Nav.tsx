import { NavLink, Link, useLocation } from "react-router-dom";
import {
  Home,
  Search,
  Settings,
  LogIn,
  UserPlus,
  Info,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

const iconSize = 18;

function NavLinkItem({
  to,
  label,
  icon,
  active,
  iconOnly,
  className,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        "flex items-center rounded-lg text-[var(--color-lightest)] transition-colors hover:bg-[var(--color-mid)]/50",
        iconOnly ? "flex-1 justify-center py-3" : "gap-2 px-3 py-2 text-sm font-medium",
        active && "bg-[var(--color-mid)]/50",
        className
      )}
      aria-label={label}
    >
      {icon}
      {!iconOnly && <span className="min-w-0 flex-1 truncate">{label}</span>}
    </NavLink>
  );
}

export function Nav() {
  const { t } = useLocale();
  const { token } = useAuth();
  const location = useLocation();

  const navItems: { to: string; labelKey: string; icon: React.ReactNode }[] = [
    { to: "/", labelKey: "nav.dashboard", icon: <Home size={iconSize} /> },
    { to: "/search", labelKey: "nav.search", icon: <Search size={iconSize} /> },
    { to: "/settings", labelKey: "nav.settings", icon: <Settings size={iconSize} /> },
    { to: "/tiers", labelKey: "nav.plans", icon: <CreditCard size={iconSize} /> },
    { to: "/about", labelKey: "nav.about", icon: <Info size={iconSize} /> },
  ];

  /** On mobile bottom bar: Home and Search first, then Settings and About. Icon-only, fill space. */
  const bottomBarItems = navItems;

  return (
    <>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-[var(--color-mid)]/30 bg-[var(--color-dark)] md:flex"
      >
        <Link
          to="/"
          className="flex h-14 items-center border-b border-[var(--color-mid)]/30 -ml-2 text-[var(--color-lightest)] no-underline"
        >
          <img src="/logo.png" alt="OMNILOG" className="h-16 w-auto flex-shrink-0" />
          <span className="-ml-4 font-bold text-2xl text-(--btn-gradient-end) dark:text-(--btn-gradient-start)">OMNILOG</span>
        </Link>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 min-h-0">
          {token ? (
            <>
              {navItems.map((item) => (
                <NavLinkItem
                  key={item.to}
                  to={item.to}
                  label={t(item.labelKey)}
                  icon={item.icon}
                  active={location.pathname === item.to}
                />
              ))}
            </>
          ) : (
            <>
              <NavLinkItem
                to="/search"
                label={t("nav.search")}
                icon={<Search size={iconSize} />}
                active={location.pathname === "/search"}
              />
              <NavLinkItem to="/about" label={t("nav.about")} icon={<Info size={iconSize} />} />
              <NavLinkItem to="/tiers" label={t("nav.plans")} icon={<CreditCard size={iconSize} />} active={location.pathname === "/tiers"} />
              <NavLinkItem to="/login" label={t("nav.logIn")} icon={<LogIn size={iconSize} />} />
              <NavLinkItem to="/register" label={t("nav.register")} icon={<UserPlus size={iconSize} />} />
            </>
          )}
        </div>
      </aside>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-1 items-stretch border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)] md:hidden"
        aria-label="Main navigation"
      >
        {token ? (
          bottomBarItems.map((item) => (
            <NavLinkItem
              key={item.to}
              to={item.to}
              label={t(item.labelKey)}
              icon={item.icon}
              active={location.pathname === item.to}
              iconOnly
            />
          ))
        ) : (
          <>
            <NavLinkItem to="/search" label={t("nav.search")} icon={<Search size={iconSize} />} active={location.pathname === "/search"} iconOnly />
            <NavLinkItem to="/tiers" label={t("nav.plans")} icon={<CreditCard size={iconSize} />} active={location.pathname === "/tiers"} iconOnly />
            <NavLinkItem to="/about" label={t("nav.about")} icon={<Info size={iconSize} />} active={location.pathname === "/about"} iconOnly />
            <NavLinkItem to="/login" label={t("nav.logIn")} icon={<LogIn size={iconSize} />} active={location.pathname === "/login"} iconOnly />
            <NavLinkItem to="/register" label={t("nav.register")} icon={<UserPlus size={iconSize} />} active={location.pathname === "/register"} iconOnly />
          </>
        )}
      </nav>
    </>
  );
}
