# Persona, north star, and metrics (Geeklogs)

Use this doc as a living template. Revisit monthly in the weekly metrics ritual ([`../operations/weekly-metrics-ritual.md`](../operations/weekly-metrics-ritual.md)).

## Primary persona (fill in)

- **Who:** (e.g. heavy TV + film fan who also games)
- **Job to be done:** (e.g. log finished media in under a minute and see year-in-review stats)
- **Alternatives they use today:** Letterboxd, Trakt, spreadsheets, nothing

## Secondary persona (optional)

- **Who:**
- **Job to be done:**

## North star metric

One number that best captures “the product is working” (examples: weekly active loggers, logs per WAU, or D7 retention after first log).

**Chosen north star:**

- **Definition:**
- **Target (90 days):**

## Supporting metrics (pick 3–5)

| Metric | Definition | Where to read it |
|--------|------------|------------------|
| Activation | First log within 24h of signup | Product events: `first_log_created` + user `createdAt` (server logs / analytics) |
| WAU | Weekly active users | Your analytics or server aggregates |
| Logs per WAU | Total logs / WAU | DB or BI |
| D7 retention | % of new users active on day 7 | Cohort tool or SQL |
| Pro conversion | % of eligible users who start or complete checkout | Stripe + `tier` in DB |

## Minimal instrumentation

The app can emit **product events** (see `POST /api/me/product-events` and [`apps/web/src/lib/productAnalytics.ts`](../../apps/web/src/lib/productAnalytics.ts)):

- `onboarding_completed` — user finished or skipped onboarding with defaults
- `first_log_created` — first `POST /logs` success for that account (client fires once)

Pipe server logs to your log aggregator or forward events to Segment/PostHog later without changing event names.

## Exit criteria (Phase 0)

- Persona and north star are written and agreed (even if only with yourself).
- At least one activation metric is measurable end-to-end.
