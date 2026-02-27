import { motion } from "framer-motion";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { TiersSkeleton } from "@/components/skeletons";

const FREE_LOG_LIMIT = 500;

export function Tiers() {
  const { t } = useLocale();
  const { token } = useAuth();
  const { me, refetch, loading } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const canceled = searchParams.get("canceled");
    if (sessionId) {
      toast.success(t("tiers.upgradeSuccess"));
      refetch();
      setSearchParams({}, { replace: true });
    } else if (canceled === "1") {
      toast.info(t("tiers.upgradeCanceled"));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, refetch, t]);

  const tier = me?.tier ?? "free";
  const logCount = me?.logCount ?? 0;
  const isPro = tier === "pro";
  const isBrazil = me?.country === "BR";
  const proPriceLabel = isBrazil ? t("tiers.proPriceBr") : t("tiers.proPrice");

  if (token && loading) return <TiersSkeleton />;

  const handleUpgradeToPro = async () => {
    setCheckoutLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/stripe/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (err) {
      setCheckoutLoading(false);
      const message = err instanceof Error ? err.message : t("tiers.upgradeError");
      toast.error(message);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/stripe/create-portal-session", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No portal URL returned");
    } catch (err) {
      setPortalLoading(false);
      const message = err instanceof Error ? err.message : t("tiers.manageSubscriptionError");
      toast.error(message);
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
              ? t("tiers.usageUnlimited", { count: String(logCount) })
              : t("tiers.usage", { count: String(logCount), limit: String(FREE_LOG_LIMIT) })}
          </p>
          {token && isPro && (
            <Button
              type="button"
              variant="outline"
              className="mt-3 border-[var(--color-mid)] text-[var(--color-light)] hover:bg-[var(--color-mid)]/30"
              disabled={portalLoading}
              onClick={handleManageSubscription}
            >
              {portalLoading ? t("tiers.redirecting") : t("tiers.manageSubscription")}
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
              {t("tiers.usage", { count: String(logCount), limit: String(FREE_LOG_LIMIT) })}
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
            {proPriceLabel}
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
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              {t("tiers.proNoAds")}
            </li>
          </ul>
          {token && !isPro && (
            <Button
              type="button"
              className="btn-gradient mt-4 w-full"
              disabled={checkoutLoading}
              onClick={handleUpgradeToPro}
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t("tiers.redirecting")}
                </>
              ) : (
                t("tiers.upgradeToPro")
              )}
            </Button>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
