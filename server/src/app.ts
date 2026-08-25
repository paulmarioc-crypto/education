import "dotenv/config";
import express from "express";
import { sessionRouter } from "./routes/session.js";
import { attemptsRouter } from "./routes/attempts.js";
import { conceptsRouter } from "./routes/concepts.js";
import { itemsRouter } from "./routes/items.js";
import { diagnosisRouter } from "./routes/diagnosis.js";
import { quizRouter } from "./routes/quiz.js";
import { anatomyRouter } from "./routes/anatomy.js";
import { confusionsRouter } from "./routes/confusions.js";

// API-only Express app, with no app.listen() and no static file serving —
// both the self-hosted entrypoint (index.ts) and the Vercel serverless
// function (../../api/index.ts) wrap this same app differently.
export const app = express();

app.set("trust proxy", 1);
app.use(express.json());

app.use("/api/session", sessionRouter);
app.use("/api/attempts", attemptsRouter);
app.use("/api/concepts", conceptsRouter);
app.use("/api/items", itemsRouter);
app.use("/api/diagnosis", diagnosisRouter);
app.use("/api/quiz", quizRouter);
app.use("/api/anatomy", anatomyRouter);
app.use("/api/confusions", confusionsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
