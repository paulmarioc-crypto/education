import { useState } from "react";
import { api, ApiError } from "../lib/api.js";

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.login(pin);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4">
        <h1 className="text-2xl font-semibold text-center">MedStudy</h1>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="w-full rounded-lg bg-slate-800 px-4 py-3 text-center text-lg tracking-widest outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        <button
          type="submit"
          disabled={submitting || pin.length === 0}
          className="w-full rounded-lg bg-sky-600 py-3 font-medium disabled:opacity-50"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
