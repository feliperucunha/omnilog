import { Outlet, Link } from "react-router-dom";
import { useLocale } from "@/contexts/LocaleContext";
import { Logo } from "@/components/Logo";

export function PublicProfileLayout() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden">
      <header className="flex shrink-0 items-center border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)] px-4 py-3 md:px-6">
        <Link
          to="/"
          className="flex items-center text-[var(--color-lightest)] no-underline hover:opacity-90 transition-opacity"
        >
          <Logo alt={t("app.name")} className="h-12 w-auto flex-shrink-0 sm:h-14" />
          <span className="brand-title -ml-3 sm:-ml-4 font-bold text-xl sm:text-2xl text-(--btn-gradient-end) dark:text-(--btn-gradient-start)">
            {t("app.name")}
          </span>
        </Link>
      </header>
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
