import { Link, useLocation } from "react-router-dom";
import {
  Library,
  Compass,
  Activity,
  Search,
  UserRound,
  LogIn,
  UserPlus,
  Info,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Logo } from "@/components/Logo";
import { FloatingBottomNav } from "@/components/FloatingBottomNav";
import { navItemIsActive } from "@/lib/mainNav";
import { useDashboardNavPath, useSearchNavPath } from "@/lib/searchNavigation";
import { cn } from "@/lib/utils";

const iconSize = 18;

function NavLinkItem({
  to,
  label,
  icon,
  className,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  className?: string;
}) {
  const { pathname } = useLocation();
  const isActive = navItemIsActive(to, pathname);

  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] font-semibold text-[var(--color-light)] transition-colors hover:bg-[var(--color-mid)]/40 [-webkit-tap-highlight-color:transparent]",
        isActive && "bg-[color-mix(in_srgb,var(--btn-gradient-start)_16%,transparent)] text-[var(--color-lightest)]",
        className
      )}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
    >
      <span className="flex shrink-0 items-center justify-center">{icon}</span>
      <span
        className="max-w-full truncate text-center text-[11px] font-semibold leading-tight"
        title={label}
      >
        {label}
      </span>
    </Link>
  );
}

export function Nav() {
  const { t } = useLocale();
  const { token } = useAuth();
  const searchNavPath = useSearchNavPath();
  const dashboardNavPath = useDashboardNavPath();

  const navItems: { to: string; labelKey: string; icon: React.ReactNode }[] = [
    { to: dashboardNavPath, labelKey: "nav.dashboard", icon: <Library size={iconSize} /> },
    { to: "/discover", labelKey: "nav.discover", icon: <Compass size={iconSize} /> },
    { to: "/statistics", labelKey: "nav.statistics", icon: <Activity size={iconSize} /> },
    { to: searchNavPath, labelKey: "nav.search", icon: <Search size={iconSize} /> },
    { to: "/settings", labelKey: "nav.settings", icon: <UserRound size={iconSize} /> },
  ];

  return (
    <>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen w-[6.5rem] flex-col border-r border-[var(--color-surface-border)] bg-[var(--color-dark)] md:flex"
      >
        <Link
          to={token ? "/dashboard" : "/"}
          className="flex flex-col items-center gap-1 px-2 pb-3 pt-3 text-[var(--color-lightest)] no-underline"
        >
          <Logo alt={t("app.name")} className="h-8 w-8 flex-shrink-0 object-contain" />
          <span className="brand-title max-w-full truncate text-[13px] font-semibold" title={t("app.name")}>
            {t("app.name")}
          </span>
        </Link>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3" aria-label="Main navigation">
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
                to={dashboardNavPath}
                label={t("nav.dashboard")}
                icon={<Library size={iconSize} />}
              />
              <NavLinkItem
                to={searchNavPath}
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

      <FloatingBottomNav />
    </>
  );
}
