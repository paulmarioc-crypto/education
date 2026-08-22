import { Router } from "express";
import { z } from "zod";
import { env } from "../lib/env.js";
import { clearSessionCookie, isAuthenticated, issueSessionCookie } from "../lib/auth.js";

export const authRouter = Router();

const loginSchema = z.object({ pin: z.string().min(1) });

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "pin required" });

  if (parsed.data.pin !== env.pin) {
    return res.status(401).json({ error: "incorrect pin" });
  }

  issueSessionCookie(res);
  res.json({ ok: true });
});

authRouter.post("/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});
