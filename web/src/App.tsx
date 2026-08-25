import { NavLink, Route, Routes } from "react-router-dom";
import Review from "./pages/Review.js";
import Diagnosis from "./pages/Diagnosis.js";
import Quiz from "./pages/Quiz.js";
import Progress from "./pages/Progress.js";

const NAV_ITEMS = [
  { to: "/", label: "Review" },
  { to: "/diagnosis", label: "Diagnosis" },
  { to: "/quiz", label: "Upload" },
  { to: "/progress", label: "Progress" },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-14">
        <Routes>
          <Route path="/" element={<Review />} />
          <Route path="/diagnosis" element={<Diagnosis />} />
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
              `flex-1 flex items-center justify-center text-sm ${isActive ? "text-sky-400" : "text-slate-400"}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
