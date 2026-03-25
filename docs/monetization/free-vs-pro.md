# Free vs Pro (source of truth)

Server enforcement lives in [`apps/api/src/lib/userTier.ts`](../../apps/api/src/lib/userTier.ts) and route handlers (notably [`logs.ts`](../../apps/api/src/routes/logs.ts) for log limits and Pro-only features).

## Tiers

| Tier | Pro-style features (stats, export, etc.) | Unlimited logs (500+ cap) |
|------|------------------------------------------|---------------------------|
| `free` | No | No (cap enforced server-side) |
| `beta` | Yes (promotional / early access) | **No** — beta still has the free log cap |
| `pro` | Yes | Yes |
| `admin` | Yes | Yes |

## Marketing alignment

- The **Tiers** page ([`Tiers.tsx`](../../apps/web/src/pages/Tiers.tsx)) must match the table above. If copy promises “unlimited” for beta, either change copy or change `tierHasUnlimitedLogs` (product decision).
- **Brazil vs default** pricing uses `user.country === "BR"` and Stripe price IDs from env (see [`stripe.ts`](../../apps/api/src/routes/stripe.ts)).

## Annual nudge

- Defaulting the billing interval to **yearly** in the UI improves LTV when the savings message is clear; keep monthly visible for price-sensitive users.
