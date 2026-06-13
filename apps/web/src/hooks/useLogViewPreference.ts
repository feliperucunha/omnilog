import { useCallback, useEffect, useState } from "react";
import {
  type LogViewMode,
  type LogViewPage,
  persistLogViewPreference,
  readLogViewPreference,
  readLogViewPreferenceSync,
} from "@/lib/logViewPreference";

export function useLogViewPreference(page: LogViewPage, enabled = true) {
  const [view, setView] = useState<LogViewMode>(() =>
    enabled ? readLogViewPreferenceSync(page) : "list"
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void readLogViewPreference(page).then((stored) => {
      if (!cancelled) setView(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [page, enabled]);

  const setViewAndPersist = useCallback(
    (next: LogViewMode) => {
      setView(next);
      if (enabled) persistLogViewPreference(page, next);
    },
    [page, enabled]
  );

  return [view, setViewAndPersist] as const;
}
