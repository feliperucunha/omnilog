import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
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

function AppLayoutContent() {
  const pageTitle = usePageTitle();
  const belowNavbar = pageTitle?.belowNavbar;
  const location = useLocation();
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const ptrEnabled = isPullToRefreshEnabled(location.pathname);
  const ptr = usePullToRefresh({ enabled: ptrEnabled, scrollEl });

  return (
    <>
      <Topbar />
      <div
        ref={setScrollEl}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
      >
        <PullToRefreshIndicator
          pullRawDy={ptr.pullRawDy}
          thresholdPx={ptr.thresholdPx}
          isRefreshing={ptr.isRefreshing}
        />
        {belowNavbar != null && belowNavbar !== false && (
          <div className="sticky top-0 z-20 w-full shrink-0 border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)]">
            {belowNavbar}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col p-4 md:p-6">
          <InvalidApiKeyBanner />
          <Outlet />
          <AdBanner />
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
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[max(6rem,calc(6rem+env(safe-area-inset-bottom)))] md:pb-6 md:pl-[255px]"
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
