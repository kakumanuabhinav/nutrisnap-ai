import "./utils/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";

import { authRouter } from "./routes/auth.js";
import { mealsRouter } from "./routes/meals.js";
import { analyzeRouter, analyzeErrorHandler } from "./routes/analyze.js";
import { trackerRouter } from "./routes/tracker.js";
import { analyticsRouter } from "./routes/analytics.js";
import { profileRouter } from "./routes/profile.js";
import { pool } from "./db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.set("trust proxy", 1);

app.use(
  helmet({
    // Allow the API to serve locally-stored images referenced by the frontend.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const isProd = process.env.NODE_ENV === "production";
const rawCorsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const allowedOrigins = rawCorsOrigin.includes(",")
  ? rawCorsOrigin.split(",").map((o) => o.trim())
  : rawCorsOrigin;

if (isProd && !process.env.CORS_ORIGIN) {
  console.warn("[cors] Warning: CORS_ORIGIN is not set in production. Set CORS_ORIGIN to your frontend URL.");
}

// CORS: allow credentials and accept development requests while preserving production origin restrictions
app.use(
  cors({
    origin: isProd ? allowedOrigins : true,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" })); // JSON bodies only — images go through multer, not JSON
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Global request-size-based rate limit as a baseline defense; the AI
// endpoint layers a stricter limit on top (see routes/analyze.ts).
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// Serve locally-stored uploads (STORAGE_DRIVER=local only).
const backendRoot = path.resolve(__dirname, "..");
const uploadsDir = existsSync(path.resolve(backendRoot, "uploads"))
  ? path.resolve(backendRoot, "uploads")
  : existsSync(path.resolve(process.cwd(), "nutrisnap-ai", "backend", "uploads"))
  ? path.resolve(process.cwd(), "nutrisnap-ai", "backend", "uploads")
  : path.resolve(process.cwd(), "uploads");

mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// API base and health check endpoints
app.get("/api", (_req, res) => {
  res.json({ success: true, message: "NutriSnap AI API is running" });
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "healthy", ok: true, service: "nutrisnap-ai-backend" });
});

app.use("/api/auth", authRouter);
app.use("/api/meals", mealsRouter);
app.use("/api/analyze-food", analyzeRouter, analyzeErrorHandler);
app.use("/api/tracker", trackerRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/profile", profileRouter);

// 404 for unmatched API routes
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// Centralized error handler — never leak stack traces to the client.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[unhandled]", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  },
);

const server = app.listen(PORT, () => {
  console.log(`NutriSnap AI backend running on http://localhost:${PORT}`);
});

// Graceful shutdown for container and process orchestrators
const shutdown = async (signal: string) => {
  console.log(`[server] ${signal} received, closing HTTP server and database pool...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log("[server] Graceful shutdown completed.");
      process.exit(0);
    } catch (err) {
      console.error("[server] Error closing database pool:", err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("[server] Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));


