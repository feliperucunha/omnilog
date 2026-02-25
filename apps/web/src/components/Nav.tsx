import { NavLink, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Film,
  Tv,
  Dice5,
  Gamepad2,
  BookOpen,
  Flower2,
  BookMarked,
  Library,
  Search,
  LogIn,
  UserPlus,
  Info,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import type { MediaType } from "@logeverything/shared";
import { cn } from "@/lib/utils";

const iconSize = 18;

const MEDIA_TYPE_NAV: Record<MediaType, { labelKey: string; icon: React.ReactNode }> = {
  movies: { labelKey: "nav.movies", icon: <Film size={iconSize} /> },
  tv: { labelKey: "nav.tv", icon: <Tv size={iconSize} /> },
  boardgames: { labelKey: "nav.boardgames", icon: <Dice5 size={iconSize} /> },
  games: { labelKey: "nav.games", icon: <Gamepad2 size={iconSize} /> },
  books: { labelKey: "nav.books", icon: <BookOpen size={iconSize} /> },
  anime: { labelKey: "nav.anime", icon: <Flower2 size={iconSize} /> },
  manga: { labelKey: "nav.manga", icon: <Library size={iconSize} /> },
  comics: { labelKey: "nav.comics", icon: <BookMarked size={iconSize} /> },
};

function NavLinkItem({
  to,
  label,
  icon,
  active,
  className,
  showKeyWarning,
  ariaLabelWarning,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  className?: string;
  showKeyWarning?: boolean;
  ariaLabelWarning?: string;
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-lightest)] transition-colors hover:bg-[var(--color-mid)]/50",
        active && "bg-[var(--color-mid)]/50",
        className
      )}
      aria-label={ariaLabelWarning ? `${label} (${ariaLabelWarning})` : undefined}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {showKeyWarning && (
        <AlertTriangle
          className="h-4 w-4 flex-shrink-0 text-amber-400"
          aria-hidden
        />
      )}
    </NavLink>
  );
}

export function Nav() {
  const { t } = useLocale();
  const { token } = useAuth();
  const { me } = useMe();
  const location = useLocation();
  const { visibleTypes } = useVisibleMediaTypes();

  const navItems: { to: string; labelKey: string; icon: React.ReactNode; mediaType?: MediaType }[] = [
    { to: "/", labelKey: "nav.dashboard", icon: <LayoutDashboard size={iconSize} /> },
    ...visibleTypes.map((type) => ({
      to: `/${type}`,
      labelKey: MEDIA_TYPE_NAV[type].labelKey,
      icon: MEDIA_TYPE_NAV[type].icon,
      mediaType: type,
    })),
    { to: "/search", labelKey: "nav.search", icon: <Search size={iconSize} /> },
    { to: "/about", labelKey: "nav.about", icon: <Info size={iconSize} /> },
  ];

  const getKeyWarning = (item: (typeof navItems)[0]) => {
    if (!token || !me?.apiKeys || !item.mediaType) return false;
    const provider = getApiKeyProviderForMediaType(item.mediaType);
    if (!provider) return false;
    return !me.apiKeys[provider];
  };

  return (
    <>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-[var(--color-mid)]/30 bg-[var(--color-dark)] md:flex"
      >
        <Link
          to="/"
          className="flex h-14 items-center gap-3 border-b border-[var(--color-mid)]/30 pl-4 text-[var(--color-lightest)] no-underline"
        >
          <img src="/logo.svg" alt="OMNILOG" className="h-16 w-auto flex-shrink-0" />
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
                  showKeyWarning={getKeyWarning(item)}
                  ariaLabelWarning={getKeyWarning(item) ? t("nav.apiKeyWarning") : undefined}
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
              <NavLinkItem to="/login" label={t("nav.logIn")} icon={<LogIn size={iconSize} />} />
              <NavLinkItem to="/register" label={t("nav.register")} icon={<UserPlus size={iconSize} />} />
            </>
          )}
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-1 overflow-x-auto border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-2 scrollbar-hide md:hidden">
        {token ? (
          <>
            {navItems.map((item) => (
              <NavLinkItem
                key={item.to}
                to={item.to}
                label={t(item.labelKey)}
                icon={item.icon}
                className="min-w-fit flex-shrink-0"
                showKeyWarning={getKeyWarning(item)}
                ariaLabelWarning={getKeyWarning(item) ? t("nav.apiKeyWarning") : undefined}
              />
            ))}
          </>
        ) : (
          <>
            <NavLinkItem
              to="/search"
              label={t("nav.search")}
              icon={<Search size={iconSize} />}
              className="min-w-fit flex-shrink-0"
            />
            <NavLinkItem to="/about" label={t("nav.about")} icon={<Info size={iconSize} />} className="min-w-fit flex-shrink-0" />
            <NavLinkItem to="/login" label={t("nav.logIn")} icon={<LogIn size={iconSize} />} className="min-w-fit flex-shrink-0" />
            <NavLinkItem to="/register" label={t("nav.register")} icon={<UserPlus size={iconSize} />} className="min-w-fit flex-shrink-0" />
          </>
        )}
      </nav>
    </>
  );
}
