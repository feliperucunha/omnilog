import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Download, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetchFile } from "@/lib/api";
import { toast } from "sonner";

const FREE_LOG_LIMIT = 500;

export function Tiers() {
  const { t } = useLocale();
  const { token } = useAuth();
  const { me } = useMe();
  const [exporting, setExporting] = useState(false);

  const tier = me?.tier ?? "free";
  const logCount = me?.logCount ?? 0;
  const isPro = tier === "pro";

  const handleExport = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await apiFetchFile("/logs/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("tiers.exportSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tiers.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="mx-auto max-w-4xl space-y-8 px-4 py-6 pb-24 md:pb-20"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--color-lightest)] sm:text-3xl">
          {t("tiers.title")}
        </h1>
        <p className="mt-2 text-[var(--color-light)]">
          {t("tiers.subtitle")}
        </p>
      </div>

      {token && me && (
        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-4 shadow-[var(--shadow-md)]">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-light)]">
            <span>{t("tiers.currentPlan")}:</span>
            {isPro ? (
              <span className="inline-flex items-center gap-1 rounded bg-[var(--btn-gradient-start)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--btn-gradient-start)]">
                <Sparkles className="h-3 w-3" aria-hidden />
                {t("tiers.pro")}
              </span>
            ) : (
              t("tiers.free")
            )}
          </p>
          <p className="mt-1 text-sm text-[var(--color-light)]">
            {isPro
              ? t("tiers.usageUnlimited", { count: logCount })
              : t("tiers.usage", { count: logCount, limit: FREE_LOG_LIMIT })}
          </p>
          {isPro && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="h-4 w-4" aria-hidden />
              {exporting ? t("common.saving") : t("tiers.exportLogs")}
            </Button>
          )}
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card
          className="relative flex flex-col border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-card)]"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h2 className="text-lg font-semibold text-[var(--color-lightest)]">
            {t("tiers.free")}
          </h2>
          <p className="mt-1 text-2xl font-bold text-[var(--color-lightest)]">
            {t("tiers.freePrice")}
          </p>
          <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-[var(--color-light)]">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              {t("tiers.freeLogs")}
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              {t("tiers.freeLogsDesc")}
            </li>
          </ul>
          {token && !isPro && (
            <p className="mt-4 text-xs text-[var(--color-light)]">
              {t("tiers.usage", { count: logCount, limit: FREE_LOG_LIMIT })}
            </p>
          )}
        </Card>

        <Card
          className="relative flex flex-col border-[var(--color-mid)]/50 bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <div className="absolute -top-2 right-4 flex items-center gap-1 rounded-full bg-[var(--btn-gradient-start)]/20 px-2 py-0.5 text-xs font-medium text-[var(--btn-gradient-start)]">
            <Sparkles className="h-3 w-3" aria-hidden />
            {t("tiers.pro")}
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-lightest)]">
            {t("tiers.pro")}
          </h2>
          <p className="mt-1 text-2xl font-bold text-[var(--color-lightest)]">
            {t("tiers.proPrice")}
          </p>
          <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-[var(--color-light)]">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              {t("tiers.proLogs")}
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              {t("tiers.proExport")}
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              {t("tiers.proExportDesc")}
            </li>
          </ul>
          {token && !isPro && (
            <Button
              type="button"
              className="btn-gradient mt-4 w-full"
              onClick={() => {
                toast.info(
                  "Payment integration coming soon. For now, contact support to upgrade to Pro."
                );
              }}
            >
              {t("tiers.upgradeToPro")}
            </Button>
          )}
          {token && isPro && (
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full gap-2"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="h-4 w-4" aria-hidden />
              {exporting ? t("common.saving") : t("tiers.exportLogs")}
            </Button>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
