import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const confusionsRouter = Router();

confusionsRouter.get("/", async (_req, res) => {
  const pairs = await prisma.confusionPair.findMany({
    where: { resolved: false },
    include: { conceptA: true, conceptB: true },
    orderBy: { updatedAt: "desc" },
  });

  res.json(
    pairs.map((p) => ({
      id: p.id,
      conceptA: p.conceptA.name,
      conceptB: p.conceptB.name,
      correctStreak: p.correctStreak,
      confidence: p.confidence,
    }))
  );
});
