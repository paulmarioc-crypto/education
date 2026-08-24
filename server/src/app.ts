import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { requireAuth } from "./lib/auth.js";
import { authRouter } from "./routes/auth.js";
import { sessionRouter } from "./routes/session.js";
import { attemptsRouter } from "./routes/attempts.js";
import { conceptsRouter } from "./routes/concepts.js";
import { itemsRouter } from "./routes/items.js";

// API-only Express app, with no app.listen() and no static file serving —
// both the self-hosted entrypoint (index.ts) and the Vercel serverless
// function (../../api/index.ts) wrap this same app differently.
export const app = express();

// Trust the first hop's X-Forwarded-Proto (Vercel/Render/etc. terminate TLS
// in front of the app) so req.secure reflects the real scheme for the
// session cookie's `secure` flag. Harmless for self-hosted plain HTTP.
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/session", requireAuth, sessionRouter);
app.use("/api/attempts", requireAuth, attemptsRouter);
app.use("/api/concepts", requireAuth, conceptsRouter);
app.use("/api/items", requireAuth, itemsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
