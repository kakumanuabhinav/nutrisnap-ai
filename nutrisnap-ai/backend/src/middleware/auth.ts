import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthTokenPayload } from "../types/index.js";

const AUTH_SECRET = process.env.AUTH_SECRET;

export function signToken(payload: AuthTokenPayload): string {
  if (!AUTH_SECRET) throw new Error("AUTH_SECRET is not configured");
  return jwt.sign(payload, AUTH_SECRET, {
    expiresIn: (process.env.AUTH_TOKEN_TTL || "7d") as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Requires a valid session. Reads the token from an httpOnly cookie
 * ("nutrisnap_token") first, falling back to an Authorization: Bearer header
 * for non-browser clients. The authenticated user id is ALWAYS taken from
 * this verified token — never from a body/query param the client sends —
 * so one user can never act as another.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = req.cookies?.nutrisnap_token || bearer;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!AUTH_SECRET) {
    return res.status(500).json({ error: "Server auth misconfigured" });
  }

  try {
    const payload = jwt.verify(token, AUTH_SECRET) as AuthTokenPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
