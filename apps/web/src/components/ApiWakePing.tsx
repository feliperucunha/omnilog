import { useEffect } from "react";
import { getApiBase } from "@/lib/api";

const CONFIG_RETRY_DELAY_MS = 3_000;
const CONFIG_MAX_ATTEMPTS = 8;

/**
 * Always GETs /api/health once on load to start waking sleep-prone hosts (e.g. free tier).
 * If wake ping is enabled (admin feature flag or API env WAKE_API_PING_ENABLED), also pings on an interval.
 * Retries wake-ping-config after failures so a cold API still picks up the interval once it is up.
 */
export function ApiWakePing() {
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const base = getApiBase();

    const pingHealth = (): void => {
      void fetch(`${base}/health`, { method: "GET", credentials: "omit" });
    };

    pingHealth();

    void (async () => {
      const intervalMsFromPayload = (data: { intervalMs?: number }): number =>
        typeof data.intervalMs === "number" && data.intervalMs >= 60_000
          ? data.intervalMs
          : 5 * 60 * 1000;

      let enabled = false;
      let intervalMs = 5 * 60 * 1000;

      for (let attempt = 0; attempt < CONFIG_MAX_ATTEMPTS && !cancelled; attempt++) {
        try {
          const res = await fetch(`${base}/wake-ping-config`, {
            method: "GET",
            credentials: "omit",
          });
          if (cancelled) return;
          if (res.ok) {
            const data = (await res.json()) as { enabled?: boolean; intervalMs?: number };
            enabled = Boolean(data.enabled);
            intervalMs = intervalMsFromPayload(data);
            break;
          }
        } catch {
          /* cold start, DNS, or API still sleeping */
        }
        await new Promise((r) => setTimeout(r, CONFIG_RETRY_DELAY_MS));
      }

      if (cancelled || !enabled) return;

      pingHealth();
      intervalId = setInterval(pingHealth, intervalMs);
    })();

    return () => {
      cancelled = true;
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, []);

  return null;
}
