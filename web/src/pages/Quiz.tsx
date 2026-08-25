import { useRef, useState } from "react";
import { api, ApiError, type QuizUploadResponse } from "../lib/api.js";

export default function Quiz() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizUploadResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.uploadQuizFile(file);
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 flex flex-col items-center gap-4 text-center max-w-sm mx-auto">
      <p className="text-slate-400">
        Upload slides, notes, or a scanned page (PDF, PPTX, DOCX, or an image) and questions get generated from it,
        tagged to the concepts it covers, and folded into your review queue.
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
        disabled={uploading}
        className="rounded-lg bg-sky-600 px-6 py-3 font-medium disabled:opacity-50"
      >
        {uploading ? `Processing ${fileName ?? "file"}…` : "Choose file"}
      </button>

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
