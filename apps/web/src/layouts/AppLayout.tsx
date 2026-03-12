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
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        {belowNavbar != null && belowNavbar !== false && (
          <div className="w-full shrink-0">{belowNavbar}</div>
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
    <div className="flex min-h-screen">
      <Nav />
      <main
        className="flex min-h-screen min-w-0 flex-1 flex-col pb-[max(6rem,calc(6rem+env(safe-area-inset-bottom)))] md:pb-6 md:pl-[255px]"
      >
        <PageTitleProvider>
          <AppLayoutContent />
        </PageTitleProvider>
      </main>
    </div>
  );
}
