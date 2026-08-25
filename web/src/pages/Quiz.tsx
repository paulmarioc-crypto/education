import { useRef, useState } from "react";
import { api, ApiError, type QuizGenerateResponse } from "../lib/api.js";

type Mode = "upload" | "topic";

export default function Quiz() {
  const [mode, setMode] = useState<Mode>("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [topic, setTopic] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizGenerateResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setWorking(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.uploadQuizFile(file));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setWorking(false);
    }
  }

  async function handleTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || working) return;
    setWorking(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.generateQuizFromTopic(topic.trim()));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to generate questions");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="p-6 flex flex-col items-center gap-4 text-center max-w-sm mx-auto">
      <div className="flex rounded-lg bg-slate-800 p-1 text-sm">
        <button
          onClick={() => {
            setMode("upload");
            setResult(null);
            setError(null);
          }}
          className={`px-4 py-1.5 rounded-md ${mode === "upload" ? "bg-sky-600" : "text-slate-400"}`}
        >
          Upload Material
        </button>
        <button
          onClick={() => {
            setMode("topic");
            setResult(null);
            setError(null);
          }}
          className={`px-4 py-1.5 rounded-md ${mode === "topic" ? "bg-sky-600" : "text-slate-400"}`}
        >
          Type a Topic
        </button>
      </div>

      {mode === "upload" ? (
        <>
          <p className="text-slate-400">
            Upload slides, notes, or a scanned page (PDF, PPTX, DOCX, or an image) and questions get generated from
            it, tagged to the concepts it covers.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.pptx,.docx,image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={working}
            className="rounded-lg bg-sky-600 px-6 py-3 font-medium disabled:opacity-50"
          >
            {working ? `Processing ${fileName ?? "file"}…` : "Choose file"}
          </button>
        </>
      ) : (
        <>
          <p className="text-slate-400">
            Type a topic you haven't covered yet — questions get calibrated to your current level in it (or a
            gentle starting difficulty if it's brand new).
          </p>
          <form onSubmit={handleTopic} className="w-full flex flex-col gap-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. renal physiology"
              className="w-full rounded-lg bg-slate-800 px-4 py-3 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={working || !topic.trim()}
              className="rounded-lg bg-sky-600 px-6 py-3 font-medium disabled:opacity-50"
            >
              {working ? "Generating…" : "Generate Questions"}
            </button>
          </form>
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {result && (
        <div className="rounded-2xl bg-emerald-900/30 ring-1 ring-emerald-700 p-4 space-y-1 w-full">
          <p className="text-emerald-300 font-medium">
            {result.questionsCreated} question{result.questionsCreated === 1 ? "" : "s"} generated
          </p>
          {result.concepts.length > 0 && (
            <p className="text-sm text-slate-300">Covers: {result.concepts.join(", ")}</p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            These will show up in your Review queue as new material — check the Review tab.
          </p>
        </div>
      )}
    </div>
  );
}
