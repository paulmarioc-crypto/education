import Groq from "groq-sdk";
import { env } from "../lib/env.js";
import type { PubMedSource } from "./pubmed.js";

const client = new Groq({ apiKey: env.groqApiKey });

// Free, open-weight models on Groq's free tier (no credit card) — per the
// user's explicit choice to prioritize $0 cost over the stronger accuracy
// guarantees of a hosted proprietary model. Groq deprecated its Llama chat
// models in favor of gpt-oss for general reasoning; Llama 4 Scout is used
// for the one path that needs vision (quiz-from-image), since gpt-oss is
// text-only.
const TEXT_MODEL = "openai/gpt-oss-120b";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

/** Parses a forced tool call's JSON arguments, tolerating an open model occasionally producing malformed JSON. */
function parseToolArgs<T>(response: Groq.Chat.ChatCompletion, toolName: string): T {
  const call = response.choices[0]?.message.tool_calls?.[0];
  if (!call) throw new Error(`Model did not call ${toolName}`);
  try {
    return JSON.parse(call.function.arguments) as T;
  } catch {
    throw new Error(`Model returned malformed JSON for ${toolName}`);
  }
}

export interface GeneratedDiagnosisCase {
  vignette: string;
  history: string;
  exam: string;
  labs: string;
  imaging: string;
  diagnosis: string;
  organSystem: string;
  acuity: "acute" | "subacute" | "chronic";
  keyDiscriminators: string[];
  explanation: string;
  citations: { pmid: string; title: string }[];
}

const CASE_PARAMETERS = {
  type: "object",
  properties: {
    vignette: { type: "string", description: "The full narrative case vignette as presented to the student." },
    history: { type: "string", description: "History of present illness, as a standalone section." },
    exam: { type: "string", description: "Physical exam findings, as a standalone section." },
    labs: { type: "string", description: "Relevant labs, as a standalone section (empty string if none apply)." },
    imaging: { type: "string", description: "Relevant imaging findings, as a standalone section (empty string if none apply)." },
    diagnosis: { type: "string", description: "The single correct diagnosis name, in standard clinical terminology." },
    organSystem: { type: "string", description: "The primary organ system, e.g. 'Cardiovascular', 'Pulmonary'." },
    acuity: { type: "string", enum: ["acute", "subacute", "chronic"] },
    keyDiscriminators: {
      type: "array",
      items: { type: "string" },
      description: "2-4 features that distinguish this diagnosis from its closest differentials.",
    },
    explanation: { type: "string", description: "3-5 sentence explanation of the diagnosis and pathophysiology, for after the student answers." },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: { pmid: { type: "string" }, title: { type: "string" } },
        required: ["pmid", "title"],
      },
      description: "Only PMIDs actually used from the provided source material. Empty array if no sources were provided.",
    },
  },
  required: ["vignette", "history", "exam", "labs", "imaging", "diagnosis", "organSystem", "acuity", "keyDiscriminators", "explanation", "citations"],
};

function difficultyLabel(difficulty: number): string {
  if (difficulty < 0.35) return "a classic, textbook-typical presentation — clear-cut, minimal ambiguity";
  if (difficulty < 0.7) return "a moderately atypical presentation with one or two overlapping differentials to rule out";
  return "an atypical presentation with significant overlap with close differentials, requiring careful discrimination";
}

