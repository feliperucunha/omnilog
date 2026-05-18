import { useEffect } from "react";
import { installLogsPageCacheListeners } from "@/lib/logsPageCache";

export function LogsPageCacheInit() {
  useEffect(() => {
    installLogsPageCacheListeners();
  }, []);
  return null;
}
