import { NavLink, Route, Routes } from "react-router-dom";
import Review from "./pages/Review.js";
import Diagnosis from "./pages/Diagnosis.js";
import Anatomy from "./pages/Anatomy.js";
import Quiz from "./pages/Quiz.js";
import Progress from "./pages/Progress.js";
import { GamificationProvider, useGamification } from "./lib/gamificationContext.js";

const NAV_ITEMS = [
  { to: "/", label: "Review" },
  { to: "/diagnosis", label: "Diagnosis" },
  { to: "/anatomy", label: "Anatomy" },
  { to: "/quiz", label: "Upload" },
  { to: "/progress", label: "Progress" },
];

function GamificationHeader() {
  const { data } = useGamification();
  if (!data) return <div className="h-9" />;

  return (
    <div className="h-9 flex items-center justify-center gap-4 text-xs bg-slate-900 border-b border-slate-800 text-slate-300">
      <span>Lvl {data.level}</span>
      <span>{data.xp} XP</span>
      {data.currentStreak > 0 && <span>🔥 {data.currentStreak}-day streak</span>}
    </div>
  );
}

export default function App() {
  return (
    <GamificationProvider>
      <div className="min-h-screen flex flex-col">
        <GamificationHeader />
        <main className="flex-1 pb-14">
          <Routes>
            <Route path="/" element={<Review />} />
            <Route path="/diagnosis" element={<Diagnosis />} />
            <Route path="/anatomy" element={<Anatomy />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/progress" element={<Progress />} />
          </Routes>
        </main>
        <nav className="fixed bottom-0 inset-x-0 h-14 bg-slate-900 border-t border-slate-800 flex">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex-1 flex items-center justify-center text-xs sm:text-sm ${isActive ? "text-sky-400" : "text-slate-400"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </GamificationProvider>
  );
}
