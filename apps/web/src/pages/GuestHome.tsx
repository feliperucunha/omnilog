import { Link } from "react-router-dom";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Button } from "@/components/ui/button";
import { Search, LogIn, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

export function GuestHome() {
  const { t } = useLocale();
  usePageTitle?.()?.setPageTitle(t("nav.dashboard"));

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-8 py-12 text-center max-w-md mx-auto"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <p className="text-lg text-[var(--color-light)]">
        {t("app.subtitle")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="default" size="lg" className="gap-2">
          <Link to="/search">
            <Search className="size-4" aria-hidden />
            {t("nav.search")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="gap-2">
          <Link to="/login">
            <LogIn className="size-4" aria-hidden />
            {t("nav.logIn")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="gap-2">
          <Link to="/register">
            <UserPlus className="size-4" aria-hidden />
            {t("nav.register")}
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