export async function generateDiagnosisCase(params: {
  topic: string;
  difficulty: number;
  sources: PubMedSource[];
}): Promise<GeneratedDiagnosisCase> {
  const sourcesText =
    params.sources.length > 0
      ? params.sources.map((s) => `[PMID ${s.pmid}] ${s.title} (${s.journal}, ${s.year})\n${s.abstract}`).join("\n\n---\n\n")
      : "(No peer-reviewed sources were retrieved for this topic. Ground the case only in well-established, " +
        "standard clinical teaching — do not fabricate uncertain or obscure claims. Return an empty citations array.)";

  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a medical education case-writer creating diagnosis practice cases for a pre-med/medical student " +
          "studying for coursework and board prep. Ground every clinical fact — history, exam findings, lab values, " +
          "imaging — in the provided peer-reviewed source material when it's given; do not invent findings that " +
          "contradict it. This is a study tool, not a clinical reference, so favor clarity and pedagogical value over " +
          "exhaustive realism, but never sacrifice factual accuracy for either.",
      },
      {
        role: "user",
        content:
          `Write a diagnosis case for: "${params.topic}".\n` +
          `Target difficulty: ${difficultyLabel(params.difficulty)}.\n\n` +
          `Peer-reviewed source material:\n${sourcesText}`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "submit_diagnosis_case",
          description: "Submit the generated diagnosis case.",
          parameters: CASE_PARAMETERS,
          strict: true,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "submit_diagnosis_case" } },
  });

  return parseToolArgs<GeneratedDiagnosisCase>(response, "submit_diagnosis_case");
}

export interface GuessFeedback {
  correct: boolean;
  organSystemMatch: boolean;
  acuityMatch: boolean;
  hint: string;
}

const GUESS_PARAMETERS = {
  type: "object",
  properties: {
    correct: {
      type: "boolean",
      description: "True only if the guess is clinically the same diagnosis as the correct answer (spelling/phrasing variance is fine; a different-but-related diagnosis is not correct).",
    },
    organSystemMatch: { type: "boolean", description: "True if the guessed condition, even if wrong, is in the same organ system." },
    acuityMatch: { type: "boolean", description: "True if the guessed condition, even if wrong, shares the same acuity (acute/subacute/chronic)." },
    hint: {
      type: "string",
      description: "One short, clinically-meaningful clue steering toward the answer without naming it.",
    },
  },
  required: ["correct", "organSystemMatch", "acuityMatch", "hint"],
};

export async function classifyGuess(params: {
  guess: string;
  correctDiagnosis: string;
  organSystem: string;
  acuity: string;
  keyDiscriminators: string[];
}): Promise<GuessFeedback> {
  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You grade a student's diagnosis guess against the correct answer for a study game. Be lenient about " +
          "spelling, abbreviation, and phrasing differences, but strict about clinical meaning.",
      },
      {
        role: "user",
        content:
          `Correct diagnosis: ${params.correctDiagnosis}\n` +
          `Organ system: ${params.organSystem}\n` +
          `Acuity: ${params.acuity}\n` +
          `Key discriminators: ${params.keyDiscriminators.join("; ")}\n\n` +
          `Student's guess: "${params.guess}"`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "submit_feedback",
          description: "Submit clinical-similarity feedback comparing the guess to the correct answer.",
          parameters: GUESS_PARAMETERS,
          strict: true,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "submit_feedback" } },
  });

  return parseToolArgs<GuessFeedback>(response, "submit_feedback");
}

export interface GeneratedQuizQuestion {
  concept: string;
  conceptSystem: string;
  bloomLevel: "recall" | "application" | "analysis";
  question: string;
  choices: string[];
  correctChoice: string;
  explanation: string;
  difficulty: number;
}

const QUIZ_PARAMETERS = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          concept: { type: "string", description: "The specific concept/topic this question tests, e.g. 'Frank-Starling mechanism'." },
          conceptSystem: { type: "string", description: "Broader grouping for the concept, e.g. 'Cardiovascular Physiology'." },
          bloomLevel: { type: "string", enum: ["recall", "application", "analysis"] },
          question: { type: "string" },
          choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          correctChoice: { type: "string", description: "Must exactly match one of the four choices." },
          explanation: { type: "string", description: "1-3 sentences explaining why the correct choice is right." },
          difficulty: { type: "number", description: "0 (very easy) to 1 (very hard)." },
        },
        required: ["concept", "conceptSystem", "bloomLevel", "question", "choices", "correctChoice", "explanation", "difficulty"],
      },
    },
  },
  required: ["questions"],
};

