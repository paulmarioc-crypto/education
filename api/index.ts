// Vercel serverless function entrypoint. Imports the already-compiled API-only
// app (built by `npm run build:server` as part of the Vercel build step) so
// this file is a trivial, unambiguous single-file TS->JS transpile with no
// cross-workspace TS module resolution for Vercel's bundler to figure out.
export { app as default } from "../server/dist/app.js";
