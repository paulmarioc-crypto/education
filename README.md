# MedStudy

Personalized diagnosis & anatomy learning app: a shared spaced-repetition +
mastery/confusion-tracking engine underneath four study modules (Diagnosis
Game, Anatomy Guesser, Adaptive Quiz Engine, Recall/Review).

Architecture: **hosted, single-user, no login.** The app deploys to Vercel
(free, no credit card) with Postgres from Neon via Vercel's Marketplace
integration. Your phone, tablet, and PC all just open one URL; nothing runs
locally. The API is a serverless function (`api/index.ts` → `server/src/app.ts`);
`server/src/index.ts` is a separate self-hosted entrypoint kept around in
case you ever want to run this on your own machine instead.

There's no PIN or login screen — anyone with the URL can open the app. That's
an intentional simplicity tradeoff for a personal project behind an
unguessable `.vercel.app` link; if that stops being acceptable later, auth
can be added back.

AI features (Diagnosis Game, Quiz upload) run on **free, open-weight models
via Groq** (`openai/gpt-oss-120b` for text, `meta-llama/llama-4-scout` for
vision) — a deliberate cost-vs-accuracy tradeoff: genuinely $0, but weaker
medical reasoning than a hosted proprietary model. Diagnosis cases are
grounded in live PubMed retrieval to offset this (real peer-reviewed sources
cited, not just model recall); when no source is found, the app says so
prominently rather than presenting unsourced content as verified. Requires
`GROQ_API_KEY` (free, no credit card — sign up at
[console.groq.com](https://console.groq.com)) set in Vercel's Environment
Variables.

Currently implemented (Stages 1-3 of the build order): the data model, FSRS
spaced-repetition core, flashcard review, the Diagnosis Game, and Quiz Mode A
(upload PDF/PPTX/DOCX/images → AI-generated questions). Remaining modules
(Anatomy Guesser, topic-only quiz generation, diagnosis chat, mistake-diagnosis
engine, gamification) land in later stages.

## Deploying changes

The app is already live on Vercel, connected to this GitHub repo on the
`claude/medstudy-learning-app-azh5m7` branch. Every push to that branch
triggers a new deploy automatically — Vercel's build runs the database
migration, seeds any new starter content, and builds both the API and the
web app (`vercel.json` at the repo root controls this). Nothing manual is
needed for routine changes.

If a deploy ever fails, the Vercel dashboard's Deployments tab → the failed
deployment → build log has the error — paste that here and it can be
diagnosed and fixed.

## Local development

```bash
npm install                                  # installs both workspaces
cp server/.env.example server/.env           # then edit DATABASE_URL
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
vercel.json         Vercel build/routing config
```

See `server/prisma/schema.prisma` for the full data model (concepts, items,
attempts, confusion pairs, mastery scores, review state).
