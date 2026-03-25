import { apiFetch } from "@/lib/api";

/**
 * Fire-and-forget product event (logged on the API as JSON). See docs/strategy/persona-and-metrics.md.
 * In development, also logs to the console.
 */
export function trackProductEvent(name: string, props?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.debug("[product]", name, props ?? {});
  }
  void apiFetch("/me/product-events", {
    method: "POST",
    body: JSON.stringify(props && Object.keys(props).length > 0 ? { name, props } : { name }),
  }).catch(() => {
    /* ignore — analytics must not break UX */
  });
}
