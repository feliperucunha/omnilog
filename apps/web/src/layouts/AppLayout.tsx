import { Outlet } from "react-router-dom";
import { Nav } from "@/components/Nav";
import { Topbar } from "@/components/Topbar";
import { AdBanner } from "@/components/AdBanner";
import { InvalidApiKeyBanner } from "@/components/InvalidApiKeyBanner";
import { PageTitleProvider, usePageTitle } from "@/contexts/PageTitleContext";

function AppLayoutContent() {
  const pageTitle = usePageTitle();
  const belowNavbar = pageTitle?.belowNavbar;

  return (
    <>
      <Topbar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
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
    </div>
  );
}
