import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthTokenPayload } from "../types/index.js";

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not configured in production environment variables");
    }
    return "dev-nutrisnap-auth-fallback-secret-at-least-32-chars-long";
  }
  return secret;
}

export function signToken(payload: AuthTokenPayload): string {
  const secret = getAuthSecret();
  return jwt.sign(payload, secret, {
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

  let secret: string;
  try {
    secret = getAuthSecret();
  } catch (err: any) {
    console.error("[auth] AUTH_SECRET configuration error:", err?.message || err);
    return res.status(500).json({ error: "Server authentication misconfigured. Please configure AUTH_SECRET." });
  }

  try {
    const payload = jwt.verify(token, secret) as AuthTokenPayload;
    req.user = payload;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
