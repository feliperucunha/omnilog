import { Outlet } from "react-router-dom";
import { routeOutletClassName } from "@/lib/motionPolicy";

export function AnimatedOutlet() {
  return (
    <div className={`${routeOutletClassName} flex min-h-0 flex-1 flex-col`}>
      <Outlet />
    </div>
  );
}
