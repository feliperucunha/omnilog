# Privacy & terms (compliance checklist)

The `/privacy` page ([`Privacy.tsx`](../../apps/web/src/pages/Privacy.tsx)) renders a **long-form English Privacy Policy** from [`apps/web/src/locales/en.json`](../../apps/web/src/locales/en.json) (`legal.privacyS1Title` … `privacyS10Body`), aligned with current product behavior (auth, logs/reviews, Stripe, optional Sentry/AdSense, user API keys, etc.). Portuguese and Spanish locales show a short notice plus the English sections via fallback. **Have qualified privacy counsel review and localize** before relying on it in the EU/UK/CCPA contexts; substitute your operating **legal entity name** and jurisdiction-specific clauses as advised.

`/terms` copy remains shorter ([`Terms.tsx`](../../apps/web/src/pages/Terms.tsx)); align with counsel as needed.

## Before you market paid Pro widely

- [ ] **DPA / subprocessors** — list hosting, DB, Stripe, email, and error tracking (e.g. Sentry).
- [ ] **Cookie / local storage** — document auth token, locale, theme; align with consent if you add non-essential cookies.
- [ ] **Data export & deletion** — FAQ references deletion by email; implement or automate per policy.
- [ ] **Stripe** — receipts, tax, and app-store rules if you sell through native IAP later.
- [ ] **Sentry** — disable PII or configure scrubbing; document in privacy policy.

## Internal owner

Assign one person to review this checklist each quarter alongside [`weekly-metrics-ritual.md`](../operations/weekly-metrics-ritual.md).
