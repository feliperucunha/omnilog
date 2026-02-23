import { Outlet } from "react-router-dom";
import { Nav } from "@/components/Nav";
import { Topbar } from "@/components/Topbar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main
        className="flex min-h-screen flex-1 flex-col pb-20 md:pb-6 md:pl-[255px]"
      >
        <Topbar />
        <div className="flex flex-1 flex-col min-h-0 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
