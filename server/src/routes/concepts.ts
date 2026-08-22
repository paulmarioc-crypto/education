import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { normalizeMastery } from "../lib/mastery.js";

export const conceptsRouter = Router();

conceptsRouter.get("/", async (_req, res) => {
  const concepts = await prisma.conceptNode.findMany({
    include: { mastery: true },
    orderBy: { name: "asc" },
  });

  res.json(
    concepts.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      parentId: c.parentId,
      description: c.description,
      mastery: c.mastery ? normalizeMastery(c.mastery.score) : null,
      attemptsCount: c.mastery?.attemptsCount ?? 0,
    }))
  );
});
