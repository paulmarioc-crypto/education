import { useEffect, useState } from "react";
import { api, type ConceptDTO, type ConfusionPairDTO } from "../lib/api.js";

export default function Progress() {
  const [concepts, setConcepts] = useState<ConceptDTO[] | null>(null);
  const [confusions, setConfusions] = useState<ConfusionPairDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.concepts().then(setConcepts).catch((e) => setError(e.message));
    api.confusions().then(setConfusions).catch(() => setConfusions([]));
  }, []);

  if (error) return <p className="p-6 text-red-400">{error}</p>;
  if (!concepts) return <p className="p-6 text-slate-400">Loading…</p>;

  const attempted = concepts.filter((c) => c.mastery !== null).sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0));

  return (
    <div className="p-4 space-y-6">
      {confusions && confusions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Active mix-ups</h2>
          {confusions.map((c) => (
            <div key={c.id} className="rounded-lg bg-amber-900/20 ring-1 ring-amber-800 p-3 text-sm">
              <span className="text-amber-200">{c.conceptA} ↔ {c.conceptB}</span>
              <span className="text-slate-500 ml-2">{c.correctStreak}/3 correct discriminations to resolve</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Concept mastery</h2>
        {attempted.length === 0 && <p className="text-slate-400">No attempts yet — start a review session.</p>}
        {attempted.map((c) => (
          <div key={c.id} className="rounded-lg bg-slate-800 p-3">
            <div className="flex justify-between text-sm mb-1">
              <span>{c.name}</span>
              <span className="text-slate-400">{Math.round((c.mastery ?? 0) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-sky-500"
                style={{ width: `${Math.round((c.mastery ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
