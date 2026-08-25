import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { detectUploadKind, extractText } from "../services/extraction.js";
import { generateQuizFromImage, generateQuizFromText, type GeneratedQuizQuestion } from "../services/llm.js";
import type { QuizQuestionAnswer, QuizQuestionPrompt } from "../lib/itemTypes.js";

export const quizRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

async function persistQuestions(questions: GeneratedQuizQuestion[], uploadId: string) {
  let created = 0;
  const conceptsSeen = new Set<string>();

  for (const q of questions) {
    if (!q.choices.includes(q.correctChoice)) continue; // guard against a malformed generation

    let systemConcept = await prisma.conceptNode.findFirst({ where: { name: q.conceptSystem, kind: "TOPIC" } });
    if (!systemConcept) {
      systemConcept = await prisma.conceptNode.create({ data: { name: q.conceptSystem, kind: "TOPIC" } });
    }
    let concept = await prisma.conceptNode.findFirst({ where: { name: q.concept, kind: "TOPIC", parentId: systemConcept.id } });
    if (!concept) {
      concept = await prisma.conceptNode.create({ data: { name: q.concept, kind: "TOPIC", parentId: systemConcept.id } });
    }
    conceptsSeen.add(concept.name);

    const prompt: QuizQuestionPrompt = { question: q.question, choices: q.choices, bloomLevel: q.bloomLevel };
    const answerKey: QuizQuestionAnswer = { correctChoice: q.correctChoice, explanation: q.explanation };

    await prisma.item.create({
      data: {
        type: "QUIZ_QUESTION",
        module: "QUIZ",
        prompt: JSON.stringify(prompt),
        answerKey: JSON.stringify(answerKey),
        difficulty: Math.max(0, Math.min(1, q.difficulty)),
        source: "AI_UPLOAD",
        sourceRef: uploadId,
        concepts: { create: [{ conceptId: concept.id }] },
      },
    });
    created++;
  }

  return { created, concepts: [...conceptsSeen] };
}

quizRouter.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "no file uploaded" });

  const kind = detectUploadKind(file.mimetype, file.originalname);
  if (!kind) {
    return res.status(400).json({ error: "unsupported file type — use PDF, DOCX, PPTX, or an image (jpg/png/gif/webp)" });
  }

  const uploadRow = await prisma.upload.create({
    data: { filename: file.originalname, mimeType: file.mimetype, status: "processing" },
  });

  try {
    let questions: GeneratedQuizQuestion[];

    if (kind === "image") {
      if (!IMAGE_MEDIA_TYPES.has(file.mimetype)) {
        throw new Error(`Unsupported image type ${file.mimetype} — use jpg, png, gif, or webp`);
      }
      questions = await generateQuizFromImage(file.buffer.toString("base64"), file.mimetype as "image/jpeg" | "image/png" | "image/gif" | "image/webp");
      await prisma.upload.update({ where: { id: uploadRow.id }, data: { status: "done" } });
    } else {
      const text = await extractText(kind, file.buffer);
      if (text.trim().length < 50) {
        throw new Error("Could not find enough readable text in this file — it may be scanned images without a text layer.");
      }
      questions = await generateQuizFromText(text);
      await prisma.upload.update({ where: { id: uploadRow.id }, data: { status: "done", extractedText: text.slice(0, 5000) } });
    }

    const { created, concepts } = await persistQuestions(questions, uploadRow.id);
    res.json({ uploadId: uploadRow.id, questionsCreated: created, concepts });
  } catch (err) {
    console.error("POST /api/quiz/upload failed:", err);
    await prisma.upload.update({ where: { id: uploadRow.id }, data: { status: "failed" } });
    const message = err instanceof Error ? err.message : "Could not process this file. Please try again.";
    res.status(502).json({ error: message });
  }
});
