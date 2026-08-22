import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api } from "./lib/api.js";
import Login from "./pages/Login.js";
import Review from "./pages/Review.js";
import Progress from "./pages/Progress.js";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .me()
      .then((r) => setAuthed(r.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return null;
  if (!authed) return <Login onLoggedIn={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-14">
        <Routes>
          <Route path="/" element={<Review />} />
          <Route path="/progress" element={<Progress />} />
        </Routes>
      </main>
      <nav className="fixed bottom-0 inset-x-0 h-14 bg-slate-900 border-t border-slate-800 flex">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex-1 flex items-center justify-center text-sm ${isActive ? "text-sky-400" : "text-slate-400"}`
          }
        >
          Review
        </NavLink>
        <NavLink
          to="/progress"
          className={({ isActive }) =>
            `flex-1 flex items-center justify-center text-sm ${isActive ? "text-sky-400" : "text-slate-400"}`
          }
        >
          Progress
        </NavLink>
      </nav>
    </div>
  );
}
