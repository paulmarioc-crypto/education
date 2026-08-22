// SQLite has no native enum support in Prisma, so these columns are plain
// strings at the DB layer. This is the single source of truth for valid values.

export const ConceptKind = {
  SYSTEM: "SYSTEM",
  REGION: "REGION",
  STRUCTURE: "STRUCTURE",
  DIAGNOSIS: "DIAGNOSIS",
  TOPIC: "TOPIC",
} as const;
export type ConceptKind = (typeof ConceptKind)[keyof typeof ConceptKind];

export const ItemType = {
  FLASHCARD: "FLASHCARD",
  DIAGNOSIS_CASE: "DIAGNOSIS_CASE",
  ANATOMY_ID: "ANATOMY_ID",
  QUIZ_QUESTION: "QUIZ_QUESTION",
} as const;
export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export const ItemSource = {
  SEED: "SEED",
  MANUAL: "MANUAL",
  AI_UPLOAD: "AI_UPLOAD",
  AI_TOPIC: "AI_TOPIC",
} as const;
export type ItemSource = (typeof ItemSource)[keyof typeof ItemSource];

export const Module = {
  DIAGNOSIS: "DIAGNOSIS",
  ANATOMY: "ANATOMY",
  QUIZ: "QUIZ",
  REVIEW: "REVIEW",
} as const;
export type Module = (typeof Module)[keyof typeof Module];
