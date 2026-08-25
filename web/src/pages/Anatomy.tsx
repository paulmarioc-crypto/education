import { useEffect, useState } from "react";
import { api, ApiError, type ItemDTO, type GamificationResultDTO } from "../lib/api.js";
import { useGamification } from "../lib/gamificationContext.js";
import { GamificationBanner } from "../components/GamificationBanner.js";

interface AnatomyIdPrompt {
  imageUrl: string;
  pinX: number;
  pinY: number;
  choices: string[];
}
interface AnatomyIdAnswer {
  correctChoice: string;
}

export default function Anatomy() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<ItemDTO | null>(null);
  const [shownAt, setShownAt] = useState(Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [rounds, setRounds] = useState(0);
  const [confusionNote, setConfusionNote] = useState<string | null>(null);
  const [gamification, setGamification] = useState<GamificationResultDTO | null>(null);
  const { refresh: refreshGamification } = useGamification();

  async function loadNext() {
    setLoading(true);
    setError(null);
    setSelected(null);
    setConfusionNote(null);
    setGamification(null);
    try {
      const next = await api.nextAnatomyItem();
      setItem(next);
      setShownAt(Date.now());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load an anatomy item");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNext();
  }, []);

  let parsed: { prompt: AnatomyIdPrompt; answer: AnatomyIdAnswer } | null = null;
  if (item) {
    try {
      parsed = { prompt: JSON.parse(item.prompt), answer: JSON.parse(item.answerKey) };
    } catch {
      parsed = null;
    }
  }

  async function choose(choice: string) {
    if (!item || !parsed || selected) return;
    setSelected(choice);
    try {
      const res = await api.submitAnatomyAttempt(item.id, choice, Date.now() - shownAt);
      setConfusionNote(res.confusionNote ?? null);
      setGamification(res.gamification);
      refreshGamification();
      setRounds((r) => r + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to submit");
    }
  }

  if (error) {
    return (
      <div className="p-6 text-center space-y-2">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={loadNext} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">
          Try again
        </button>
      </div>
    );
  }

  if (loading || !parsed) {
    return <p className="p-6 text-center text-slate-400">Loading…</p>;
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <p className="text-sm text-slate-400 text-center">Round {rounds + 1} · What structure is marked?</p>

      <div className="relative rounded-2xl bg-slate-800 overflow-hidden">
        <img src={parsed.prompt.imageUrl} alt="Anatomical structure to identify" className="w-full h-auto block" />
        <div
          className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 ring-2 ring-white shadow-lg animate-pulse"
          style={{ left: `${parsed.prompt.pinX * 100}%`, top: `${parsed.prompt.pinY * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {parsed.prompt.choices.map((choice) => {
          const isCorrect = choice === parsed!.answer.correctChoice;
          const isSelected = choice === selected;
          const showColors = selected !== null;
          return (
            <button
              key={choice}
              onClick={() => choose(choice)}
              disabled={selected !== null}
              className={`rounded-lg px-4 py-3 text-sm ring-1 ${
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

      {confusionNote && (
        <div className="rounded-lg bg-amber-900/30 ring-1 ring-amber-700 px-3 py-2 text-sm text-amber-200">
          <span className="font-medium">You mixed these up: </span>
          {confusionNote}
        </div>
      )}

      <GamificationBanner result={gamification} />

      {selected && (
        <button onClick={loadNext} className="w-full rounded-lg bg-slate-700 py-3 font-medium">
          Next
        </button>
      )}

      <p className="text-xs text-slate-500 text-center">
        Image: public-domain or Creative Commons–licensed anatomical illustration via Wikimedia Commons.
      </p>
    </div>
  );
}
