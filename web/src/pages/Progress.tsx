import { useEffect, useState } from "react";
import { api, type ConceptDTO } from "../lib/api.js";

export default function Progress() {
  const [concepts, setConcepts] = useState<ConceptDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.concepts().then(setConcepts).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="p-6 text-red-400">{error}</p>;
  if (!concepts) return <p className="p-6 text-slate-400">Loading…</p>;

  const attempted = concepts.filter((c) => c.mastery !== null).sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0));

  return (
    <div className="p-4 space-y-3">
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
  );
}
