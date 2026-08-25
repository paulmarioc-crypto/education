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

export const api = {
  sessionToday: () => request<SessionTodayDTO>("/session/today"),
  submitAttempt: (body: {
    itemId: string;
    selectedAnswer: string;
    responseTimeMs: number;
    rating?: 1 | 2 | 3 | 4;
    correct?: boolean;
  }) => request<{ correct: boolean; due: string; stability: number; state: number }>("/attempts", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  concepts: () => request<ConceptDTO[]>("/concepts"),
  flagItem: (id: string, flagged: boolean, note?: string) =>
    request<ItemDTO>(`/items/${id}/flag`, { method: "POST", body: JSON.stringify({ flagged, note }) }),
};
