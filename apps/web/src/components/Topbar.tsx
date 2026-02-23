import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Search, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Topbar() {
  const { t } = useLocale();
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const isSearchPage = location.pathname === "/search";

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate("/search", { state: { query: q } });
    else navigate("/search");
  };

  const handleLogout = () => {
    logout();
    toast.success(t("toast.loggedOut"));
    navigate("/login");
  };

  const initial = user?.email?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <header
      className={cn(
        "flex h-14 flex-shrink-0 items-center gap-4 border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-4"
      )}
    >
      {!isSearchPage && (
        <form onSubmit={handleSearchSubmit} className="relative flex flex-1 items-center max-w-md">
          <span className="pointer-events-none absolute left-3 flex size-5 items-center justify-center text-[var(--color-lightest)]" aria-hidden>
            <Search className="size-5" />
          </span>
          <Input
            type="search"
            placeholder={t("search.searchPlaceholder", { type: t("nav.search").toLowerCase() })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-10 pr-4 border-2 border-[var(--color-lightest)]/80 bg-[var(--color-darkest)] text-[var(--color-lightest)] placeholder:text-[var(--color-lightest)] focus-visible:border-[var(--color-lightest)] focus-visible:ring-[var(--color-lightest)]/30"
            aria-label={t("nav.search")}
          />
        </form>
      )}

      {token && user && (
        <div className="ml-auto flex-shrink-0">
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
            <div className="px-2 py-2">
              <ThemeSwitcher />
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
        </div>
      )}
    </header>
  );
}
