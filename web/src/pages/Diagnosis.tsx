import { useState } from "react";
import { api, ApiError, type ChatMessage, type DiagnosisAnswerDTO, type DiagnosisCasePromptDTO } from "../lib/api.js";

interface GuessRecord {
  text: string;
  hint: string;
  organSystemMatch: boolean;
  acuityMatch: boolean;
}

export default function Diagnosis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<DiagnosisCasePromptDTO | null>(null);
  const [citations, setCitations] = useState<{ pmid: string; title: string }[]>([]);
  const [grounded, setGrounded] = useState(true);
  const [shownAt, setShownAt] = useState(Date.now());

  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<GuessRecord[]>([]);
  const [answer, setAnswer] = useState<DiagnosisAnswerDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confusionNote, setConfusionNote] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  async function startCase() {
    setLoading(true);
    setError(null);
    setAnswer(null);
    setGuesses([]);
    setGuess("");
    setConfusionNote(null);
    setChatMessages([]);
    setChatInput("");
    try {
      const res = await api.newDiagnosisCase();
      setItemId(res.itemId);
      setPrompt(res.prompt);
      setCitations(res.citations);
      setGrounded(res.groundedInSources);
      setShownAt(Date.now());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to generate a case");
    } finally {
      setLoading(false);
    }
  }

  async function submitGuess(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId || !guess.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.guessDiagnosis(itemId, guess.trim(), Date.now() - shownAt);
      setGuesses((g) => [...g, { text: guess.trim(), hint: res.hint, organSystemMatch: res.organSystemMatch, acuityMatch: res.acuityMatch }]);
      setGuess("");
      if (res.confusionNote) setConfusionNote(res.confusionNote);
      if (res.correct && res.answer) setAnswer(res.answer);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to grade that guess");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId || !chatInput.trim() || chatSending) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMessages((m) => [...m, { role: "user", content: question }]);
    setChatSending(true);
    try {
      const res = await api.chatAboutCase(itemId, question, chatMessages);
      setChatMessages((m) => [...m, { role: "assistant", content: res.answer }]);
    } catch (e) {
      setChatMessages((m) => [...m, { role: "assistant", content: e instanceof ApiError ? `(${e.message})` : "Couldn't get an answer — try again." }]);
    } finally {
      setChatSending(false);
    }
  }

  async function reveal() {
    if (!itemId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.revealDiagnosis(itemId, Date.now() - shownAt);
      setAnswer(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to reveal the answer");
    } finally {
      setSubmitting(false);
    }
  }

  if (!prompt) {
    return (
      <div className="p-6 flex flex-col items-center gap-4 text-center">
        <p className="text-slate-400 max-w-sm">
          Get a diagnosis case grounded in real peer-reviewed literature. Play as many rounds as you want.
        </p>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={startCase}
          disabled={loading}
          className="rounded-lg bg-sky-600 px-6 py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Generating case…" : "New Case"}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="rounded-2xl bg-slate-800 p-4 space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">Case</p>
        <p>{prompt.vignette}</p>
        {prompt.history && <p className="text-sm text-slate-300"><span className="text-slate-500">History: </span>{prompt.history}</p>}
        {prompt.exam && <p className="text-sm text-slate-300"><span className="text-slate-500">Exam: </span>{prompt.exam}</p>}
        {prompt.labs && <p className="text-sm text-slate-300"><span className="text-slate-500">Labs: </span>{prompt.labs}</p>}
        {prompt.imaging && <p className="text-sm text-slate-300"><span className="text-slate-500">Imaging: </span>{prompt.imaging}</p>}
      </div>

      {grounded && citations.length > 0 ? (
        <p className="text-xs text-emerald-400">✓ Grounded in {citations.length} peer-reviewed source{citations.length === 1 ? "" : "s"} — see below.</p>
      ) : (
        <div className="rounded-lg bg-amber-900/30 ring-1 ring-amber-700 px-3 py-2 text-sm text-amber-300">
          ⚠ No matching literature found for this case — generated from the model's general medical knowledge,
          not verified against a specific source. Treat it with extra scrutiny and flag anything that looks wrong.
        </div>
      )}

      {guesses.length > 0 && (
        <div className="space-y-2">
          {guesses.map((g, i) => (
            <div key={i} className="rounded-lg bg-slate-800/60 p-3 text-sm">
              <p className="text-slate-300">
                <span className="text-slate-500">Guess: </span>
                {g.text}
              </p>
              <p className="text-sky-300 mt-1">{g.hint}</p>
              <p className="text-xs text-slate-500 mt-1">
                {g.organSystemMatch ? "✓" : "✗"} organ system · {g.acuityMatch ? "✓" : "✗"} acuity
              </p>
            </div>
          ))}
        </div>
      )}

      {confusionNote && (
        <div className="rounded-lg bg-amber-900/30 ring-1 ring-amber-700 px-3 py-2 text-sm text-amber-200">
          <span className="font-medium">You mixed these up: </span>
          {confusionNote}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!answer ? (
        <>
          <form onSubmit={submitGuess} className="flex gap-2">
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Your diagnosis…"
              autoFocus
              className="flex-1 rounded-lg bg-slate-800 px-4 py-3 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={submitting || !guess.trim()}
              className="rounded-lg bg-sky-600 px-4 py-3 font-medium disabled:opacity-50"
            >
              Guess
            </button>
          </form>
          <button onClick={reveal} disabled={submitting} className="text-sm text-slate-400 underline">
            Reveal answer
          </button>
        </>
      ) : (
        <div className="rounded-2xl bg-emerald-900/30 ring-1 ring-emerald-700 p-4 space-y-2">
          <p className="text-lg font-semibold text-emerald-300">{answer.diagnosis}</p>
          <p className="text-sm text-slate-300">{answer.explanation}</p>
          <p className="text-xs text-slate-500">Key discriminators: {answer.keyDiscriminators.join("; ")}</p>
        </div>
      )}

      {answer && (
        <div className="rounded-2xl bg-slate-800/60 p-4 space-y-3">
          <p className="text-sm uppercase tracking-wide text-slate-400">Ask about this case</p>
          {chatMessages.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {chatMessages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  <p
                    className={`inline-block rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                      m.role === "user" ? "bg-sky-700 text-white" : "bg-slate-700 text-slate-100"
                    }`}
                  >
                    {m.content}
                  </p>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={sendChat} className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Why did the labs look like that?"
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm outline-none ring-1 ring-slate-700 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={chatSending || !chatInput.trim()}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {chatSending ? "…" : "Ask"}
            </button>
          </form>
        </div>
      )}

      <div className="text-xs text-slate-500 border-t border-slate-800 pt-3">
        {grounded && citations.length > 0 ? (
          <>
            <p className="mb-1">Grounded in:</p>
            <ul className="space-y-0.5">
              {citations.map((c) => (
                <li key={c.pmid}>
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${c.pmid}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline"
                  >
                    PMID {c.pmid}
                  </a>{" "}
                  — {c.title}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>No specific literature match for this case — generated from established clinical teaching. Flag it if anything looks off.</p>
        )}
      </div>

      {answer && (
        <button onClick={startCase} disabled={loading} className="w-full rounded-lg bg-slate-700 py-3 font-medium">
          {loading ? "Generating case…" : "Next Case"}
        </button>
      )}
    </div>
  );
}
