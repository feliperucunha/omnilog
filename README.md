# Logeverything

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
   pnpm --filter @logeverything/shared build
   ```

3. **Environment and database** (API uses PostgreSQL, e.g. Supabase):

   - **Backend** (`apps/api/.env`): Set `DATABASE_URL` to your Supabase connection string (Project Settings → Database → Connection string, URI; use **Transaction** pooler, port 6543, for the app).
   - **Frontend** (`apps/web/.env.local`): Already present; leave `VITE_API_URL` unset for local dev (Vite proxies `/api` to the API).
   - **Create tables in Supabase** (no need for Prisma to connect from your machine): open **Supabase Dashboard** → **SQL Editor** → **New query**. Paste the contents of `apps/api/prisma/supabase-init.sql`, then click **Run**. That creates the `User` and `Log` tables and records the migration so future `prisma migrate deploy` (e.g. from CI) won’t re-apply it.
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
- **Backend** (e.g. Railway, Render): Set `DATABASE_URL` (Supabase), `JWT_SECRET` (min 32 chars), and `WEB_ORIGIN` to your deployed frontend URL (e.g. `https://your-app.vercel.app`). See `apps/api/.env.example` for all options.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Shared**: `@logeverything/shared` – TypeScript types
- **API**: Express, Prisma (PostgreSQL / Supabase), JWT auth, Zod, proxy to TMDB / RAWG / Open Library / Jikan / BGG
- **Web**: React 18, Vite, Tailwind CSS, React Router, Framer Motion, Sonner
