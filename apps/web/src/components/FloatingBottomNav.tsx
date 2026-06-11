import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { LayoutGroup, motion } from "framer-motion";
import {
  Home,
  BarChart3,
  Search,
  Settings,
  LogIn,
  UserPlus,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { navItemIsActive } from "@/lib/mainNav";
import { useDashboardNavPath, useSearchNavPath } from "@/lib/searchNavigation";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";

const ICON_SIZE = 22;

type NavItem = {
  to: string;
  labelKey: string;
  icon: LucideIcon;
};

const AUTH_ITEMS: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: Home },
  { to: "/statistics", labelKey: "nav.statistics", icon: BarChart3 },
  { to: "/", labelKey: "nav.search", icon: Search },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];

const GUEST_ITEMS: NavItem[] = [
  { to: "/", labelKey: "nav.search", icon: Search },
  { to: "/dashboard", labelKey: "nav.dashboard", icon: Home },
  { to: "/tiers", labelKey: "nav.plans", icon: CreditCard },
  { to: "/login", labelKey: "nav.logIn", icon: LogIn },
  { to: "/register", labelKey: "nav.register", icon: UserPlus },
];

function DockTab({
  to,
  label,
  icon: Icon,
  isActive,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "relative z-[1] flex min-h-[44px] min-w-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5",
        "text-[var(--color-light)] transition-colors duration-200 [-webkit-tap-highlight-color:transparent]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-gradient-start)]/50",
        isActive && "text-[var(--btn-gradient-start)]"
      )}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
    >
      {isActive ? (
        <motion.span
          layoutId="floating-dock-active"
          className="absolute inset-0 rounded-2xl bg-[var(--btn-gradient-start)]/14 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--btn-gradient-start)_25%,transparent)]"
          transition={springSoft}
        />
      ) : null}
      <Icon
        size={ICON_SIZE}
        strokeWidth={isActive ? 2.25 : 1.85}
        className={cn("relative z-[1] shrink-0", isActive && "text-[var(--btn-gradient-start)]")}
        aria-hidden
      />
      <span
        className={cn(
          "relative z-[1] max-w-full truncate text-center text-[10px] font-medium leading-tight",
          isActive && "text-[var(--btn-gradient-start)]"
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function FloatingBottomNav() {
  const { t } = useLocale();
  const { token } = useAuth();
  const location = useLocation();
  const dockRef = useRef<HTMLDivElement>(null);

  const searchNavPath = useSearchNavPath();
  const dashboardNavPath = useDashboardNavPath();
  const items = (token ? AUTH_ITEMS : GUEST_ITEMS).map((item) => {
    if (item.to === "/") return { ...item, to: searchNavPath };
    if (item.to === "/dashboard") return { ...item, to: dashboardNavPath };
    return item;
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    const ae = document.activeElement;
    if (!(ae instanceof HTMLElement) || ae.tagName !== "A") return;
    if (ae.closest("[data-floating-dock]")) ae.blur();
  }, [location.pathname, location.search, location.hash]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden pointer-events-none"
      data-floating-dock
    >
      <LayoutGroup id="floating-dock">
        <nav
          ref={dockRef}
          className="glass-dock pointer-events-auto flex w-full max-w-md items-stretch gap-0.5 rounded-[1.75rem] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          aria-label="Main navigation"
        >
          {items.map((item) => (
          <DockTab
            key={item.to}
            to={item.to}
            label={t(item.labelKey)}
            icon={item.icon}
            isActive={navItemIsActive(item.to, location.pathname)}
          />
          ))}
        </nav>
      </LayoutGroup>
    </div>
  );
}
