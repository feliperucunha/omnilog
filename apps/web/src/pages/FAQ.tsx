import { useEffect } from "react";
import { useSupportEmail } from "@/hooks/useSupportEmail";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;

export function FAQ() {
  const { t } = useLocale();
  const { setPageTitle } = usePageTitle() ?? {};
  const supportEmail = useSupportEmail();
  useEffect(() => {
    setPageTitle?.(t("faq.title"));
    return () => setPageTitle?.(null);
  }, [t, setPageTitle]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <h1 className="min-w-0 text-2xl font-semibold text-[var(--color-lightest)]">
        <OverflowMarquee>{t("faq.title")}</OverflowMarquee>
      </h1>
      <p className="text-sm text-[var(--color-light)]">{t("faq.intro")}</p>
      <ul className="flex flex-col gap-4">
        {FAQ_KEYS.map((key) => (
          <li key={key}>
            <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 sm:p-5">
              <h2 className="min-w-0 text-base font-semibold text-[var(--color-lightest)]">
                <OverflowMarquee>{t(`faq.${key}Title`)}</OverflowMarquee>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-light)] whitespace-pre-wrap">
                {key === "q5" ? t("faq.q5Body", { email: supportEmail }) : t(`faq.${key}Body`)}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
