# Privacy & terms (compliance checklist)

The app ships **placeholder** legal copy on `/privacy` and `/terms` ([`Privacy.tsx`](../../apps/web/src/pages/Privacy.tsx), [`Terms.tsx`](../../apps/web/src/pages/Terms.tsx)) and a support email from `VITE_SUPPORT_EMAIL` (fallback `support@geeklogs.app`). Replace with counsel-reviewed text before scaling in the EU/UK/CCPA contexts.

## Before you market paid Pro widely

- [ ] **DPA / subprocessors** — list hosting, DB, Stripe, email, and error tracking (e.g. Sentry).
- [ ] **Cookie / local storage** — document auth token, locale, theme; align with consent if you add non-essential cookies.
- [ ] **Data export & deletion** — FAQ references deletion by email; implement or automate per policy.
- [ ] **Stripe** — receipts, tax, and app-store rules if you sell through native IAP later.
- [ ] **Sentry** — disable PII or configure scrubbing; document in privacy policy.

## Internal owner

Assign one person to review this checklist each quarter alongside [`weekly-metrics-ritual.md`](../operations/weekly-metrics-ritual.md).
