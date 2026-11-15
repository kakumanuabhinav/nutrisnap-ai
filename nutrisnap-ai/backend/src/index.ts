import "./utils/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import os from "node:os";
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
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

app.set("trust proxy", 1);

app.use(
  helmet({
    // Allow the API to serve locally-stored images referenced by the frontend.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const isProd = process.env.NODE_ENV === "production";
const rawCorsOrigin = process.env.CORS_ORIGIN || "";
const configuredOrigins = rawCorsOrigin
  ? rawCorsOrigin.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

// CORS: allow credentials, allow local development, configured origins, and Vercel domains
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server, or same-origin rewrites)
      if (!origin) return callback(null, true);

      // In development or if explicitly wildcarded, allow
      if (!isProd || rawCorsOrigin === "*") {
        return callback(null, true);
      }

      // Check configured origins
      if (configuredOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Automatically allow Vercel preview and production domains (*.vercel.app)
      if (/^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
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
const isVercel = !!process.env.VERCEL;
const backendRoot = path.resolve(__dirname, "..");
const uploadsDir = isVercel
  ? path.join(os.tmpdir(), "uploads")
  : existsSync(path.resolve(backendRoot, "uploads"))
  ? path.resolve(backendRoot, "uploads")
  : existsSync(path.resolve(process.cwd(), "nutrisnap-ai", "backend", "uploads"))
  ? path.resolve(process.cwd(), "nutrisnap-ai", "backend", "uploads")
  : path.resolve(process.cwd(), "uploads");

try {
  mkdirSync(uploadsDir, { recursive: true });
} catch (e: any) {
  console.warn("[uploads] Notice: Unable to create uploads directory:", e.message);
}
app.use("/uploads", express.static(uploadsDir));

// Root info and API base endpoints
app.get(["/", "/api"], (_req, res) => {
  res.json({
    status: "success",
    message: "NutriSnap AI API is running",
    service: "nutrisnap-ai-backend",
    health: "/api/health",
    ok: true,
    success: true,
  });
});

app.get(["/health", "/api/health"], (_req, res) => {
  res.json({
    status: "success",
    message: "Backend is running",
    ok: true,
    success: true,
    service: "nutrisnap-ai-backend",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    authConfigured: Boolean(process.env.AUTH_SECRET),
    isVercel,
    timestamp: new Date().toISOString(),
  });
});

// Mount routes supporting both /api/<route> and /<route> prefixes
app.use(["/api/auth", "/auth"], authRouter);
app.use(["/api/meals", "/meals"], mealsRouter);
app.use(["/api/analyze-food", "/analyze-food"], analyzeRouter, analyzeErrorHandler);
app.use(["/api/tracker", "/tracker"], trackerRouter);
app.use(["/api/analytics", "/analytics"], analyticsRouter);
app.use(["/api/profile", "/profile"], profileRouter);

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

if (!process.env.VERCEL) {
  const server = app.listen(PORT, HOST, () => {
    const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
    console.log(`NutriSnap AI backend listening on http://${displayHost}:${PORT}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[server] Port ${PORT} is already in use by another process. Please stop that process or change PORT in .env.`,
      );
      process.exit(1);
    } else {
      console.error("[server] Server startup error:", err);
      process.exit(1);
    }
  });

  // Pre-warm database connection asynchronously on startup
  pool.query("SELECT 1").catch((err) => {
    console.warn("[server] Initial database check warning:", err.message);
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
} else {
  // In serverless environments (Vercel), avoid fire-and-forget background queries on startup.
  // Database connections are established on-demand when an incoming request hits an authenticated route.
  console.log(`[server] Serverless function ready (Vercel runtime: ${process.version})`);
}

console.log(
  `[startup] NutriSnap AI backend initialized (isVercel: ${isVercel}, isProd: ${isProd}, node: ${process.version})`,
);

export default app;
export { app };


