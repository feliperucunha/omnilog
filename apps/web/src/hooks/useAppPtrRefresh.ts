import { useEffect, useRef } from "react";
import { APP_PTR_REFRESH_EVENT } from "@/lib/appPtrRefresh";

export function useAppPtrRefresh(onRefresh: () => void | Promise<void>): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const handler = () => {
      void onRefreshRef.current();
    };
    window.addEventListener(APP_PTR_REFRESH_EVENT, handler);
    return () => window.removeEventListener(APP_PTR_REFRESH_EVENT, handler);
  }, []);
}
