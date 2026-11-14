import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { hashPassword, verifyPassword, DUMMY_HASH } from "../services/authCrypto.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../utils/validation.js";

export const authRouter = Router();

const COOKIE_NAME = "nutrisnap_token";
const isProd = process.env.NODE_ENV === "production";

function setAuthCookie(res: import("express").Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

authRouter.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid input";
      return res.status(400).json({ error: `Invalid input: ${firstIssue}`, details: parsed.error.issues });
    }
    const { name, email, password, age, gender, height_cm, weight_kg, activity_level, nutrition_goal } =
      parsed.data;

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const userResult = await client.query(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
         RETURNING id, name, email, created_at`,
        [name, email, passwordHash],
      );
      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO user_profiles (user_id, age, gender, height_cm, weight_kg, activity_level, nutrition_goal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, age ?? null, gender ?? null, height_cm ?? null, weight_kg ?? null, activity_level ?? null, nutrition_goal ?? null],
      );
      await client.query("COMMIT");

      const token = signToken({ sub: user.id, email: user.email });
      setAuthCookie(res, token);
      res.status(201).json({ user: { id: user.id, name: user.name, email: user.email }, token });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[auth/register transaction]", err?.message || err);
      res.status(500).json({ error: "Could not create account in database" });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[auth/register unhandled]", err?.message || err);
    res.status(500).json({ error: err?.message || "Registration failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid email or password format" });
    }
    const { email, password } = parsed.data;

    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email],
    );
    const user = result.rows[0];
    const ok = await verifyPassword(user?.password_hash ?? DUMMY_HASH, password);

    if (!user || !ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken({ sub: user.id, email: user.email });
    setAuthCookie(res, token);
    res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (err: any) {
    console.error("[auth/login unhandled]", err);
    res.status(500).json({ error: err?.message || "Login failed due to a server/database error" });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [req.user!.sub],
    );
    if (!result.rowCount) return res.status(404).json({ error: "User not found" });
    res.json({ user: result.rows[0] });
  } catch (err: any) {
    console.error("[auth/me]", err?.message || err);
    res.status(500).json({ error: "Failed to load user profile" });
  }
});

// Forgot / reset password. Tokens are stored hashed and are single-use.
authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const result = await pool.query("SELECT id FROM users WHERE email = $1", [parsed.data.email]);
  // Always respond 200 regardless of whether the email exists, so the
  // endpoint can't be used to enumerate registered accounts.
  if (result.rowCount) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '1 hour')`,
      [result.rows[0].id, tokenHash],
    );
    // In production, email `rawToken` (as a reset link) to the user via a
    // transactional email provider. Never log or return it to the client.
    console.log("[auth] password reset requested");
  }
  res.json({ ok: true, message: "If that email exists, a reset link has been sent." });
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const result = await pool.query(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return res.status(400).json({ error: "Reset link is invalid or expired" });

  const passwordHash = await hashPassword(parsed.data.password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
      passwordHash,
      row.user_id,
    ]);
    await client.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [row.id]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[auth/reset-password]", err?.message || err);
    res.status(500).json({ error: "Could not reset password" });
  } finally {
    client.release();
  }
});
