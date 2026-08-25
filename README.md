# MedStudy

Personalized diagnosis & anatomy learning app: a shared spaced-repetition +
mastery/confusion-tracking engine underneath four study modules (Diagnosis
Game, Anatomy Guesser, Adaptive Quiz Engine, Recall/Review).

Architecture: **hosted, single-user.** The app deploys to Vercel (free,
no credit card) with Postgres from Neon via Vercel's Marketplace
integration — one dashboard, database env vars wired automatically, no
copying connection strings between two separate sites. Your phone, tablet,
and PC all just open one URL; nothing runs locally. The API is a serverless
function (`api/index.ts` → `server/src/app.ts`); `server/src/index.ts` is a
separate self-hosted entrypoint kept around in case you ever want to run
this on your own machine instead.

Currently implemented (Stage 1 of the build order): the data model, FSRS
spaced-repetition core, PIN auth, and a barebones flashcard review UI. The
other modules (Diagnosis Game, Anatomy Guesser, Quiz Engine, mistake-diagnosis
engine, gamification) land in later stages.

## Hosted deploy (Vercel + Neon)

Free, no credit card, and only one dashboard to touch for env vars — Vercel's
Neon integration wires the database connection strings into your project
automatically, so there's no manual copying between two separate sites.

The repo is already pushed and its only branch (`claude/medstudy-learning-app-azh5m7`) is the repo's default branch, so Vercel will pick the right branch automatically — nothing to configure there.

1. **[vercel.com](https://vercel.com)** → sign up / log in with GitHub.
2. Dashboard → **"Add New..."** (top right) → **"Project"**. Find
   `paulmarioc-crypto/education` in the list and click **Import**. (If it's
   not listed, click "Adjust GitHub App Permissions" and grant Vercel
   access to it.)
3. On the "Configure Project" screen, leave every setting as-is and click
   **Deploy**. `vercel.json` at the repo root controls the build — no
   fields to fill in here. This first deploy is **expected to fail** (no
   database connected yet, no PIN set) — that's fine, ignore it. It exists
   only to create the project so the rest of the settings below become
   reachable.
4. Once the project exists (deploy finished, even if it shows "Failed"),
   go to its **Storage** tab → **Create Database** → choose **Neon** →
   accept the free plan → give it a name → create. When it finishes, click
   **Connect Project**, pick this project, and leave all environments
   checked. This auto-injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`
   into the project — you never see or copy a connection string yourself.
5. Go to **Settings → Environment Variables** and add two:
   - `MEDSTUDY_PIN` → the PIN you'll type to unlock the app
   - `MEDSTUDY_SESSION_SECRET` → any long random string
   (`ANTHROPIC_API_KEY` isn't needed until Stage 2 — skip it for now.)
6. Go to the **Deployments** tab, open the (failed) deployment from step 3,
   click the **"..."** menu → **Redeploy**. This build now has the database
   and PIN available, so it applies the database migration, loads a
   starter deck, and builds successfully.
7. Open the `https://....vercel.app` URL it gives you on your tablet (and
   phone, and PC) and "Add to Home Screen" — it's a PWA, so it installs
   like a native app. Same URL, same data, every device.

If a step doesn't match what you see on screen, stop and tell me exactly
what's there (or send a screenshot) rather than guessing — that's what went
wrong last time.

**If you ever paste a real connection string into a chat with Claude** (or
anywhere else outside your own `.env` file), treat that password as
compromised and reset it from the database dashboard afterward — it's now
sitting in a transcript.

## Local development

```bash
npm install                                  # installs both workspaces
cp server/.env.example server/.env           # then edit DATABASE_URL/PIN/secret
npm run db:migrate                           # creates tables in your Postgres
npm run db:seed                              # loads a small starter deck
```

`server/.env` needs a real Postgres `DATABASE_URL` (and
`DATABASE_URL_UNPOOLED` — for a plain local Postgres instance these are just
the same value; only Neon-style pooled setups need them to differ). Then:

```bash
npm run dev:server   # terminal 1 — API on :4000
npm run dev:web      # terminal 2 — Vite dev server, proxies /api to :4000
```

Or to run it the way it runs in production (one process, built assets):

```bash
npm run build:server
npm run build:web
npm start
```

## Project layout

```
server/            Express + TypeScript API, Prisma/Postgres, FSRS scheduling
  src/app.ts          API-only Express app (no listen, no static serving)
  src/index.ts         self-hosted entrypoint: app.ts + static PWA + listen()
web/                React + TypeScript + Tailwind PWA
api/index.ts        Vercel serverless function entrypoint, wraps server/dist/app.js
vercel.json         Vercel build/routing config (see "Hosted deploy" above)
```

See `server/prisma/schema.prisma` for the full data model (concepts, items,
attempts, confusion pairs, mastery scores, review state).
