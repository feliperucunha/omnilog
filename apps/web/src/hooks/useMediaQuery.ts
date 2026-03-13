import { useState, useEffect } from "react";

/**
 * Matches (max-width: 767px) – same as Tailwind max-md / drawer mobile breakpoint.
 */
const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const handle = () => setIsMobile(mql.matches);
    mql.addEventListener("change", handle);
    return () => mql.removeEventListener("change", handle);
  }, []);

  return isMobile;
}
