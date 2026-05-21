import type { Response } from "express";

export type RouteTimingMeta = {
  dbMs?: number;
  externalMs?: number;
  cacheHit?: boolean;
  provider?: string;
};

export function createRouteTimer() {
  const start = performance.now();
  let dbMs = 0;
  let externalMs = 0;
  let cacheHit = false;
  let provider: string | undefined;

  return {
    addDb(ms: number) {
      dbMs += ms;
    },
    addExternal(ms: number) {
      externalMs += ms;
    },
    setCacheHit(hit: boolean) {
      cacheHit = hit;
    },
    setProvider(p: string) {
      provider = p;
    },
    async trackDb<T>(fn: () => Promise<T>): Promise<T> {
      const t0 = performance.now();
      try {
        return await fn();
      } finally {
        dbMs += performance.now() - t0;
      }
    },
    async trackExternal<T>(fn: () => Promise<T>): Promise<T> {
      const t0 = performance.now();
      try {
        return await fn();
      } finally {
        externalMs += performance.now() - t0;
      }
    },
    finish(res: Response, extra?: Partial<RouteTimingMeta>) {
      const totalMs = Math.round(performance.now() - start);
      const meta: RouteTimingMeta = {
        dbMs: Math.round(dbMs),
        externalMs: Math.round(externalMs),
        cacheHit,
        provider,
        ...extra,
      };
      const parts = [
        `total=${totalMs}ms`,
        meta.dbMs != null ? `db=${meta.dbMs}ms` : null,
        meta.externalMs != null ? `ext=${meta.externalMs}ms` : null,
        meta.cacheHit ? "cache=hit" : "cache=miss",
        meta.provider ? `provider=${meta.provider}` : null,
      ].filter(Boolean);
      console.info(`[route-timing] ${parts.join(" ")}`);
      res.setHeader(
        "Server-Timing",
        `total;dur=${totalMs}, db;dur=${meta.dbMs ?? 0}, ext;dur=${meta.externalMs ?? 0}`
      );
    },
  };
}
