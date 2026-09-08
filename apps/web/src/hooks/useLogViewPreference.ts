import { useCallback, useEffect, useState } from "react";
import {
  type LogViewMode,
  type LogViewPage,
  persistLogViewPreference,
  readStoredLogViewPreference,
  readStoredLogViewPreferenceSync,
} from "@/lib/logViewPreference";

export function useLogViewPreference(
  page: LogViewPage,
  enabled = true,
  fallbackWhenUnset: LogViewMode = "list"
) {
  const [view, setView] = useState<LogViewMode>(() =>
    enabled ? (readStoredLogViewPreferenceSync(page) ?? fallbackWhenUnset) : fallbackWhenUnset
  );

  useEffect(() => {
    if (!enabled) {
      setView(fallbackWhenUnset);
      return;
    }
    let cancelled = false;
    void readStoredLogViewPreference(page).then((stored) => {
      if (!cancelled) setView(stored ?? fallbackWhenUnset);
    });
    return () => {
      cancelled = true;
    };
  }, [page, enabled, fallbackWhenUnset]);

  const setViewAndPersist = useCallback(
    (next: LogViewMode) => {
      setView(next);
      if (enabled) persistLogViewPreference(page, next);
    },
    [page, enabled]
  );

  return [view, setViewAndPersist] as const;
}
