// JSON shapes stored in Item.prompt / Item.answerKey, keyed by Item.type.
// Kept as plain types (not zod-validated on read) since these are our own
// AI/seed-generated payloads, not external input.

export interface FlashcardPrompt {
  front: string;
}
export interface FlashcardAnswer {
  back: string;
}

export interface DiagnosisCasePrompt {
  vignette: string;
  history?: string;
  exam?: string;
  labs?: string;
  imaging?: string;
}
export interface DiagnosisCaseAnswer {
  diagnosis: string;
  organSystem: string;
  acuity: "acute" | "subacute" | "chronic";
  keyDiscriminators: string[];
  explanation: string;
}

export interface AnatomyIdPrompt {
  imageUrl: string;
  pinX: number; // 0..1 fraction of image width
  pinY: number; // 0..1 fraction of image height
  choices: string[];
}
export interface AnatomyIdAnswer {
  correctChoice: string;
}

export interface QuizQuestionPrompt {
  question: string;
  choices: string[];
  bloomLevel: "recall" | "application" | "analysis";
}
export interface QuizQuestionAnswer {
  correctChoice: string;
  explanation: string;
}
