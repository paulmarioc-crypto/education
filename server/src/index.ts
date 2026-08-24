import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "./app.js";
import { env } from "./lib/env.js";

// Self-hosted entrypoint: adds static PWA serving on top of the API-only
// app, so one process serves everything on your own machine/LAN. Not used
// by the Vercel deploy (see ../../api/index.ts), which serves the built PWA
// via Vercel's static hosting instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../../web/dist");

app.use(express.static(webDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

// Bind 0.0.0.0, not localhost, so devices on your home network can reach this.
app.listen(env.port, "0.0.0.0", () => {
  console.log(`MedStudy server listening on http://0.0.0.0:${env.port}`);
});
