import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { normalizeMastery } from "../lib/mastery.js";
import { recordAttempt } from "../lib/grading.js";
import { detectAndRecordConfusion } from "../lib/confusion.js";
import { generateDiagnosisCase, classifyGuess, chatAboutCase } from "../services/llm.js";
import { searchPubMedBroad } from "../services/pubmed.js";
import type { DiagnosisCaseAnswer, DiagnosisCasePrompt } from "../lib/itemTypes.js";

export const diagnosisRouter = Router();

// Rotating pool of common pre-med/med-school diagnoses across systems, used
// when there's no mastery data yet to weight toward weak spots. Not a
// content bank — just search/generation seeds; the actual case content is
// always freshly generated and PubMed-grounded.
const DIAGNOSIS_POOL: { name: string; system: string }[] = [
  { name: "Acute myocardial infarction", system: "Cardiovascular" },
  { name: "Community-acquired pneumonia", system: "Pulmonary" },
  { name: "Acute appendicitis", system: "Gastrointestinal" },
  { name: "Diabetic ketoacidosis", system: "Endocrine" },
  { name: "Acute pyelonephritis", system: "Renal/Urologic" },
  { name: "Ischemic stroke", system: "Neurologic" },
  { name: "Deep vein thrombosis", system: "Vascular" },
  { name: "Acute pancreatitis", system: "Gastrointestinal" },
  { name: "Congestive heart failure exacerbation", system: "Cardiovascular" },
  { name: "Bacterial meningitis", system: "Neurologic" },
  { name: "Peptic ulcer disease", system: "Gastrointestinal" },
  { name: "Pulmonary embolism", system: "Pulmonary" },
  { name: "Graves disease (hyperthyroidism)", system: "Endocrine" },
  { name: "Acute cholecystitis", system: "Gastrointestinal" },
  { name: "Sickle cell vaso-occlusive crisis", system: "Hematologic" },
  { name: "Ectopic pregnancy", system: "Reproductive" },
  { name: "Acute otitis media", system: "ENT" },
  { name: "Rheumatoid arthritis flare", system: "Musculoskeletal" },
];

async function pickTopic(): Promise<{ name: string; system: string }> {
  const weakest = await prisma.masteryScore.findMany({
    where: { concept: { kind: "DIAGNOSIS" } },
    orderBy: { score: "asc" },
    take: 3,
    include: { concept: true },
  });
  // Weight toward weak spots when there's mastery data to act on, otherwise
  // (and 40% of the time regardless, for variety) pick from the rotation.
  if (weakest.length > 0 && Math.random() < 0.6) {
    const pick = weakest[Math.floor(Math.random() * weakest.length)];
    const parent = pick.concept.parentId
      ? await prisma.conceptNode.findUnique({ where: { id: pick.concept.parentId } })
      : null;
    return { name: pick.concept.name, system: parent?.name ?? "General Medicine" };
  }
  return DIAGNOSIS_POOL[Math.floor(Math.random() * DIAGNOSIS_POOL.length)];
}

async function averageDiagnosisMastery(): Promise<number> {
  const scores = await prisma.masteryScore.findMany({ where: { concept: { kind: "DIAGNOSIS" } } });
  if (scores.length === 0) return 0.4;
  return scores.reduce((sum, r) => sum + normalizeMastery(r.score), 0) / scores.length;
}

diagnosisRouter.post("/new", async (_req, res) => {
  try {
    const topic = await pickTopic();
    const difficulty = await averageDiagnosisMastery();
    const sources = await searchPubMedBroad(topic.name);
    const generated = await generateDiagnosisCase({ topic: topic.name, difficulty, sources });

    let systemConcept = await prisma.conceptNode.findFirst({ where: { name: generated.organSystem, kind: "SYSTEM" } });
    if (!systemConcept) {
      systemConcept = await prisma.conceptNode.create({ data: { name: generated.organSystem, kind: "SYSTEM" } });
    }
    let diagnosisConcept = await prisma.conceptNode.findFirst({ where: { name: generated.diagnosis, kind: "DIAGNOSIS" } });
    if (!diagnosisConcept) {
      diagnosisConcept = await prisma.conceptNode.create({
        data: { name: generated.diagnosis, kind: "DIAGNOSIS", parentId: systemConcept.id },
      });
    }

    const prompt: DiagnosisCasePrompt = {
      vignette: generated.vignette,
      history: generated.history,
      exam: generated.exam,
      labs: generated.labs,
      imaging: generated.imaging,
    };
    const answerKey: DiagnosisCaseAnswer = {
      diagnosis: generated.diagnosis,
      organSystem: generated.organSystem,
      acuity: generated.acuity,
      keyDiscriminators: generated.keyDiscriminators,
      explanation: generated.explanation,
    };

    const item = await prisma.item.create({
      data: {
        type: "DIAGNOSIS_CASE",
        module: "DIAGNOSIS",
        prompt: JSON.stringify(prompt),
        answerKey: JSON.stringify(answerKey),
        difficulty,
        source: "AI_TOPIC",
        sourceRef: generated.citations.map((c) => c.pmid).join(",") || null,
        concepts: { create: [{ conceptId: diagnosisConcept.id }] },
      },
    });

    res.json({ itemId: item.id, prompt, citations: generated.citations, groundedInSources: sources.length > 0 });
  } catch (err) {
    console.error("POST /api/diagnosis/new failed:", err);
    res.status(502).json({ error: "Could not generate a case right now. Please try again." });
  }
});

