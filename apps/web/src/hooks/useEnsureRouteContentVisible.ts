import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { listStaggerItemClassName, routeOutletClassName } from "@/lib/motionPolicy";

function forceVisible(el: HTMLElement): void {
  if (el.style.opacity === "0") el.style.opacity = "1";
  if (el.style.visibility === "hidden") el.style.visibility = "visible";
}

export function useEnsureRouteContentVisible(): void {
  const location = useLocation();

  useLayoutEffect(() => {
    const outlet = document.querySelector(`.${routeOutletClassName}`);
    if (!outlet) return;

    forceVisible(outlet as HTMLElement);
    outlet.querySelectorAll<HTMLElement>(`.${listStaggerItemClassName}`).forEach(forceVisible);

    outlet.querySelectorAll<HTMLElement>("[style]").forEach((node) => {
      if (node.style.opacity === "0" && node.closest(`.${routeOutletClassName}`)) {
        forceVisible(node);
      }
    });
  }, [location.pathname, location.key]);
}
