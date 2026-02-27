import { Outlet } from "react-router-dom";
import { Nav } from "@/components/Nav";
import { Topbar } from "@/components/Topbar";
import { AdBanner } from "@/components/AdBanner";

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main
        className="flex min-h-screen min-w-0 flex-1 flex-col pb-20 md:pb-6 md:pl-[255px]"
      >
        <Topbar />
        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-4 md:p-6">
          <Outlet />
          <AdBanner />
        </div>
      </main>
    </div>
  );
}
