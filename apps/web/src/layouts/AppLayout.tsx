import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Nav } from "@/components/Nav";
import { Topbar } from "@/components/Topbar";
import { AdBanner } from "@/components/AdBanner";
import { InvalidApiKeyBanner } from "@/components/InvalidApiKeyBanner";
import { PageTitleProvider, usePageTitle } from "@/contexts/PageTitleContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { FORCE_ONBOARDING_UI } from "@/lib/onboardingDev";
import { OnboardingForm } from "@/pages/Onboarding";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function AppLayoutContent() {
  const pageTitle = usePageTitle();
  const belowNavbar = pageTitle?.belowNavbar;
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const ptrEnabled =
    location.pathname === "/" || location.pathname === "/search";
  const ptr = usePullToRefresh({ enabled: ptrEnabled, scrollRef });

  return (
    <>
      <Topbar />
      <div
        ref={scrollRef}
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
        <Dialog open={devOnboardingOpen} onOpenChange={(open) => setDevOnboardingOpen(open)}>
          <DialogContent className="sm:max-w-xl" onClose={() => setDevOnboardingOpen(false)}>
            <OnboardingForm
              layout="embed"
              previewMode
              onPreviewDismiss={() => setDevOnboardingOpen(false)}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
