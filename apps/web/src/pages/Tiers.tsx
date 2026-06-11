import { motion } from "framer-motion";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useMe } from "@/contexts/MeContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { TiersSkeleton } from "@/components/skeletons";
import { tierHasUnlimitedLogs } from "@/lib/userTier";
import { isCapacitorNative } from "@/lib/androidOverlayBack";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { buildNativeProCheckoutUrl, buildWebLoginUrlWithFromPath } from "@/lib/publicWebOrigin";
import { useAppPtrRefresh } from "@/hooks/useAppPtrRefresh";

const FREE_LOG_LIMIT = 500;

/** Numeric prices for savings calculation (must match locale strings). */
const PRO_PRICES = {
  default: { monthly: 5, yearly: 50 },
  BR: { monthly: 20, yearly: 200 },
} as const;

export function Tiers() {
  const { t, locale } = useLocale();
  const { token } = useAuth();
  const { me, refetch, loading } = useMe();
  const { setPageTitle } = usePageTitle() ?? {};
  const [searchParams, setSearchParams] = useSearchParams();
  const initialInterval: "monthly" | "yearly" = (() => {
    const v = searchParams.get("interval");
    if (v === "monthly" || v === "yearly") return v;
    return "yearly";
  })();
  const [interval, setInterval] = useState<"monthly" | "yearly">(initialInterval);
  useEffect(() => {
    setPageTitle?.(t("tiers.title"));
    return () => setPageTitle?.(null);
  }, [t, setPageTitle]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const checkoutInFlightRef = useRef(false);
  const portalInFlightRef = useRef(false);
  const cancelInFlightRef = useRef(false);
  const resumeInFlightRef = useRef(false);
  const processedCheckoutReturnRef = useRef<string | null>(null);
  const intervalInitializedRef = useRef(false);

  useEffect(() => {
    if (intervalInitializedRef.current || !me) return;
    intervalInitializedRef.current = true;
    if (searchParams.get("interval")) return;
    if (me.subscriptionInterval === "monthly" || me.subscriptionInterval === "yearly") {
      setInterval(me.subscriptionInterval);
    }
  }, [me, searchParams]);

  useEffect(() => {
    const approved = searchParams.get("approved");
    const canceled = searchParams.get("canceled");
    const sessionId = searchParams.get("session_id");
    if (approved !== "1" && canceled !== "1") {
      processedCheckoutReturnRef.current = null;
      return;
    }
    const key = searchParams.toString();
    if (processedCheckoutReturnRef.current === key) return;
    processedCheckoutReturnRef.current = key;

    void (async () => {
      if (approved === "1") {
        if (sessionId) {
          try {
            await apiFetch<{ ok: boolean }>("/stripe/confirm-checkout-session", {
              method: "POST",
              body: JSON.stringify({ sessionId }),
            });
          } catch (err) {
            console.error("[checkout confirm]", err);
          }
        }
        await refetch();
        toast.success(t("tiers.upgradeSuccess"));
        setSearchParams({}, { replace: true });
      } else if (canceled === "1") {
        toast.info(t("tiers.upgradeCanceled"));
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams, setSearchParams, refetch, t]);

  /** When returning to the native shell (e.g. from the browser after paying on the website), refresh tier. */
  useEffect(() => {
    if (!isCapacitorNative() || !token) return;
    let remove: (() => void) | undefined;
    void import("@capacitor/app").then(({ App }) => {
      void App.addListener("resume", () => {
        void refetch();
      }).then((handle) => {
        remove = () => handle.remove();
      });
    });
    return () => {
      remove?.();
    };
  }, [token, refetch]);

  useAppPtrRefresh(() => {
    void refetch();
  });

  const tier = me?.tier ?? "free";
  const logCount = me?.logCount ?? 0;
  const daysRemaining = me?.daysRemaining ?? null;
  const isPayingPro = tier === "pro";
  const isBeta = tier === "beta";
  const isAdmin = tier === "admin";
  const isCancelledPro =
    isPayingPro && !isAdmin && !!me?.subscriptionCancelAtPeriodEnd;
  const subscriptionEndDateLabel = (() => {
    if (!me?.subscriptionEndsAt) return null;
    const d = new Date(me.subscriptionEndsAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  })();
  const hasUnlimitedLogs = tierHasUnlimitedLogs(tier);
  const isBrazil = me?.country === "BR";
  const proPriceMonthlyLabel = isBrazil ? t("tiers.proPriceBrMonthly") : t("tiers.proPriceMonthly");
  const proPriceYearlyLabel = isBrazil ? t("tiers.proPriceBrYearly") : t("tiers.proPriceYearly");
  const prices = isBrazil ? PRO_PRICES.BR : PRO_PRICES.default;
  const yearlySavePercent =
    Math.round((1 - prices.yearly / (prices.monthly * 12)) * 100) || 0;

  if (token && loading) return <TiersSkeleton />;

  const openGeeklogsWebForBilling = async (pathWithQuery: string) => {
    const url = buildWebLoginUrlWithFromPath(pathWithQuery);
    if (isCapacitorNative()) {
      await openExternalUrl(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    toast.info(t("tiers.billingOnGeeklogsWeb"));
  };

  const handleSubscribe = async () => {
    if (checkoutInFlightRef.current) return;
    checkoutInFlightRef.current = true;

    // Native: open geeklogs.com.br (login → /tiers) in the system browser. Web: in-app Stripe checkout.
    if (isCapacitorNative()) {
      setCheckoutLoading(true);
      try {
        const url = buildNativeProCheckoutUrl(interval);
        await openExternalUrl(url);
        toast.info(t("tiers.paymentCompleteInBrowser"));
      } catch (err) {
        showErrorToast(t, "E025", { originalError: err });
      } finally {
        setCheckoutLoading(false);
        checkoutInFlightRef.current = false;
      }
      return;
    }

    setCheckoutLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/stripe/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ interval }),
      });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        toast.error(err.message);
        console.error("[checkout conflict]", err);
      } else {
        showErrorToast(t, "E025", { originalError: err });
      }
    } finally {
      setCheckoutLoading(false);
      checkoutInFlightRef.current = false;
    }
  };

  const handleManageSubscription = async () => {
    if (portalInFlightRef.current) return;
    portalInFlightRef.current = true;

    if (me?.billingProvider === "google_play") {
      setPortalLoading(true);
      try {
        await openGeeklogsWebForBilling("/tiers");
      } catch (err) {
        showErrorToast(t, "E099", { originalError: err });
      } finally {
        setPortalLoading(false);
        portalInFlightRef.current = false;
      }
      return;
    }

    setPortalLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/stripe/create-portal-session", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (data?.url) {
        if (isCapacitorNative()) {
          await openExternalUrl(data.url);
          toast.info(t("tiers.manageOpensInBrowser"));
        } else {
          window.location.href = data.url;
        }
        return;
      }
      throw new Error("No portal URL returned");
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 400 && err.message) {
        toast.error(err.message);
        console.error("[portal]", err);
      } else {
        showErrorToast(t, "E099", { originalError: err });
      }
    } finally {
      setPortalLoading(false);
      portalInFlightRef.current = false;
    }
  };

  const handleCancelSubscription = async () => {
    if (me?.billingProvider === "google_play") {
      if (cancelInFlightRef.current) return;
      cancelInFlightRef.current = true;
      setCancelLoading(true);
      try {
        await openGeeklogsWebForBilling("/tiers");
      } catch (err) {
        showErrorToast(t, "E023", { originalError: err });
      } finally {
        setCancelLoading(false);
        cancelInFlightRef.current = false;
      }
      return;
    }

    if (cancelInFlightRef.current) return;
    cancelInFlightRef.current = true;
    setCancelLoading(true);
    try {
      await apiFetch<{ ok: boolean }>("/stripe/cancel-subscription", { method: "POST" });
      toast.success(t("tiers.cancelSubscriptionSuccess"));
      await refetch();
    } catch {
      try {
        const data = await apiFetch<{ url: string }>("/stripe/create-portal-session", {
          method: "POST",
          body: JSON.stringify({}),
        });
        if (data?.url) {
          if (isCapacitorNative()) {
            await openExternalUrl(data.url);
            toast.info(t("tiers.manageOpensInBrowser"));
          } else {
            window.location.href = data.url;
          }
          return;
        }
      } catch {
        // fall through
      }
      showErrorToast(t, "E023");
    } finally {
      setCancelLoading(false);
      cancelInFlightRef.current = false;
    }
  };

  const handleResumeSubscription = async () => {
    if (me?.billingProvider === "google_play") {
      try {
        await openGeeklogsWebForBilling("/tiers");
      } catch (err) {
        showErrorToast(t, "E026", { originalError: err });
      }
      return;
    }
    if (resumeInFlightRef.current) return;
    resumeInFlightRef.current = true;
    setResumeLoading(true);
    try {
      await apiFetch<{ ok: boolean }>("/stripe/resume-subscription", {
        method: "POST",
        body: JSON.stringify({ interval }),
      });
      toast.success(t("tiers.resumeSuccess"));
      await refetch();
    } catch (err) {
      showErrorToast(t, "E026", { originalError: err });
    } finally {
      setResumeLoading(false);
      resumeInFlightRef.current = false;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="mx-auto max-w-4xl space-y-8 px-0 py-6 pb-24 md:px-4 md:pb-20"
    >
      <div className="text-center">
        <p className="mt-2 text-[var(--color-light)]">
          {t("tiers.subtitle")}
        </p>
        {isCapacitorNative() ? (
          <p className="mt-2 text-xs text-[var(--color-light)]">
            {t("tiers.paymentMethodWebsite")}
          </p>
        ) : (
          <p className="mt-2 text-xs text-[var(--color-light)]">
            {t("tiers.paymentMethodStripe")}
          </p>
        )}
      </div>

      {token && me && (
        <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 shadow-[var(--shadow-md)]">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-light)]">
            <span>{t("tiers.currentPlan")}:</span>
            {isAdmin ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-500">
                {t("tiers.admin")}
              </span>
            ) : isPayingPro ? (
              <span className="inline-flex items-center gap-1 rounded bg-[var(--btn-gradient-start)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--btn-gradient-start)]">
                <Sparkles className="h-3 w-3" aria-hidden />
                {t("tiers.pro")}
              </span>
            ) : isBeta ? (
              <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-400">
                {t("tiers.beta")}
              </span>
            ) : (
              t("tiers.free")
            )}
          </p>
          <p className="mt-1 text-sm text-[var(--color-light)]">
            {hasUnlimitedLogs
              ? t("tiers.usageUnlimited", { count: String(logCount) })
              : t("tiers.usage", { count: String(logCount), limit: String(FREE_LOG_LIMIT) })}
          </p>
          {token && isPayingPro && !isAdmin && isCancelledPro && subscriptionEndDateLabel && (
            <p className="mt-1 text-sm text-[var(--color-light)]">
              {t("tiers.subscriptionEndsOn", { date: subscriptionEndDateLabel })}
            </p>
          )}
          {token && isPayingPro && !isAdmin && daysRemaining != null && (
            <p className="mt-1 text-sm text-[var(--color-light)]">
              {daysRemaining === 1
                ? t("tiers.daysLeftOne")
                : t("tiers.daysLeft", { count: String(daysRemaining) })}
            </p>
          )}
          {token && isPayingPro && !isAdmin && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-[var(--color-mid)] text-[var(--color-light)] hover:bg-[var(--color-mid)]/30"
                disabled={portalLoading || cancelLoading || resumeLoading}
                onClick={handleManageSubscription}
              >
                {portalLoading ? t("tiers.redirecting") : t("tiers.manageSubscription")}
              </Button>
              {!isCancelledPro && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                  disabled={portalLoading || cancelLoading}
                  onClick={handleCancelSubscription}
                >
                  {cancelLoading ? t("tiers.canceling") : t("tiers.cancelSubscription")}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card
          className="relative flex flex-col border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-card)]"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h2 className="min-w-0 text-lg font-semibold text-[var(--color-lightest)]">
            <OverflowMarquee>{t("tiers.free")}</OverflowMarquee>
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
          {token && !hasUnlimitedLogs && (
            <p className="mt-4 text-xs text-[var(--color-light)]">
              {t("tiers.usage", { count: String(logCount), limit: String(FREE_LOG_LIMIT) })}
            </p>
          )}
        </Card>

        <Card
          className="relative flex flex-col border-[var(--color-mid)]/50 bg-[var(--color-dark)] p-6"
          style={{
            boxShadow:
              "0 1px 3px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.35), 0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(65, 90, 119, 0.15)",
          }}
        >
          <div className="absolute -top-2 right-4 flex items-center gap-1 rounded-full bg-[var(--btn-gradient-start)] px-2 py-0.5 text-xs font-medium text-[var(--btn-gradient-start)]">
            <span className="text-white">
              {t("tiers.pro")}
            </span>
          </div>
          <h2 className="min-w-0 text-lg font-semibold text-[var(--color-lightest)]">
            <OverflowMarquee>{t("tiers.pro")}</OverflowMarquee>
          </h2>
          {token && (isCancelledPro || (!isPayingPro && !isAdmin)) && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-[var(--color-light)]">{t("tiers.billingInterval")}</p>
              <ToggleGroup
                type="single"
                value={interval}
                onValueChange={(v) => v && setInterval(v as "monthly" | "yearly")}
                disabled={checkoutLoading}
                className="inline-flex rounded-md border border-[var(--color-mid)]/30 p-0.5 gap-0"
                aria-label={t("tiers.billingInterval")}
              >
                <ToggleGroupItem
                  value="monthly"
                  className="flex-1 px-4 py-2 text-sm data-[state=on]:bg-[var(--color-mid)]/50 data-[state=on]:text-[var(--color-lightest)]"
                  aria-label={t("tiers.monthly")}
                >
                  {t("tiers.monthly")}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="yearly"
                  className="flex-1 px-4 py-2 text-sm data-[state=on]:bg-[var(--color-mid)]/50 data-[state=on]:text-[var(--color-lightest)]"
                  aria-label={t("tiers.yearly")}
                >
                  {t("tiers.yearly")}
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="flex flex-wrap items-center gap-2">
                {interval === "yearly" && yearlySavePercent > 0 ? (
                  <>
                    <span className="text-lg font-bold text-[var(--color-light)] line-through">
                      {isBrazil
                        ? `R$ ${prices.monthly * 12}`
                        : `$${prices.monthly * 12}`}
                    </span>
                    <span className="text-lg font-bold text-[var(--color-lightest)]">
                      {proPriceYearlyLabel}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                      {t("tiers.yearlySavePercent", { percent: String(yearlySavePercent) })}
                    </span>
                  </>
                ) : (
                  <span className="text-lg font-bold text-[var(--color-lightest)]">
                    {proPriceMonthlyLabel}
                  </span>
                )}
              </div>
            </div>
          )}
          {token && isPayingPro && !isCancelledPro && (
            <p className="mt-2 text-lg font-bold text-[var(--color-lightest)]">
              {proPriceMonthlyLabel}
            </p>
          )}
          {!token && (
            <p className="mt-2 text-lg font-bold text-[var(--color-lightest)]">
              {proPriceMonthlyLabel}
            </p>
          )}
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
              <span>{t("tiers.proStatistics")}: {t("tiers.proStatisticsDesc")}</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              <span>{t("tiers.proProfileCustomization")}: {t("tiers.proProfileCustomizationDesc")}</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              {t("tiers.proNoAds")}
            </li>
          </ul>
          {token && !isPayingPro && !isAdmin && (
            <Button
              type="button"
              className="btn-gradient mt-4 w-full"
              disabled={checkoutLoading}
              onClick={handleSubscribe}
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                  {t("tiers.redirecting")}
                </>
              ) : (
                t("tiers.upgradeToPro")
              )}
            </Button>
          )}
          {token && isCancelledPro && (
            <Button
              type="button"
              className="btn-gradient mt-4 w-full"
              disabled={resumeLoading}
              onClick={handleResumeSubscription}
            >
              {resumeLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                  {t("tiers.resuming")}
                </>
              ) : (
                t("tiers.resumeSubscription")
              )}
            </Button>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
