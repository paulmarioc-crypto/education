import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { ReviewState as ReviewStateRow } from "@prisma/client";

// FSRS scheduler tuned to default parameters. request_retention=0.9 is the
// standard "aim to recall 90% of due reviews" target that Anki also defaults to.
const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

export { Rating };
export type FsrsGrade = Grade;

export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

export function rowToCard(row: ReviewStateRow): Card {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.lastReview ?? undefined,
  };
}

export function cardToRowData(card: Card) {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    lastReview: card.last_review ?? null,
  };
}

/** Schedule the next review for a card given a grade (Again/Hard/Good/Easy). */
export function schedule(card: Card, now: Date, grade: FsrsGrade) {
  return scheduler.next(card, now, grade);
}
