import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { normalizeMastery } from "../lib/mastery.js";
import { recordAttempt } from "../lib/grading.js";
import { detectAndRecordConfusion } from "../lib/confusion.js";
import type { AnatomyIdAnswer } from "../lib/itemTypes.js";

export const anatomyRouter = Router();

// Picks the next Anatomy Guesser round: prefers items never attempted, then
// (once the small starter library is exhausted at least once) cycles through
// all of them, biased toward the difficulty nearest current structure
// mastery — the "start with major structures, progressively narrow to fine
// distinctions" scaling from the spec, applied over the seeded item pool
// rather than AI generation (there's no reliable free source of real,
// correctly-pinned anatomy images to generate against).
anatomyRouter.get("/next", async (_req, res) => {
  const items = await prisma.item.findMany({ where: { type: "ANATOMY_ID", flagged: false } });
  if (items.length === 0) {
    return res.status(404).json({ error: "No anatomy items yet." });
  }

  const attempted = await prisma.attempt.findMany({
    where: { item: { type: "ANATOMY_ID" } },
    select: { itemId: true },
    distinct: ["itemId"],
  });
  const attemptedIds = new Set(attempted.map((a) => a.itemId));
  const pool = items.filter((i) => !attemptedIds.has(i.id));
  const candidates = pool.length > 0 ? pool : items;

  const scores = await prisma.masteryScore.findMany({ where: { concept: { kind: "STRUCTURE" } } });
  const avgMastery = scores.length > 0 ? scores.reduce((sum, r) => sum + normalizeMastery(r.score), 0) / scores.length : 0.2;

  const sorted = [...candidates].sort((a, b) => Math.abs(a.difficulty - avgMastery) - Math.abs(b.difficulty - avgMastery));
  // Small random jitter among the closest few so it's not perfectly deterministic.
  const item = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];

  res.json(item);
});

const attemptSchema = z.object({
  itemId: z.string().min(1),
  selectedChoice: z.string().min(1),
  responseTimeMs: z.number().int().min(0),
});

anatomyRouter.post("/attempt", async (req, res) => {
  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { itemId, selectedChoice, responseTimeMs } = parsed.data;

  const item = await prisma.item.findUnique({ where: { id: itemId }, include: { concepts: true } });
  if (!item || item.type !== "ANATOMY_ID") return res.status(404).json({ error: "item not found" });

  const answerKey = JSON.parse(item.answerKey) as AnatomyIdAnswer;
  const correct = selectedChoice === answerKey.correctChoice;

  await recordAttempt({
    itemId,
    correct,
    selectedAnswer: selectedChoice,
    responseTimeMs,
    module: "ANATOMY",
    difficulty: item.difficulty,
  });

  let confusionNote: string | undefined;
  if (!correct) {
    const correctConceptId = item.concepts[0]?.conceptId;
    const guessedConcept = await prisma.conceptNode.findFirst({
      where: { kind: "STRUCTURE", name: { equals: selectedChoice, mode: "insensitive" } },
    });
    if (correctConceptId) {
      const confusion = await detectAndRecordConfusion({
        correctConceptId,
        correctLabel: answerKey.correctChoice,
        guessedConceptId: guessedConcept?.id ?? null,
        guessedLabel: selectedChoice,
        context: "anatomy structure identification game",
      });
      confusionNote = confusion?.explanation;
    }
  }

  res.json({ correct, confusionNote });
});
