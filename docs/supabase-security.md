# Supabase security (RLS + frontend)

## Database (RLS)

1. In **Supabase → SQL Editor**, run the contents of `apps/api/prisma/supabase-rls.sql` (or apply migration `20260318160000_enable_row_level_security` via `pnpm exec prisma migrate deploy` from `apps/api`).

2. Re-run the Supabase **Security Advisor**; “RLS Disabled in Public” and sensitive `User.password` exposure via the Data API should clear for these tables.

3. **Prisma / API**: Keep using `DATABASE_URL` with the **direct** Postgres user (pooler URI with the `postgres` password). That role bypasses RLS, so the API continues to work. [Inference] If you switch to a non-superuser DB role for Prisma, you would need `BYPASSRLS` on that role or explicit RLS policies — not the default Supabase setup.

4. **Keys**: Never put `SUPABASE_SERVICE_ROLE_KEY` or DB passwords in `VITE_*` / `NEXT_PUBLIC_*`. This app’s web client talks only to your Node API, not to PostgREST.

## Frontend (attack surface)

| Area | Notes |
|------|--------|
| **XSS** | User reviews are rendered as React text (`{review}`), not `dangerouslySetInnerHTML`, so script injection in reviews is not executed as HTML in the checked pages. |
| **Auth** | JWT or cookie session goes to your API over HTTPS in production; avoid logging full tokens. |
| **Public API** | `apiFetchPublic` omits credentials — appropriate for public profile routes. |

## If you add Supabase Client to the browser later

You would need RLS **policies** (not empty deny-all) for tables users should access, and still avoid selecting `password`, `passwordResetToken`, etc. Prefer a SQL view that exposes only safe columns.
