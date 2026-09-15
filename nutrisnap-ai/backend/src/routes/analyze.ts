import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import sharp from "sharp";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { analyzeFoodImage, GeminiAnalysisError } from "../services/geminiService.js";
import { storeImage } from "../services/storageService.js";

export const analyzeRouter = Router();

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 8);
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
    cb(null, true);
  },
});

// AI calls are expensive and abuse-prone: cap per-user request rate.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub || req.ip || "anonymous",
  message: { error: "Too many scans — please wait a moment before trying again." },
});

const errorStatus: Record<string, number> = {
  invalid_key: 401,
  rate_limited: 429,
  timeout: 504,
  safety_blocked: 422,
  invalid_response: 502,
  model_unavailable: 404,
  network_error: 502,
  unknown: 500,
};

const errorCodeCategory: Record<string, string> = {
  invalid_key: "AI_AUTHENTICATION_ERROR",
  rate_limited: "AI_RATE_LIMIT_ERROR",
  timeout: "AI_TIMEOUT_ERROR",
  safety_blocked: "AI_IMAGE_ERROR",
  invalid_response: "AI_MODEL_ERROR",
  model_unavailable: "AI_MODEL_ERROR",
  network_error: "AI_NETWORK_ERROR",
  unknown: "AI_PROVIDER_ERROR",
};

const errorMessage: Record<string, string> = {
  invalid_key: "AI service authentication failed (HTTP 401/403). Please verify your Google AI Studio API key (starts with AIzaSy...).",
  rate_limited: "AI service is temporarily busy or quota limit reached. Please try again shortly.",
  timeout: "AI analysis timed out. Please try again.",
  safety_blocked: "This image could not be analyzed due to safety filters.",
  invalid_response: "AI model returned an unparseable response. Please try again.",
  model_unavailable: "Configured AI model is not available. Please check GEMINI_MODEL in backend/.env.",
  network_error: "Network error reaching AI provider. Please check your connection.",
  unknown: "An unexpected error occurred during AI analysis.",
};

analyzeRouter.post(
  "/",
  requireAuth,
  analyzeLimiter,
  upload.single("image"),
  async (req, res) => {
    const startTime = performance.now();
    const requestId = `req_${crypto.randomUUID().slice(0, 8)}`;
    console.log(`[SCAN] [ID: ${requestId}] Request received`);

    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded", code: "AI_IMAGE_ERROR" });
    }

    console.log(
      `[SCAN] [ID: ${requestId}] Image received: ${req.file.originalname || "upload"} (${req.file.mimetype}, ${(req.file.size / 1024).toFixed(1)} KB)`,
    );

    try {
      const imgProcStart = performance.now();
      // Optimize image for Gemini API input (max 1024px dimension, JPEG 82 quality)
      const optimizedBuffer = await sharp(req.file.buffer)
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();

      const optimizedBase64 = optimizedBuffer.toString("base64");
      const imgProcDuration = Math.round(performance.now() - imgProcStart);
      console.log(
        `[SCAN] [ID: ${requestId}] Image processing completed in ${imgProcDuration}ms (Original: ${(req.file.size / 1024).toFixed(1)}KB -> Optimized: ${(optimizedBuffer.length / 1024).toFixed(1)}KB, Base64: ${(optimizedBase64.length / 1024).toFixed(1)}KB)`,
      );

      const aiStart = performance.now();
      const analysis = await analyzeFoodImage(optimizedBase64, "image/jpeg");
      const aiDuration = Math.round(performance.now() - aiStart);
      console.log(`[SCAN] [ID: ${requestId}] Gemini AI request & validation completed in ${aiDuration}ms`);

      const storageStart = performance.now();
      let imageUrl: string | null = null;
      try {
        imageUrl = await storeImage(req.file.buffer, req.file.mimetype);
      } catch (storageErr) {
        console.error(`[SCAN] [ID: ${requestId}] Image storage failed`, storageErr);
      }
      const storageDuration = Math.round(performance.now() - storageStart);

      const totalDuration = Math.round(performance.now() - startTime);
      console.log(
        `[SCAN] [ID: ${requestId}] Scan completed successfully in ${totalDuration}ms (ImageProc: ${imgProcDuration}ms, AI: ${aiDuration}ms, Storage: ${storageDuration}ms)`,
      );

      res.json({
        analysis,
        image_url: imageUrl,
        request_id: requestId,
        timings: {
          image_proc_ms: imgProcDuration,
          ai_ms: aiDuration,
          storage_ms: storageDuration,
          total_ms: totalDuration,
        },
      });
    } catch (err) {
      const totalDuration = Math.round(performance.now() - startTime);
      if (err instanceof GeminiAnalysisError) {
        const category = errorCodeCategory[err.code] || "AI_PROVIDER_ERROR";
        console.error(`[SCAN] AI Error Diagnosis [ID: ${requestId}, TotalTime: ${totalDuration}ms]:
  Provider: Google Gemini
  Model: ${process.env.GEMINI_MODEL || "gemini-2.5-flash"}
  Code: ${err.code}
  Category: ${category}
  Message: ${err.message}`);

        return res
          .status(errorStatus[err.code] ?? 500)
          .json({
            error: errorMessage[err.code] ?? errorMessage.unknown,
            code: category,
            details: process.env.NODE_ENV === "development" ? err.message : undefined,
            request_id: requestId,
          });
      }
      console.error(`[SCAN] Unexpected error [ID: ${requestId}]`, err);
      res
        .status(500)
        .json({ error: "Unable to analyze the image. Please try again.", code: "AI_PROVIDER_ERROR", request_id: requestId });
    }
  },
);

// Multer errors (bad type, too large) land here via Express's error handler
// signature — mounted after the route in index.ts.
export function analyzeErrorHandler(
  err: unknown,
  _req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: `Image must be under ${MAX_UPLOAD_MB}MB.` });
    }
    return res.status(400).json({ error: "Invalid upload." });
  }
  if (err instanceof Error && err.message === "UNSUPPORTED_FILE_TYPE") {
    return res.status(415).json({ error: "Unsupported image type. Use JPEG, PNG, WEBP, or HEIC." });
  }
  next(err);
}
