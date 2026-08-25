import type { Module } from "@prisma/client";
import { prisma } from "./prisma.js";
import { cardToRowData, newCard, Rating, rowToCard, schedule, type FsrsGrade } from "./fsrs.js";
import { updateMasteryForItem } from "./mastery.js";

/**
 * Records one attempt against the shared FSRS/mastery pipeline. Used by every
 * module (flashcards, diagnosis cases, and later quiz/anatomy) so no module
 * is a scoring silo.
 */
export async function recordAttempt(params: {
  itemId: string;
  correct: boolean;
  selectedAnswer: string;
  responseTimeMs: number;
  module: Module;
  difficulty: number;
  grade?: FsrsGrade;
}) {
  const grade = params.grade ?? (params.correct ? Rating.Good : Rating.Again);
  const now = new Date();
  const existingState = await prisma.reviewState.findUnique({ where: { itemId: params.itemId } });
  const card = existingState ? rowToCard(existingState) : newCard(now);
  const { card: nextCard } = schedule(card, now, grade);
  const rowData = cardToRowData(nextCard);

  await prisma.$transaction([
    prisma.reviewState.upsert({
      where: { itemId: params.itemId },
      create: { itemId: params.itemId, ...rowData },
      update: rowData,
    }),
    prisma.attempt.create({
      data: {
        itemId: params.itemId,
        correct: params.correct,
        selectedAnswer: params.selectedAnswer,
        responseTimeMs: params.responseTimeMs,
        module: params.module,
      },
    }),
  ]);

  await updateMasteryForItem(params.itemId, params.correct, params.responseTimeMs, params.difficulty);
  return rowData;
}
