const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface ConceptDTO {
  id: string;
  name: string;
  kind: string;
  parentId: string | null;
  description: string | null;
  mastery: number | null;
  attemptsCount: number;
}

export interface ItemConceptDTO {
  concept: ConceptDTO;
}

export interface ItemDTO {
  id: string;
  type: string;
  module: string;
  prompt: string;
  answerKey: string;
  difficulty: number;
  flagged: boolean;
  concepts: ItemConceptDTO[];
}

export interface SessionTodayDTO {
  due: ItemDTO[];
  new: ItemDTO[];
  counts: { due: number; new: number; weak: number };
}

export interface DiagnosisCasePromptDTO {
  vignette: string;
  history: string;
  exam: string;
  labs: string;
  imaging: string;
}

export interface DiagnosisAnswerDTO {
  diagnosis: string;
  organSystem: string;
  acuity: string;
  keyDiscriminators: string[];
  explanation: string;
}

export interface DiagnosisNewResponse {
  itemId: string;
  prompt: DiagnosisCasePromptDTO;
  citations: { pmid: string; title: string }[];
  groundedInSources: boolean;
}

export interface DiagnosisGuessResponse {
  correct: boolean;
  organSystemMatch: boolean;
  acuityMatch: boolean;
  hint: string;
  answer?: DiagnosisAnswerDTO;
  confusionNote?: string;
  gamification?: GamificationResultDTO;
}

export interface QuizGenerateResponse {
  questionsCreated: number;
  concepts: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConfusionPairDTO {
  id: string;
  conceptA: string;
  conceptB: string;
  correctStreak: number;
  confidence: number;
}

export interface AchievementDTO {
  key: string;
  title: string;
  description: string;
  unlockedAt: string;
}

export interface GamificationDTO {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  achievements: AchievementDTO[];
}

/** Per-attempt gamification delta, echoed back on every graded attempt response. */
export interface GamificationResultDTO {
  xpGained: number;
  xp: number;
  level: number;
  leveledUp: boolean;
  currentStreak: number;
  newAchievements: { title: string; description: string }[];
}

export const api = {
  sessionToday: () => request<SessionTodayDTO>("/session/today"),
  submitAttempt: (body: {
    itemId: string;
    selectedAnswer: string;
    responseTimeMs: number;
    rating?: 1 | 2 | 3 | 4;
    correct?: boolean;
  }) =>
    request<{ correct: boolean; due: string; stability: number; state: number; gamification: GamificationResultDTO }>(
      "/attempts",
      { method: "POST", body: JSON.stringify(body) }
    ),
  concepts: () => request<ConceptDTO[]>("/concepts"),
  flagItem: (id: string, flagged: boolean, note?: string) =>
    request<ItemDTO>(`/items/${id}/flag`, { method: "POST", body: JSON.stringify({ flagged, note }) }),
  newDiagnosisCase: () => request<DiagnosisNewResponse>("/diagnosis/new", { method: "POST" }),
  guessDiagnosis: (itemId: string, guess: string, responseTimeMs: number) =>
    request<DiagnosisGuessResponse>("/diagnosis/guess", {
      method: "POST",
      body: JSON.stringify({ itemId, guess, responseTimeMs }),
    }),
  revealDiagnosis: (itemId: string, responseTimeMs: number) =>
    request<DiagnosisAnswerDTO>(`/diagnosis/${itemId}/reveal`, {
      method: "POST",
      body: JSON.stringify({ responseTimeMs }),
    }),
  uploadQuizFile: async (file: File): Promise<QuizGenerateResponse> => {
    const form = new FormData();
    form.append("file", file);
    // No Content-Type header here — the browser sets the multipart boundary
    // itself; setting it manually (like `request()` does for JSON) breaks it.
    const res = await fetch(`${BASE}/quiz/upload`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body?.error ?? res.statusText);
    }
    return res.json() as Promise<QuizGenerateResponse>;
  },
  generateQuizFromTopic: (topic: string) =>
    request<QuizGenerateResponse>("/quiz/topic", { method: "POST", body: JSON.stringify({ topic }) }),
  chatAboutCase: (itemId: string, question: string, history: ChatMessage[]) =>
    request<{ answer: string }>(`/diagnosis/${itemId}/chat`, {
      method: "POST",
      body: JSON.stringify({ question, history }),
    }),
  nextAnatomyItem: () => request<ItemDTO>("/anatomy/next"),
  submitAnatomyAttempt: (itemId: string, selectedChoice: string, responseTimeMs: number) =>
    request<{ correct: boolean; confusionNote?: string; gamification: GamificationResultDTO }>("/anatomy/attempt", {
      method: "POST",
      body: JSON.stringify({ itemId, selectedChoice, responseTimeMs }),
    }),
  confusions: () => request<ConfusionPairDTO[]>("/confusions"),
  gamification: () => request<GamificationDTO>("/gamification"),
};
