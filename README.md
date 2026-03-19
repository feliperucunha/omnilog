# Dogument

A responsive web app to log and rate movies, TV shows, board games, video games, books, and anime. Built as a Turborepo monorepo with a React frontend and Node API.

## Setup

1. **Install dependencies** (from repo root):

   ```bash
   pnpm install
   ```

2. **Build shared package** (required before running API or web):

   ```bash
   pnpm build
   ```

   Or build only the shared package:

   ```bash
   pnpm --filter @dogument/shared build
   ```

3. **Environment and database** (API uses PostgreSQL, e.g. Supabase):

   - **Backend** (`apps/api/.env`): Set `DATABASE_URL` to your Supabase connection string (Project Settings → Database → Connection string, URI; use **Transaction** pooler, port 6543, for the app). When using the Transaction pooler, append `?pgbouncer=true` to the URL (or `&pgbouncer=true` if the URL already has query params) to avoid "prepared statement does not exist" errors.
   - **Frontend** (`apps/web/.env.local`): Already present; leave `VITE_API_URL` unset for local dev (Vite proxies `/api` to the API).
   - **Create tables in Supabase** (no need for Prisma to connect from your machine): open **Supabase Dashboard** → **SQL Editor** → **New query**. Paste the contents of `apps/api/prisma/supabase-init.sql`, then click **Run**. That creates the `User` and `Log` tables and records the migration so future `prisma migrate deploy` (e.g. from CI) won’t re-apply it.
   - **Badge/milestone progress**: If you apply SQL manually (e.g. no Prisma migrate), run `apps/api/prisma/supabase-milestones.sql` in the SQL Editor too. If you see "BadgeMedium does not exist", run `CREATE TYPE "BadgeMedium" AS ENUM ('MOVIE', 'TV_SHOW', 'ANIME', 'MANGA', 'COMIC', 'BOOK');` first. Then restart the API so it can seed milestone rows; the dashboard badge meter will work after that.
   - **Supabase Security Advisor (RLS)**: Run `apps/api/prisma/supabase-rls.sql` in the SQL Editor (or deploy migrations so `20260318160000_enable_row_level_security` runs). That enables Row Level Security on app tables so the Data API cannot read `User.password` or other rows with the anon key. Prisma (postgres connection) still works. See `docs/supabase-security.md`.
   - Optional: for **movie/TV search** set `TMDB_API_KEY` in `apps/api/.env`; for **games** set `RAWG_API_KEY`; for **board games** set `BGG_API_TOKEN`. Books, Anime, and BGG work without keys (or users add their own in-app).

## Run

From repo root:

```bash
pnpm dev
```

- **Web**: http://localhost:5173  
- **API**: http://localhost:3001  

Register an account on the web app, then use Search to find media and add logs (grade 0–10 + review).

## Scripts

| Command        | Description                    |
|----------------|--------------------------------|
| `pnpm dev`     | Run web and API in development |
| `pnpm build`   | Build all apps and packages    |
| `pnpm lint`    | Lint all workspaces            |

## Deploy (Option B: frontend and API separate)

- **Frontend** (e.g. Vercel, Netlify): Set `VITE_API_URL` to your deployed API base URL (e.g. `https://your-api.up.railway.app/api`). Build uses this at compile time.
- **Backend** (e.g. Render): Set **Root Directory** to empty (repo root). **Build Command:** `pnpm install && pnpm run build --filter=@dogument/api...` **Start Command:** `node apps/api/dist/index.js`. Env: `DATABASE_URL` (Supabase; append `?pgbouncer=true` when using Transaction pooler port 6543), `JWT_SECRET` (min 32 chars), `WEB_ORIGIN` (deployed frontend URL). See `apps/api/.env.example`. Optional: use `render.yaml` (Blueprint) for the same config.

## Android app (APK)

The web app is wrapped with [Capacitor](https://capacitorjs.com/) so you can build an Android APK.

1. **From repo root**, install dependencies and build the web app for Android:

   ```bash
   pnpm install
   cd apps/web
   pnpm run build:android
   pnpm run cap:sync
   ```

2. **Set the API URL** for the app (required: the app has no dev proxy). When building, set `VITE_API_URL` to your deployed API (e.g. `https://your-api.onrender.com`). For example, create `apps/web/.env.production` or run:

   ```bash
   VITE_API_URL=https://your-api.onrender.com pnpm run build:android
   pnpm run cap:sync
   ```

3. **Open Android Studio** and build the APK:

   ```bash
   pnpm run cap:open:android
   ```

   In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**. The APK is generated under `apps/web/android/app/build/outputs/apk/`.

Or run the full flow in one go (build, sync, open Android Studio):

```bash
cd apps/web && pnpm run android
```

**Requirements:** Node 18+, Android Studio (for the Android SDK and emulator/device). The Android project lives in `apps/web/android/`.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Shared**: `@dogument/shared` – TypeScript types
- **API**: Express, Prisma (PostgreSQL / Supabase), JWT auth, Zod, proxy to TMDB / RAWG / Open Library / Jikan / BGG
- **Web**: React 18, Vite, Tailwind CSS, React Router, Framer Motion, Sonner. **Mobile**: Capacitor (Android)
