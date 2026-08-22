import { prisma } from "./prisma.js";

const K_FACTOR = 32;
const BASE_SCORE = 1000;

// Map an item's 0..1 difficulty rating onto an Elo-like opponent rating, so
// getting a hard item right moves mastery more than getting an easy one right.
function difficultyToRating(difficulty: number): number {
  return BASE_SCORE + (difficulty - 0.5) * 800;
}

function expectedScore(userRating: number, itemRating: number): number {
  return 1 / (1 + 10 ** ((itemRating - userRating) / 400));
}

// Fast correct answers are weighted slightly more (more confident recall);
// very slow correct answers slightly less. Kept small on purpose — accuracy
// dominates, speed is a minor modifier, not the point of the score.
function speedFactor(responseTimeMs: number): number {
  if (responseTimeMs < 8_000) return 1.1;
  if (responseTimeMs > 30_000) return 0.9;
  return 1.0;
}

/**
 * Update mastery score for every concept an item is tagged to, given the
 * outcome of one attempt. Creates a MasteryScore row (seeded at BASE_SCORE)
 * on first attempt for a concept.
 */
export async function updateMasteryForItem(
  itemId: string,
  correct: boolean,
  responseTimeMs: number,
  itemDifficulty: number
) {
  const links = await prisma.itemConcept.findMany({ where: { itemId }, select: { conceptId: true } });
  if (links.length === 0) return;

  const itemRating = difficultyToRating(itemDifficulty);
  const actual = correct ? 1 : 0;
  const factor = correct ? speedFactor(responseTimeMs) : 1.0;

  for (const { conceptId } of links) {
    const existing = await prisma.masteryScore.findUnique({ where: { conceptId } });
    const currentScore = existing?.score ?? BASE_SCORE;
    const expected = expectedScore(currentScore, itemRating);
    const nextScore = currentScore + K_FACTOR * factor * (actual - expected);

    await prisma.masteryScore.upsert({
      where: { conceptId },
      create: {
        conceptId,
        score: nextScore,
        attemptsCount: 1,
        correctCount: correct ? 1 : 0,
      },
      update: {
        score: nextScore,
        attemptsCount: { increment: 1 },
        correctCount: correct ? { increment: 1 } : undefined,
        lastUpdated: new Date(),
      },
    });
  }
}

/** 0..1 mastery score normalized from the Elo-like rating, for UI display and difficulty scaling. */
export function normalizeMastery(score: number): number {
  const clamped = Math.max(400, Math.min(1900, score));
  return (clamped - 400) / 1500;
}
