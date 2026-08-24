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

1. **Push this repo to GitHub** if you haven't (it's already on the
   `claude/medstudy-learning-app-azh5m7` branch).
2. **[vercel.com](https://vercel.com):** sign up (GitHub login is easiest),
   "Add New" → "Project", import this repo. Vercel reads `vercel.json` at
   the repo root and configures the build/output automatically — you
   shouldn't need to change any build settings.
3. Before or after the first deploy, add environment variables (Project →
   Settings → Environment Variables):
   - `MEDSTUDY_PIN` → the PIN you'll type to unlock the app
   - `MEDSTUDY_SESSION_SECRET` → any long random string
   - `ANTHROPIC_API_KEY` → needed from Stage 2+, can leave blank for now
4. **Add the database** — Project → Storage → "Connect Database" (or
   "Create Database" from the Marketplace) → choose **Neon**. Accept the
   free plan. This is the step that replaces all the manual Neon
   sign-up/connection-string copying from before: Vercel creates the Neon
   project for you and injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`
   into your project automatically — you never see or paste a connection
   string.
5. Redeploy (Vercel does this automatically after you connect a database,
   or trigger one manually from the Deployments tab). The build runs
   `prisma migrate deploy` as part of `npm run build:server`, so the
   database gets its tables on this deploy. Check the build log if
   anything fails.
6. Vercel gives you a URL like `https://medstudy-xxxx.vercel.app`. Open
   that on your tablet (and phone, and PC) and "Add to Home Screen" — it's
   a PWA, so it installs like a native app. Same URL, same data, every
   device.

Note: because this is a genuine architecture change (the API now runs as a
serverless function per-request, not a long-running process — see "Project
layout" below), if the first deploy hits an error I haven't seen before,
paste me the exact text from Vercel's build or function logs and I'll fix it.

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
