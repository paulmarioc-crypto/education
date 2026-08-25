import { prisma } from "./prisma.js";
import { generateConfusionExplanation } from "../services/llm.js";
import { checkConfusionAchievements } from "./gamification.js";
import type { QuizQuestionAnswer, QuizQuestionPrompt } from "./itemTypes.js";

const RESOLUTION_STREAK = 3;

/**
 * Mistake-diagnosis engine (spec §4.5): when a wrong answer's selected choice
 * maps to a real concept (not just "wrong"), record it as a confusion pair,
 * generate a targeted contrasting explanation, and create a retest item that
 * specifically discriminates between the two — tagged AI_RETEST/pairId so
 * updateConfusionOnRetest can find it again when answered.
 *
 * Returns null when there's nothing to record (no identifiable concept was
 * confused, or the "wrong" answer maps to the same concept as correct).
 */
export async function detectAndRecordConfusion(params: {
  correctConceptId: string;
  correctLabel: string;
  guessedConceptId: string | null;
  guessedLabel: string;
  context: string;
}): Promise<{ explanation: string; retestItemId: string } | null> {
  if (!params.guessedConceptId || params.guessedConceptId === params.correctConceptId) return null;

  const [conceptAId, conceptBId] = [params.correctConceptId, params.guessedConceptId].sort();

  let generated;
  try {
    generated = await generateConfusionExplanation({
      correctConcept: params.correctLabel,
      confusedWithConcept: params.guessedLabel,
      context: params.context,
    });
  } catch (err) {
    console.error("generateConfusionExplanation failed:", err);
    return null; // A missed confusion-pair note shouldn't break the attempt flow.
  }

  const existing = await prisma.confusionPair.findUnique({
    where: { conceptAId_conceptBId: { conceptAId, conceptBId } },
  });

  const pair = existing
    ? await prisma.confusionPair.update({
        where: { id: existing.id },
        // A fresh mix-up on a pair the student had been getting right again
        // means it's not actually resolved — reopen it.
        data: { confidence: Math.min(1, existing.confidence + 0.15), correctStreak: 0, resolved: false },
      })
    : await prisma.confusionPair.create({ data: { conceptAId, conceptBId } });

  const prompt: QuizQuestionPrompt = { question: generated.retestQuestion, choices: generated.retestChoices, bloomLevel: "analysis" };
  const answerKey: QuizQuestionAnswer = { correctChoice: generated.retestCorrectChoice, explanation: generated.explanation };

  const retestItem = await prisma.item.create({
    data: {
      type: "QUIZ_QUESTION",
      module: "QUIZ",
      prompt: JSON.stringify(prompt),
      answerKey: JSON.stringify(answerKey),
      difficulty: 0.6,
      source: "AI_RETEST",
      sourceRef: pair.id,
      concepts: { create: [{ conceptId: conceptAId }, { conceptId: conceptBId }] },
    },
  });

  return { explanation: generated.explanation, retestItemId: retestItem.id };
}

/**
 * Called on every graded attempt. If the item is a confusion-pair retest
 * (source AI_RETEST, sourceRef = ConfusionPair id), advances or resets that
 * pair's correctStreak and resolves it once the streak hits the bar. Returns
 * any achievements newly unlocked by that resolution.
 */
export async function updateConfusionOnRetest(
  itemId: string,
  correct: boolean
): Promise<{ title: string; description: string }[]> {
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { source: true, sourceRef: true } });
  if (!item || item.source !== "AI_RETEST" || !item.sourceRef) return [];

  const pair = await prisma.confusionPair.findUnique({ where: { id: item.sourceRef } });
  if (!pair || pair.resolved) return [];

  const correctStreak = correct ? pair.correctStreak + 1 : 0;
  const resolved = correctStreak >= RESOLUTION_STREAK;
  await prisma.confusionPair.update({
    where: { id: pair.id },
    data: { correctStreak, resolved },
  });

  return resolved ? checkConfusionAchievements() : [];
}
