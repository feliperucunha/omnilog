import { useEffect } from "react";
import { getApiBase } from "@/lib/api";

/**
 * When the wake_api_ping feature flag is on, periodically GETs /api/health so free-tier hosts
 * that sleep after idle (e.g. Koyeb) stay warm while the app is open.
 */
export function ApiWakePing() {
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const base = getApiBase();

    void (async () => {
      try {
        const res = await fetch(`${base}/wake-ping-config`, {
          method: "GET",
          credentials: "omit",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { enabled?: boolean; intervalMs?: number };
        if (!data.enabled) return;

        const ms =
          typeof data.intervalMs === "number" && data.intervalMs >= 60_000
            ? data.intervalMs
            : 5 * 60 * 1000;

        const ping = (): void => {
          void fetch(`${base}/health`, { method: "GET", credentials: "omit" });
        };

        ping();
        intervalId = setInterval(ping, ms);
      } catch {
        /* ignore — network or API asleep */
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, []);

  return null;
}
