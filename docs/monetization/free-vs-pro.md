# Free vs Pro (source of truth)

Every tier can use every app feature (statistics, export, calendar, recap, profile customization). The only plan-based restriction is the log count cap, enforced in [`logs.ts`](../../apps/api/src/routes/logs.ts) via [`tierHasUnlimitedLogs`](../../apps/api/src/lib/userTier.ts).

## Tiers

| Tier | App features | Unlimited logs (500+ cap) |
|------|--------------|---------------------------|
| `free` | Yes | No (cap enforced server-side) |
| `beta` | Yes | **No** — beta still has the free log cap |
| `pro` | Yes | Yes |
| `admin` | Yes | Yes |

Pro is paid because server storage is limited; unlimited libraries are not offered on Free/Beta.

## Marketing alignment

- The **Tiers** page ([`Tiers.tsx`](../../apps/web/src/pages/Tiers.tsx)) must match the table above. If copy promises “unlimited” for beta, either change copy or change `tierHasUnlimitedLogs` (product decision).
- **Brazil vs default** pricing uses `user.country === "BR"` and Stripe price IDs from env (see [`stripe.ts`](../../apps/api/src/routes/stripe.ts)).

## Annual nudge

- Defaulting the billing interval to **yearly** in the UI improves LTV when the savings message is clear; keep monthly visible for price-sensitive users.
