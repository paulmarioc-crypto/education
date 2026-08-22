# MedStudy

Personalized diagnosis & anatomy learning app: a shared spaced-repetition +
mastery/confusion-tracking engine underneath four study modules (Diagnosis
Game, Anatomy Guesser, Adaptive Quiz Engine, Recall/Review).

Architecture: **local-first, self-hosted.** The server (Express + SQLite)
runs on your computer and also serves the built web app, so your phone and
tablet reach it over your home network — no cloud hosting. See
`server/src/index.ts` for how the API and static app share one port.

Currently implemented (Stage 1 of the build order): the data model, FSRS
spaced-repetition core, PIN auth, and a barebones flashcard review UI. The
other modules (Diagnosis Game, Anatomy Guesser, Quiz Engine, mistake-diagnosis
engine, gamification) land in later stages.

## Setup

```bash
npm install                                  # installs both workspaces
cp server/.env.example server/.env           # then edit the PIN + secret
npm run db:migrate -w server                 # creates the SQLite DB
npm run db:seed                              # loads a small starter deck
```

Edit `server/.env`:
- `MEDSTUDY_PIN` — the PIN you'll type to unlock the app on any device.
- `MEDSTUDY_SESSION_SECRET` — any long random string, used to sign the login
  session cookie.
- `ANTHROPIC_API_KEY` — needed starting Stage 2+ for AI-generated content;
  not required for Stage 1.

## Running it day-to-day

Build the web app and start the server — one process serves everything:

```bash
npm run build:web
npm run build:server
npm start
```

Or for active development (hot reload on both sides):

```bash
npm run dev:server   # terminal 1 — API on :4000
npm run dev:web      # terminal 2 — Vite dev server, proxies /api to :4000
```

## Using it from your phone/tablet

The server binds `0.0.0.0`, so once it's running (via `npm start`, not the
Vite dev server) on your computer, find your computer's LAN IP
(`ip addr` / `ipconfig getifaddr en0` / Settings → Network) and visit
`http://<that-ip>:4000` from your iPhone or Android tablet's browser. Add it
to your home screen ("Add to Home Screen" / "Install app") to use it like a
native app — it's a PWA, so it installs and caches the app shell for
offline-ish use once a session's data has loaded.

Both devices need to be on the same home network. If you want access away
from home later, the straightforward option is a personal VPN/mesh network
(e.g. Tailscale) between your phone/tablet and the UM760 — that's out of
scope for now but worth revisiting once the core app is in daily use.

## Project layout

```
server/   Express + TypeScript API, Prisma/SQLite, FSRS scheduling
web/      React + TypeScript + Tailwind PWA
```

See `server/prisma/schema.prisma` for the full data model (concepts, items,
attempts, confusion pairs, mastery scores, review state).