const QUIZ_SYSTEM_PROMPT =
  "You are a med-school/pre-med quiz writer. From the provided study material, identify 3-6 key concepts a " +
  "student would need to know, then write 2-3 multiple-choice questions per concept spanning Bloom's taxonomy: " +
  "some pure recall, some application (using the fact in a scenario), some analysis (comparing/discriminating " +
  "between related concepts). Each question needs exactly 4 choices with exactly one correct answer — make " +
  "distractors plausible, not obviously wrong. Base every question strictly on the material given; do not test " +
  "facts the material doesn't support.";

function extractQuestions(response: Groq.Chat.ChatCompletion): GeneratedQuizQuestion[] {
  return parseToolArgs<{ questions: GeneratedQuizQuestion[] }>(response, "submit_quiz").questions;
}

export async function generateQuizFromText(sourceText: string): Promise<GeneratedQuizQuestion[]> {
  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: QUIZ_SYSTEM_PROMPT },
      { role: "user", content: `Study material:\n\n${sourceText}` },
    ],
    tools: [
      {
        type: "function",
        function: { name: "submit_quiz", description: "Submit the generated quiz questions.", parameters: QUIZ_PARAMETERS, strict: true },
      },
    ],
    tool_choice: { type: "function", function: { name: "submit_quiz" } },
  });
  return extractQuestions(response);
}

export async function generateQuizFromImage(base64: string, mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"): Promise<GeneratedQuizQuestion[]> {
  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: QUIZ_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
          { type: "text", text: "This image is a slide or page of study material. Read it and write quiz questions from its content." },
        ],
      },
    ],
    tools: [
      {
        type: "function",
        function: { name: "submit_quiz", description: "Submit the generated quiz questions.", parameters: QUIZ_PARAMETERS, strict: true },
      },
    ],
    tool_choice: { type: "function", function: { name: "submit_quiz" } },
  });
  return extractQuestions(response);
}

/** Mode B: topic-only, no uploaded material — calibrated to current mastery in/near the topic. */
export async function generateQuizFromTopic(topic: string, difficulty: number): Promise<GeneratedQuizQuestion[]> {
  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a med-school/pre-med quiz writer helping a student pre-study a topic before it's covered in " +
          "class. Identify 3-6 key concepts within the given topic, then write 2-3 multiple-choice questions per " +
          "concept spanning Bloom's taxonomy (recall, application, analysis). Each question needs exactly 4 " +
          "choices with exactly one correct answer — make distractors plausible, not obviously wrong. Calibrate " +
          "overall difficulty to the level given.",
      },
      {
        role: "user",
        content: `Topic: "${topic}"\nTarget difficulty: ${difficultyLabel(difficulty)}.`,
      },
    ],
    tools: [
      {
        type: "function",
        function: { name: "submit_quiz", description: "Submit the generated quiz questions.", parameters: QUIZ_PARAMETERS, strict: true },
      },
    ],
    tool_choice: { type: "function", function: { name: "submit_quiz" } },
  });
  return extractQuestions(response);
}

/** Scoped Q&A about a resolved diagnosis case — pathophysiology, labs, differentials, etc. */
export async function chatAboutCase(params: {
  caseContext: string;
  history: { role: "user" | "assistant"; content: string }[];
  question: string;
}): Promise<string> {
  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a study companion answering follow-up questions about a diagnosis case a pre-med/medical " +
          "student just worked through. Answer using the case details below and your medical knowledge. Keep " +
          "answers focused and study-relevant (a few sentences to a short paragraph, not an essay). This is a " +
          "study aid, not clinical guidance — if asked something outside the scope of studying this case, say so.\n\n" +
          `Case details:\n${params.caseContext}`,
      },
      ...params.history,
      { role: "user", content: params.question },
    ],
  });
  return response.choices[0]?.message.content ?? "I couldn't come up with an answer to that — try rephrasing?";
}
