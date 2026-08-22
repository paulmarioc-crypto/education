import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { cardToRowData, newCard, Rating, rowToCard, schedule } from "../lib/fsrs.js";
import { updateMasteryForItem } from "../lib/mastery.js";

export const attemptsRouter = Router();

// Either a flashcard-style self-grade (1-4, FSRS Rating) or an MCQ-style
// correct/incorrect outcome (diagnosis/anatomy/quiz modules, stages 2+).
// Exactly one of `rating` / `correct` must be present; both feed the same
// FSRS schedule + mastery update pipeline so no module is a scoring silo.
const attemptSchema = z
  .object({
    itemId: z.string().min(1),
    selectedAnswer: z.string().min(1),
    responseTimeMs: z.number().int().min(0),
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    correct: z.boolean().optional(),
  })
  .refine((v) => (v.rating !== undefined) !== (v.correct !== undefined), {
    message: "provide exactly one of `rating` or `correct`",
  });

attemptsRouter.post("/", async (req, res) => {
  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { itemId, selectedAnswer, responseTimeMs, rating, correct: correctIn } = parsed.data;

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return res.status(404).json({ error: "item not found" });

  const grade = rating ?? (correctIn ? Rating.Good : Rating.Again);
  const correct = rating !== undefined ? rating !== Rating.Again : (correctIn as boolean);

  const now = new Date();
  const existingState = await prisma.reviewState.findUnique({ where: { itemId } });
  const card = existingState ? rowToCard(existingState) : newCard(now);

  const { card: nextCard } = schedule(card, now, grade);
  const rowData = cardToRowData(nextCard);

  await prisma.$transaction([
    prisma.reviewState.upsert({
      where: { itemId },
      create: { itemId, ...rowData },
      update: rowData,
    }),
    prisma.attempt.create({
      data: {
        itemId,
        correct,
        selectedAnswer,
        responseTimeMs,
        module: item.module,
      },
    }),
  ]);

  await updateMasteryForItem(itemId, correct, responseTimeMs, item.difficulty);

  res.json({ correct, due: rowData.due, stability: rowData.stability, state: rowData.state });
});
