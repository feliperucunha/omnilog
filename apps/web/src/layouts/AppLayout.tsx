import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useEnsureRouteContentVisible } from "@/hooks/useEnsureRouteContentVisible";
import { Nav } from "@/components/Nav";
import { Topbar } from "@/components/Topbar";
import { AdBanner } from "@/components/AdBanner";
import { InvalidApiKeyBanner } from "@/components/InvalidApiKeyBanner";
import { PageTitleProvider, usePageTitle } from "@/contexts/PageTitleContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { isPullToRefreshEnabled } from "@/lib/appPtrRefresh";
import { useAuth } from "@/contexts/AuthContext";
import { FORCE_ONBOARDING_UI } from "@/lib/onboardingDev";
import { OnboardingForm } from "@/pages/Onboarding";
import { useLocale } from "@/contexts/LocaleContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function AppLayoutContent() {
  useEnsureRouteContentVisible();
  const pageTitle = usePageTitle();
  const belowNavbar = pageTitle?.belowNavbar;
  const location = useLocation();
  const heading = pageTitle?.pageTitle?.trim() ? pageTitle.pageTitle : null;
  const showHeading =
    heading != null &&
    [
      "/dashboard",
      "/discover",
      "/statistics",
      "/search",
      "/market",
      "/settings",
      "/about",
      "/tiers",
      "/my-listings",
    ].includes(location.pathname);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const ptrEnabled = isPullToRefreshEnabled(location.pathname);
  const ptr = usePullToRefresh({ enabled: ptrEnabled, scrollEl });

  return (
    <>
      <Topbar />
      <div
        ref={setScrollEl}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto max-md:[scroll-padding-bottom:calc(8.5rem+env(safe-area-inset-bottom))]"
      >
        <PullToRefreshIndicator
          pullRawDy={ptr.pullRawDy}
          thresholdPx={ptr.thresholdPx}
          isRefreshing={ptr.isRefreshing}
        />
        <div className="flex min-h-full min-w-0 flex-col px-3.5 py-4 md:px-7 md:pb-12 md:pt-[18px]">
          {showHeading ? (
            <div className="mb-4 flex items-center justify-between gap-3">
              <h1 className="page-title min-w-0 text-[var(--color-lightest)]">{heading}</h1>
              {pageTitle?.headingAction}
            </div>
          ) : null}
          {belowNavbar != null && belowNavbar !== false && (
            <div
              className={cn(
                "w-full min-w-0 self-start",
                location.pathname === "/statistics"
                  ? "sticky top-0 z-20 -mx-3.5 mb-4 bg-[var(--color-darkest)] px-3.5 pb-3 md:-mx-7 md:px-7"
                  : "mb-4 shrink-0"
              )}
            >
              {belowNavbar}
            </div>
          )}
          <InvalidApiKeyBanner />
          <Outlet />
          <AdBanner />
          <div
            aria-hidden
            className="shrink-0 max-md:h-[calc(8.5rem+env(safe-area-inset-bottom))] md:hidden"
          />
        </div>
      </div>
    </>
  );
}

function DevOnboardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[120] flex min-h-0 flex-col gap-0 overflow-hidden p-4 sm:max-w-xl sm:gap-3 sm:p-5"
        overlayClassName="z-[120]"
        onClose={() => onOpenChange(false)}
      >
        <DialogTitle className="sr-only shrink-0">{t("onboarding.a11yWizardTitle")}</DialogTitle>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <OnboardingForm layout="embed" previewMode onPreviewDismiss={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const [devOnboardingOpen, setDevOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!FORCE_ONBOARDING_UI || !user?.onboarded) return;
    setDevOnboardingOpen(true);
  }, [user?.onboarded, user?.id]);

  return (
    <div className="flex h-dvh min-h-0 min-w-0">
      <Nav />
      <main
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-0 md:pb-6 md:pl-[6.5rem]"
      >
        <PageTitleProvider>
          <AppLayoutContent />
        </PageTitleProvider>
      </main>
      {FORCE_ONBOARDING_UI && user?.onboarded ? (
        <DevOnboardingDialog open={devOnboardingOpen} onOpenChange={setDevOnboardingOpen} />
      ) : null}
    </div>
  );
}
