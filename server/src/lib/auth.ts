import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

const COOKIE_NAME = "medstudy_session";
const SESSION_TTL = "30d";

export function issueSessionCookie(req: Request, res: Response) {
  const token = jwt.sign({ sub: "single-user" }, env.sessionSecret, { expiresIn: SESSION_TTL });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // req.secure reflects the real scheme: plain HTTP on a self-hosted LAN box
    // (no TLS cert for a LAN IP), or HTTPS when behind a hosted platform's
    // TLS-terminating proxy (Express needs `trust proxy` set for this to see
    // through X-Forwarded-Proto — see index.ts).
    secure: req.secure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "not authenticated" });
  try {
    jwt.verify(token, env.sessionSecret);
    next();
  } catch {
    return res.status(401).json({ error: "invalid or expired session" });
  }
}

export function isAuthenticated(req: Request): boolean {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return false;
  try {
    jwt.verify(token, env.sessionSecret);
    return true;
  } catch {
    return false;
  }
}
