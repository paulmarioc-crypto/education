import { prisma } from "./prisma.js";
import { normalizeMastery } from "./mastery.js";

// Behavior-based achievements only, per spec — never "answered N questions."
const ACHIEVEMENTS: Record<string, { title: string; description: string }> = {
  streak_7: { title: "Week Streak", description: "Studied 7 days in a row." },
  streak_30: { title: "Month Streak", description: "Studied 30 days in a row." },
  confusion_resolved_1: { title: "Untangled", description: "Resolved a confusion pair — told two mixed-up concepts apart 3 times in a row." },
  confusion_resolved_5: { title: "Sharp Discriminator", description: "Resolved 5 confusion pairs." },
  branch_mastered: { title: "Branch Mastered", description: "Reached strong mastery across every concept in a full branch." },
};

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function isYesterday(a: Date, b: Date): boolean {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)) / oneDayMs);
  return diffDays === 1;
}

async function unlock(key: string): Promise<{ title: string; description: string } | null> {
  const def = ACHIEVEMENTS[key];
  if (!def) return null;
  const existing = await prisma.achievement.findUnique({ where: { key } });
  if (existing) return null;
  await prisma.achievement.create({ data: { key, title: def.title, description: def.description } });
  return def;
}

export interface GamificationResult {
  xpGained: number;
  xp: number;
  level: number;
  leveledUp: boolean;
  currentStreak: number;
  newAchievements: { title: string; description: string }[];
}

/**
 * Updates XP, level, and daily streak for one attempt, then checks
 * behavior-based achievement conditions. Called once per graded attempt
 * from the shared grading pipeline, so every module feeds the same
 * motivation layer instead of each having its own scoring.
 */
export async function recordGamification(correct: boolean, difficulty: number): Promise<GamificationResult> {
  const state = await prisma.streakState.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  // 10-50 XP per correct answer, weighted by difficulty; nothing for a miss —
  // XP rewards retention, not attempts.
  const xpGained = correct ? Math.round(10 + difficulty * 40) : 0;
  const xp = state.xp + xpGained;
  const level = Math.floor(xp / 100) + 1;
  const leveledUp = level > state.level;

  const now = new Date();
  let currentStreak = state.currentStreak;
  let longestStreak = state.longestStreak;
  if (!state.lastActiveDate) {
    currentStreak = 1;
  } else if (isSameDay(state.lastActiveDate, now)) {
    // Already active today — streak doesn't change again.
  } else if (isYesterday(new Date(state.lastActiveDate), new Date(now))) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  await prisma.streakState.update({
    where: { id: 1 },
    data: { xp, level, currentStreak, longestStreak, lastActiveDate: now },
  });

  const newAchievements: { title: string; description: string }[] = [];
  if (currentStreak >= 7) {
    const a = await unlock("streak_7");
    if (a) newAchievements.push(a);
  }
  if (currentStreak >= 30) {
    const a = await unlock("streak_30");
    if (a) newAchievements.push(a);
  }

  return { xpGained, xp, level, leveledUp, currentStreak, newAchievements };
}

/** Called when a ConfusionPair resolves (3 correct discriminations in a row). */
export async function checkConfusionAchievements(): Promise<{ title: string; description: string }[]> {
  const resolvedCount = await prisma.confusionPair.count({ where: { resolved: true } });
  const unlocked: { title: string; description: string }[] = [];
  if (resolvedCount >= 1) {
    const a = await unlock("confusion_resolved_1");
    if (a) unlocked.push(a);
  }
  if (resolvedCount >= 5) {
    const a = await unlock("confusion_resolved_5");
    if (a) unlocked.push(a);
  }
  return unlocked;
}

const MASTERED_THRESHOLD = 0.8;
const MIN_ATTEMPTS_TO_COUNT = 3;

/**
 * Checks whether any top-level branch (a SYSTEM or TOPIC concept with no
 * parent) now has every one of its descendant concepts at strong mastery.
 * Called after mastery updates; cheap enough for this app's small concept
 * trees (no need to gate it further).
 */
export async function checkBranchMasteryAchievement(): Promise<{ title: string; description: string } | null> {
  const roots = await prisma.conceptNode.findMany({ where: { parentId: null } });

  for (const root of roots) {
    const descendants = await prisma.conceptNode.findMany({
      where: { OR: [{ parentId: root.id }, { parent: { parentId: root.id } }] },
      include: { mastery: true },
    });
    if (descendants.length === 0) continue;

    const allMastered = descendants.every(
      (d) => d.mastery && d.mastery.attemptsCount >= MIN_ATTEMPTS_TO_COUNT && normalizeMastery(d.mastery.score) >= MASTERED_THRESHOLD
    );
    if (allMastered) {
      return unlock("branch_mastered");
    }
  }
  return null;
}
