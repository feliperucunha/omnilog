import { Outlet, Link } from "react-router-dom";
import { useLocale } from "@/contexts/LocaleContext";

export function PublicProfileLayout() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden">
      <header className="flex shrink-0 items-center border-b border-[var(--color-dark)] px-4 py-3 md:px-6">
        <Link
          to="/"
          className="text-lg font-bold text-[var(--color-lightest)] no-underline hover:underline"
        >
          {t("app.name")}
        </Link>
      </header>
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
