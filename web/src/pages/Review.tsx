import { useEffect, useMemo, useState } from "react";
import { api, type ItemDTO } from "../lib/api.js";

type Rating = 1 | 2 | 3 | 4;
const RATINGS: { rating: Rating; label: string; className: string }[] = [
  { rating: 1, label: "Again", className: "bg-red-600" },
  { rating: 2, label: "Hard", className: "bg-orange-600" },
  { rating: 3, label: "Good", className: "bg-emerald-600" },
  { rating: 4, label: "Easy", className: "bg-sky-600" },
];

interface FlashcardPrompt {
  front: string;
}
interface FlashcardAnswer {
  back: string;
}
interface DiagnosisCasePrompt {
  vignette: string;
  history: string;
  exam: string;
  labs: string;
  imaging: string;
}
interface DiagnosisCaseAnswer {
  diagnosis: string;
  explanation: string;
}
interface QuizQuestionPrompt {
  question: string;
  choices: string[];
  bloomLevel: string;
}
interface QuizQuestionAnswer {
  correctChoice: string;
  explanation: string;
}

/** Renders flip-card item types (self-graded recall) as a simple {front, back} pair. */
function toFrontBack(item: ItemDTO): { front: string; back: string } | null {
  try {
    if (item.type === "FLASHCARD") {
      return {
        front: (JSON.parse(item.prompt) as FlashcardPrompt).front,
        back: (JSON.parse(item.answerKey) as FlashcardAnswer).back,
      };
    }
    if (item.type === "DIAGNOSIS_CASE") {
      const p = JSON.parse(item.prompt) as DiagnosisCasePrompt;
      const a = JSON.parse(item.answerKey) as DiagnosisCaseAnswer;
      return { front: p.vignette, back: `${a.diagnosis} — ${a.explanation}` };
    }
    return null;
  } catch {
    return null;
  }
}

export default function Review() {
  const [queue, setQueue] = useState<ItemDTO[] | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [shownAt, setShownAt] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  useEffect(() => {
    api
      .sessionToday()
      .then((s) => {
        setQueue([...s.due, ...s.new]);
        setDueCount(s.counts.due);
        setNewCount(s.counts.new);
      })
      .catch((e) => setError(e.message ?? "Failed to load session"));
  }, []);

  useEffect(() => {
    setShownAt(Date.now());
    setRevealed(false);
    setSelectedChoice(null);
  }, [index]);

  const current = queue?.[index];

  const isQuiz = current?.type === "QUIZ_QUESTION";
  const quiz = useMemo(() => {
    if (!current || current.type !== "QUIZ_QUESTION") return null;
    try {
      return {
        prompt: JSON.parse(current.prompt) as QuizQuestionPrompt,
        answer: JSON.parse(current.answerKey) as QuizQuestionAnswer,
      };
    } catch {
      return null;
    }
  }, [current]);

  const parsed = useMemo(() => (current && !isQuiz ? toFrontBack(current) : null), [current, isQuiz]);

  async function grade(rating: Rating) {
    if (!current || !parsed) return;
    const responseTimeMs = Date.now() - shownAt;
    try {
      await api.submitAttempt({
        itemId: current.id,
        selectedAnswer: RATINGS.find((r) => r.rating === rating)!.label,
        responseTimeMs,
        rating,
      });
      setCompletedCount((c) => c + 1);
      setIndex((i) => i + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    }
  }

  async function chooseAnswer(choice: string) {
    if (!current || !quiz || selectedChoice) return;
    setSelectedChoice(choice);
    const responseTimeMs = Date.now() - shownAt;
    try {
      await api.submitAttempt({
        itemId: current.id,
        selectedAnswer: choice,
        responseTimeMs,
        correct: choice === quiz.answer.correctChoice,
      });
      setCompletedCount((c) => c + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    }
  }

  if (error) {
    return <p className="p-6 text-red-400">{error}</p>;
  }

  if (!queue) {
    return <p className="p-6 text-slate-400">Loading today's session…</p>;
  }

  if (queue.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-lg font-medium">Nothing due right now.</p>
        <p className="text-slate-400 mt-1">Upload material or check back later.</p>
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <div className="p-6 text-center space-y-2">
        <p className="text-xl font-semibold">Session complete 🎉</p>
        <p className="text-slate-400">{completedCount} cards reviewed.</p>
      </div>
    );
  }

  if (isQuiz && quiz) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-56px)] p-4 gap-4">
        <div className="text-sm text-slate-400 text-center">
          Today: {dueCount} reviews, {newCount} new · {index + 1} of {queue.length}
        </div>
        <div className="flex-1 flex flex-col justify-center gap-4 max-w-lg mx-auto w-full">
          <div className="rounded-2xl bg-slate-800 p-6">
            <p className="text-lg">{quiz.prompt.question}</p>
          </div>
          <div className="grid gap-2">
            {quiz.prompt.choices.map((choice) => {
              const isCorrect = choice === quiz.answer.correctChoice;
              const isSelected = choice === selectedChoice;
              const showColors = selectedChoice !== null;
              return (
                <button
                  key={choice}
                  onClick={() => chooseAnswer(choice)}
                  disabled={selectedChoice !== null}
                  className={`rounded-lg px-4 py-3 text-left ring-1 ${
                    showColors && isCorrect
                      ? "bg-emerald-900/40 ring-emerald-600"
                      : showColors && isSelected
                        ? "bg-red-900/40 ring-red-600"
                        : "bg-slate-800 ring-slate-700"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
          {selectedChoice && (
            <>
              <p className="text-sm text-slate-300">{quiz.answer.explanation}</p>
              <button onClick={() => setIndex((i) => i + 1)} className="w-full rounded-lg bg-slate-700 py-3 font-medium">
                Next
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!parsed) {
    // Anatomy items render in their own module UI (stage 5).
    return <p className="p-6 text-slate-400">This item type isn't supported in the review UI yet.</p>;
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] p-4 gap-4">
      <div className="text-sm text-slate-400 text-center">
        Today: {dueCount} reviews, {newCount} new · {index + 1} of {queue.length}
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-lg rounded-2xl bg-slate-800 p-6 min-h-[200px] flex flex-col justify-center gap-4">
          <p className="text-lg">{parsed.front}</p>
          {revealed && (
            <>
              <hr className="border-slate-700" />
              <p className="text-lg text-sky-300">{parsed.back}</p>
            </>
          )}
        </div>
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="w-full rounded-lg bg-slate-700 py-3 font-medium"
        >
          Show answer
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.rating}
              onClick={() => grade(r.rating)}
              className={`rounded-lg py-3 font-medium ${r.className}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
