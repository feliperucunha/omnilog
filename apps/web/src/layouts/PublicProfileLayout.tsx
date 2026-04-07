import { Outlet, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { Logo } from "@/components/Logo";

export function PublicProfileLayout() {
  const { t } = useLocale();
  return (
    <div className="flex h-dvh min-h-dvh min-w-0 flex-col overflow-hidden">
      <header className="z-30 flex shrink-0 items-center border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)] px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 md:px-4 md:pt-3">
        <Link
          to="/"
          className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg py-1.5 pl-1 pr-2 text-[var(--color-lightest)] no-underline outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] md:gap-2 md:pl-2"
          aria-label={`${t("common.back")} — ${t("app.name")}`}
        >
          <ChevronLeft className="h-7 w-7 shrink-0 text-[var(--color-light)] md:h-8 md:w-8" aria-hidden strokeWidth={2.25} />
          <Logo alt="" className="h-10 w-auto shrink-0 sm:h-12" />
          <span className="brand-title min-w-0 truncate font-bold text-lg text-(--btn-gradient-end) dark:text-(--btn-gradient-start) sm:text-xl md:text-2xl">
            {t("app.name")}
          </span>
        </Link>
      </header>
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
