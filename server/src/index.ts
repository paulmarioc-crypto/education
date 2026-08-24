import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./lib/env.js";
import { requireAuth } from "./lib/auth.js";
import { authRouter } from "./routes/auth.js";
import { sessionRouter } from "./routes/session.js";
import { attemptsRouter } from "./routes/attempts.js";
import { conceptsRouter } from "./routes/concepts.js";
import { itemsRouter } from "./routes/items.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Trust the first hop's X-Forwarded-Proto (Render and similar platforms
// terminate TLS in front of the app) so req.secure reflects the real scheme
// for the session cookie's `secure` flag. Harmless for self-hosted plain HTTP.
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/session", requireAuth, sessionRouter);
app.use("/api/attempts", requireAuth, attemptsRouter);
app.use("/api/concepts", requireAuth, conceptsRouter);
app.use("/api/items", requireAuth, itemsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// In production, serve the built PWA from the same origin/port as the API
// so your phone/tablet only need one address on the LAN.
const webDist = path.resolve(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

// Bind 0.0.0.0, not localhost, so devices on your home network can reach this.
app.listen(env.port, "0.0.0.0", () => {
  console.log(`MedStudy server listening on http://0.0.0.0:${env.port}`);
});
