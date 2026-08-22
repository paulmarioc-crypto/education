import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const sessionRouter = Router();

const NEW_ITEM_LIMIT = 10;

/**
 * Today's session composition: due reviews first, then unseen ("new") items.
 * Weak-spot drills (stage 6/7, once confusion pairs + multiple modules exist)
 * will slot in here as a third bucket per the daily-session design.
 */
sessionRouter.get("/today", async (_req, res) => {
  const now = new Date();

  const dueStates = await prisma.reviewState.findMany({
    where: { due: { lte: now } },
    orderBy: { due: "asc" },
    include: { item: { include: { concepts: { include: { concept: true } } } } },
  });

  const newItems = await prisma.item.findMany({
    where: { reviewState: null, flagged: false },
    orderBy: { createdAt: "asc" },
    take: NEW_ITEM_LIMIT,
    include: { concepts: { include: { concept: true } } },
  });

  res.json({
    due: dueStates.map((s) => s.item),
    new: newItems,
    counts: { due: dueStates.length, new: newItems.length, weak: 0 },
  });
});
