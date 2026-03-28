import { useEffect } from "react";
import { useSupportEmail } from "@/hooks/useSupportEmail";
import { motion } from "framer-motion";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";

export function Terms() {
  const { t } = useLocale();
  const { setPageTitle } = usePageTitle() ?? {};
  const supportEmail = useSupportEmail();

  useEffect(() => {
    setPageTitle?.(t("legal.termsTitle"));
    return () => setPageTitle?.(null);
  }, [t, setPageTitle]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-2xl space-y-4 text-sm leading-relaxed text-[var(--color-light)]"
    >
      <h1 className="min-w-0 text-2xl font-semibold text-[var(--color-lightest)]">
        <OverflowMarquee>{t("legal.termsTitle")}</OverflowMarquee>
      </h1>
      <p className="whitespace-pre-wrap">{t("legal.termsIntro", { email: supportEmail })}</p>
      <p className="whitespace-pre-wrap">{t("legal.termsAcceptable")}</p>
      <p className="whitespace-pre-wrap">{t("legal.termsThirdParty")}</p>
      <p className="whitespace-pre-wrap">{t("legal.termsSubscription")}</p>
      <p className="whitespace-pre-wrap">{t("legal.termsContact", { email: supportEmail })}</p>
    </motion.article>
  );
}
