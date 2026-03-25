# Geeklogs

Track everything you watch, play, and read—movies, TV, board games, video games, books, anime, manga, comics, and more—in one place. Ratings, reviews, and stats in a single responsive app.

Monorepo: **React + Vite** (web), **Express + Prisma** (API), **Capacitor** (Android & iOS), shared TypeScript types in **`@geeklogs/shared`**.

## Requirements

- **Node.js** 18+
- **pnpm** 9+ (see `packageManager` in root `package.json`)
- **PostgreSQL** (e.g. Supabase) for the API

## Setup

1. **Install dependencies** (repo root):

   ```bash
   pnpm install
   ```

2. **Build** (compiles shared, API, web, and syncs Capacitor assets):

   ```bash
   pnpm build
   ```

   Or build only the shared package:

   ```bash
   pnpm --filter @geeklogs/shared build
   ```

3. **Environment & database**

   - **API** — `apps/api/.env` (see `apps/api/.env.example`):
     - `DATABASE_URL` — PostgreSQL connection string. With Supabase **Transaction** pooler (port **6543**), append `?pgbouncer=true` (or `&pgbouncer=true`) to avoid prepared-statement errors with Prisma.
     - `JWT_SECRET` — at least 32 characters in production.
     - `WEB_ORIGIN` — deployed frontend origin(s) for CORS (and cookie auth if used).
   - **Web (local dev)** — `apps/web/.env.local`: leave `VITE_API_URL` unset so Vite proxies `/api` to the API (default `http://localhost:3001`).
   - **Schema** — Prefer Prisma migrations from the API package, e.g.  
     `pnpm --filter @geeklogs/api exec prisma migrate deploy`  
     For Supabase-only bootstrapping, the repo may include SQL helpers under `apps/api/prisma/` (init, milestones, RLS); see comments in those files and `docs/supabase-security.md` for RLS.
   - **Optional API keys** (server-wide fallbacks): `TMDB_API_KEY`, `RAWG_API_KEY`, `BGG_API_TOKEN`, `COMIC_VINE_API_KEY`, etc. Users can also add their own keys in **Settings**. Books / anime / manga use public APIs without keys.

## Run (development)

From repo root:

```bash
pnpm dev
```

- **Web:** http://localhost:5173  
- **API:** http://localhost:3001  

Register, then use **Search** to find media and add logs (grade + optional review).

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm dev` | Web + API in dev (Turbo) |
| `pnpm build` | Build all workspaces (`@geeklogs/shared`, API, web, Android sync) |
| `pnpm run heroku-build` | **API only** (shared + API)—for Heroku / slim server deploys |
| `pnpm lint` | ESLint across workspaces |
| `pnpm start` / `pnpm start:api` | Run compiled API: `node apps/api/dist/index.js` |
| `pnpm build:android` | Web production build for Capacitor only (`vite --mode capacitor`) |
| `pnpm android` | Web Capacitor build → `cap sync android` → open Android Studio |
| `pnpm ios` | Web Capacitor build → `cap sync ios` → open Xcode |

Equivalent filters:

- `pnpm --filter @geeklogs/web dev`
- `pnpm --filter @geeklogs/api dev`
- `pnpm --filter @geeklogs/android build` — web `build:android` + `cap sync` (Android + iOS)

## Deploy (split frontend & API)

- **Frontend** (e.g. Vercel): set `VITE_API_URL` to your API base (e.g. `https://api.example.com/api`) at build time. Repo root `vercel.json` uses `pnpm run build --filter=@geeklogs/web...`.
- **Backend** (e.g. Render): repo root, install + build API (and dependencies), e.g.  
  `pnpm install && pnpm run build --filter=@geeklogs/api...`  
  **Start:** `node apps/api/dist/index.js`  
  Env: `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGIN`, optional provider keys. Optional Blueprint: `render.yaml`.
- **Backend (Heroku / Node pnpm buildpack):** Deploy from the **repo root** (not `apps/api` alone—workspace deps need the monorepo). The root `pnpm run build` runs the **full** Turbo pipeline (web + Android sync) and usually **fails** on Heroku. Use the API-only script instead:
  - **`heroku-build`** (in root `package.json`) runs `turbo run build --filter=@geeklogs/api...` (shared + API only).
  - **`Procfile`** defines `web: node apps/api/dist/index.js`.
  - If your build log shows `pnpm run build` failing (not `heroku-build`), set the platform **build command** to `pnpm run heroku-build`, or ensure the Heroku Node pnpm buildpack picks up `heroku-build`.
  - **Migrations:** add a [release phase](https://devcenter.heroku.com/articles/release-phase), e.g. `release: pnpm --filter @geeklogs/api exec prisma migrate deploy`, or run migrations from CI.
  - Set **`DATABASE_URL`**, **`JWT_SECRET`**, **`WEB_ORIGIN`**, and any API keys in config vars.

## Mobile (Capacitor)

Native projects live under **`apps/android`** (not inside `apps/web`). App id: **`com.geeklogs.app`**.

1. Set **`VITE_API_URL`** to your **production** API when building the bundle (no dev proxy in the WebView). Optionally set **`VITE_APP_WEB_ORIGIN`** to your deployed web URL (same host as Android `app_link_host`) so HTTPS links and App Links route in-app. See **`docs/android-app-links.md`**.

   ```bash
   cd apps/web
   VITE_API_URL=https://your-api.example.com/api pnpm run build:android
   ```

2. Sync and open a native IDE (from **repo root**):

   ```bash
   pnpm android    # Android Studio
   pnpm ios        # Xcode (macOS)
   ```

   Or only sync after a web build:

   ```bash
   pnpm --filter @geeklogs/android build
   ```

3. **Android APK/AAB:** open `apps/android/android` in Android Studio → build as usual. See **`apps/android/PLAY_STORE.md`** for Play Store notes.

4. **Launcher & splash icons** are generated from `apps/web/public/logo-dark.png`. After changing the logo:

   ```bash
   python3 apps/android/scripts/generate-launcher-icons.py
   ```

   Requires [Pillow](https://pypi.org/project/pillow/) (`pip install pillow`).

**Requirements:** Android Studio (SDK) and/or Xcode for device builds and store uploads.

## Stack

| Area | Tech |
|------|------|
| **Monorepo** | pnpm workspaces, Turborepo |
| **Shared** | `@geeklogs/shared` — types, constants, `APP_VERSION` |
| **API** | Express, Prisma, PostgreSQL, JWT, Zod; TMDB, RAWG, Open Library, Jikan, BGG, Ludopedia, Comic Vine |
| **Web** | React 18, Vite, Tailwind CSS, React Router, Framer Motion, Radix UI, Sonner |
| **Native** | Capacitor 7 (Android + iOS) |
