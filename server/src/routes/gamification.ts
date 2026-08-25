import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const gamificationRouter = Router();

gamificationRouter.get("/", async (_req, res) => {
  const state = await prisma.streakState.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const achievements = await prisma.achievement.findMany({ orderBy: { unlockedAt: "desc" } });

  res.json({
    xp: state.xp,
    level: state.level,
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    achievements: achievements.map((a) => ({
      key: a.key,
      title: a.title,
      description: a.description,
      unlockedAt: a.unlockedAt,
    })),
  });
});