const guessSchema = z.object({
  itemId: z.string().min(1),
  guess: z.string().min(1),
  responseTimeMs: z.number().int().min(0),
});

diagnosisRouter.post("/guess", async (req, res) => {
  const parsed = guessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { itemId, guess, responseTimeMs } = parsed.data;

  const item = await prisma.item.findUnique({ where: { id: itemId }, include: { concepts: true } });
  if (!item || item.type !== "DIAGNOSIS_CASE") return res.status(404).json({ error: "case not found" });
  const answerKey = JSON.parse(item.answerKey) as DiagnosisCaseAnswer;

  let feedback;
  try {
    feedback = await classifyGuess({
      guess,
      correctDiagnosis: answerKey.diagnosis,
      organSystem: answerKey.organSystem,
      acuity: answerKey.acuity,
      keyDiscriminators: answerKey.keyDiscriminators,
    });
  } catch (err) {
    console.error("POST /api/diagnosis/guess classification failed:", err);
    return res.status(502).json({ error: "Could not grade that guess right now. Please try again." });
  }

  // Only the first guess on a case grades it (standard spaced-repetition
  // convention) — later guesses in the same round are a learning aid.
  const alreadyGraded = (await prisma.attempt.count({ where: { itemId } })) > 0;
  let confusionNote: string | undefined;
  if (!alreadyGraded) {
    await recordAttempt({
      itemId,
      correct: feedback.correct,
      selectedAnswer: guess,
      responseTimeMs,
      module: "DIAGNOSIS",
      difficulty: item.difficulty,
    });

    if (!feedback.correct) {
      const correctConceptId = item.concepts[0]?.conceptId;
      const guessedConcept = await prisma.conceptNode.findFirst({
        where: { kind: "DIAGNOSIS", name: { equals: guess, mode: "insensitive" } },
      });
      if (correctConceptId) {
        const confusion = await detectAndRecordConfusion({
          correctConceptId,
          correctLabel: answerKey.diagnosis,
          guessedConceptId: guessedConcept?.id ?? null,
          guessedLabel: guess,
          context: "diagnosis game — guessing a diagnosis from a case vignette",
        });
        confusionNote = confusion?.explanation;
      }
    }
  }

  res.json({ ...feedback, answer: feedback.correct ? answerKey : undefined, confusionNote });
});

diagnosisRouter.post("/:itemId/reveal", async (req, res) => {
  const item = await prisma.item.findUnique({ where: { id: req.params.itemId } });
  if (!item || item.type !== "DIAGNOSIS_CASE") return res.status(404).json({ error: "case not found" });

  const alreadyGraded = (await prisma.attempt.count({ where: { itemId: item.id } })) > 0;
  if (!alreadyGraded) {
    await recordAttempt({
      itemId: item.id,
      correct: false,
      selectedAnswer: "(revealed)",
      responseTimeMs: req.body?.responseTimeMs ?? 0,
      module: "DIAGNOSIS",
      difficulty: item.difficulty,
    });
  }

  res.json(JSON.parse(item.answerKey) as DiagnosisCaseAnswer);
});

const chatSchema = z.object({
  question: z.string().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
});

// Scoped Q&A about a case, available once it's been resolved (per spec: "After
// I guess (right or wrong), open a chat panel"). Not graded — exploratory only,
// so it doesn't touch Attempt/FSRS/mastery.
diagnosisRouter.post("/:itemId/chat", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const item = await prisma.item.findUnique({ where: { id: req.params.itemId } });
  if (!item || item.type !== "DIAGNOSIS_CASE") return res.status(404).json({ error: "case not found" });

  const prompt = JSON.parse(item.prompt) as DiagnosisCasePrompt;
  const answerKey = JSON.parse(item.answerKey) as DiagnosisCaseAnswer;
  const caseContext =
    `Vignette: ${prompt.vignette}\nHistory: ${prompt.history}\nExam: ${prompt.exam}\n` +
    `Labs: ${prompt.labs}\nImaging: ${prompt.imaging}\n\n` +
    `Correct diagnosis: ${answerKey.diagnosis}\nOrgan system: ${answerKey.organSystem}\nAcuity: ${answerKey.acuity}\n` +
    `Key discriminators: ${answerKey.keyDiscriminators.join("; ")}\nExplanation: ${answerKey.explanation}`;

  try {
    const answer = await chatAboutCase({ caseContext, history: parsed.data.history ?? [], question: parsed.data.question });
    res.json({ answer });
  } catch (err) {
    console.error("POST /api/diagnosis/:itemId/chat failed:", err);
    res.status(502).json({ error: "Could not answer that right now. Please try again." });
  }
});
