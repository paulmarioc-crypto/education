import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { normalizeMastery } from "../lib/mastery.js";

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
