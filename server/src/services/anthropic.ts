import Anthropic from "@anthropic-ai/sdk";
import { env } from "../lib/env.js";
import type { PubMedSource } from "./pubmed.js";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

// Per the user's explicit sourcing decision: cases are grounded in live
// PubMed retrieval, not pure model recall. claude-opus-5 per this session's
// default model policy — not downgraded for cost without being asked.
const MODEL = "claude-opus-5";

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

const CASE_SCHEMA: Anthropic.Tool.InputSchema = {
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
        additionalProperties: false,
      },
      description: "Only PMIDs actually used from the provided source material. Empty array if no sources were provided.",
    },
  },
  required: ["vignette", "history", "exam", "labs", "imaging", "diagnosis", "organSystem", "acuity", "keyDiscriminators", "explanation", "citations"],
  additionalProperties: false,
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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "You are a medical education case-writer creating diagnosis practice cases for a pre-med/medical student " +
      "studying for coursework and board prep. Ground every clinical fact — history, exam findings, lab values, " +
      "imaging — in the provided peer-reviewed source material when it's given; do not invent findings that " +
      "contradict it. This is a study tool, not a clinical reference, so favor clarity and pedagogical value over " +
      "exhaustive realism, but never sacrifice factual accuracy for either.",
    messages: [
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
        name: "submit_diagnosis_case",
        description: "Submit the generated diagnosis case.",
        input_schema: CASE_SCHEMA,
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: "submit_diagnosis_case" },
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Model did not return a structured diagnosis case");
  return toolUse.input as GeneratedDiagnosisCase;
}

export interface GuessFeedback {
  correct: boolean;
  organSystemMatch: boolean;
  acuityMatch: boolean;
  hint: string;
}

const GUESS_SCHEMA: Anthropic.Tool.InputSchema = {
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
      description: "One short, clinically-meaningful clue steering toward the answer without naming it — e.g. 'right organ system, but this presents more acutely' or 'consider the lab pattern more closely'.",
    },
  },
  required: ["correct", "organSystemMatch", "acuityMatch", "hint"],
  additionalProperties: false,
};

export async function classifyGuess(params: {
  guess: string;
  correctDiagnosis: string;
  organSystem: string;
  acuity: string;
  keyDiscriminators: string[];
}): Promise<GuessFeedback> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system:
      "You grade a student's diagnosis guess against the correct answer for a study game. Be lenient about " +
      "spelling, abbreviation, and phrasing differences, but strict about clinical meaning.",
    messages: [
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
        name: "submit_feedback",
        description: "Submit clinical-similarity feedback comparing the guess to the correct answer.",
        input_schema: GUESS_SCHEMA,
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: "submit_feedback" },
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Model did not return structured guess feedback");
  return toolUse.input as GuessFeedback;
}
