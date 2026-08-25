import type { GamificationResultDTO } from "../lib/api.js";

/** Shows a brief level-up / achievement-unlocked notice after a graded attempt. Renders nothing otherwise. */
export function GamificationBanner({ result }: { result: GamificationResultDTO | null }) {
  if (!result || (!result.leveledUp && result.newAchievements.length === 0)) return null;

  return (
    <div className="rounded-lg bg-violet-900/30 ring-1 ring-violet-700 p-3 text-sm space-y-1">
      {result.leveledUp && <p className="text-violet-200 font-medium">Level up! You're now level {result.level}. 🎉</p>}
      {result.newAchievements.map((a) => (
        <p key={a.title} className="text-violet-200">
          <span className="font-medium">Achievement unlocked — {a.title}:</span> {a.description}
        </p>
      ))}
    </div>
  );
}
