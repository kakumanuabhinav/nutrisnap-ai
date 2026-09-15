import "../utils/env.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { foodAnalysisSchema } from "../utils/validation.js";
import type { FoodAnalysis } from "../types/index.js";

const SYSTEM_PROMPT = `You are a nutrition-estimation vision assistant for NutriSnap AI.

Given a photo of a meal, you must:
1. Identify every distinct visible food item.
2. Estimate the portion size of each item (in grams or a natural unit).
3. Estimate total calories and macronutrients (protein, carbs, fat, fiber) for the whole plate.
4. Estimate key micronutrients (sugar, sodium, potassium, saturated fat, cholesterol).
5. Assign a confidence score (0-100) to each detected food based on visual certainty.
6. Provide 2-4 short, genuinely useful health insights, each tagged "good", "warning", or "info".
7. Write a one-sentence plain-language summary of the meal.

Rules:
- Never claim certainty you don't have. These are estimates from a photo, not a lab measurement.
- If the image contains no identifiable food, return an empty detected_foods array and explain that in "summary".
- Base portion/calorie estimates on typical serving sizes and visible plate/utensil scale cues.
- Return ONLY valid JSON matching this exact shape, with no markdown fences, no commentary:

{
  "detected_foods": [
    { "name": string, "confidence": number (0-100), "estimated_quantity": string }
  ],
  "nutrition": {
    "calories": number, "protein": number, "carbs": number, "fat": number,
    "fiber": number, "sugar": number, "sodium": number, "potassium": number,
    "saturated_fat": number, "cholesterol": number
  },
  "insights": [ { "type": "good" | "warning" | "info", "text": string } ],
  "summary": string
}`;

export class GeminiAnalysisError extends Error {
  constructor(
    message: string,
    public code:
      | "invalid_key"
      | "rate_limited"
      | "timeout"
      | "safety_blocked"
      | "invalid_response"
      | "model_unavailable"
      | "network_error"
      | "unknown",
  ) {
    super(message);
    this.name = "GeminiAnalysisError";
  }
}

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 0;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new GeminiAnalysisError("Gemini request timed out", "timeout")),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function classifyError(err: unknown): GeminiAnalysisError {
  if (err instanceof GeminiAnalysisError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as any)?.status;
  const lower = message.toLowerCase();

  // HTTP 401 / 403 / Invalid Key / Unauthorized / Unsupported Token
  if (
    status === 401 ||
    status === 403 ||
    lower.includes("api key") ||
    lower.includes("api_key") ||
    lower.includes("unauthorized") ||
    lower.includes("access_token") ||
    lower.includes("forbidden") ||
    lower.includes("credential")
  ) {
    return new GeminiAnalysisError(
      "Gemini API authentication failed (HTTP 401/403). Please verify your Google AI Studio API key (starts with AIzaSy...).",
      "invalid_key",
    );
  }

  // HTTP 429 / Quota / Rate Limit
  if (status === 429 || lower.includes("quota") || lower.includes("rate limit") || lower.includes("resource_exhausted")) {
    return new GeminiAnalysisError("Gemini API rate limit or quota exceeded", "rate_limited");
  }

  // HTTP 404 / Model Not Found
  if (status === 404 || lower.includes("404") || lower.includes("not found")) {
    return new GeminiAnalysisError(`Gemini model is not available: ${message}`, "model_unavailable");
  }

  // Safety / Blocked
  if (lower.includes("safety") || lower.includes("blocked")) {
    return new GeminiAnalysisError("Image blocked by safety filters", "safety_blocked");
  }

  // HTTP 503 / Server Overloaded
  if (status === 503 || lower.includes("503") || lower.includes("unavailable") || lower.includes("overloaded")) {
    return new GeminiAnalysisError("Gemini model temporarily unavailable", "model_unavailable");
  }

  // Network / Fetch error
  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("enotfound")) {
    return new GeminiAnalysisError("Network error reaching Gemini API", "network_error");
  }

  return new GeminiAnalysisError(message || "Unknown Gemini error", "unknown");
}

/** Extract the first top-level JSON object from a model response, in case
 * the model wraps it in prose or ```json fences despite instructions. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new GeminiAnalysisError("Model did not return JSON", "invalid_response");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new GeminiAnalysisError("Model returned malformed JSON", "invalid_response");
  }
}

function sanitizeFoodAnalysis(data: any): any {
  if (!data || typeof data !== "object") return data;
  const sanitized = { ...data };

  if (Array.isArray(sanitized.detected_foods)) {
    sanitized.detected_foods = sanitized.detected_foods.slice(0, 30).map((f: any) => ({
      name: typeof f?.name === "string" ? f.name.slice(0, 250) : "Food Item",
      confidence: Math.min(100, Math.max(0, Number(f?.confidence) || 80)),
      estimated_quantity: typeof f?.estimated_quantity === "string" ? f.estimated_quantity.slice(0, 400) : undefined,
    }));
  } else {
    sanitized.detected_foods = [];
  }

  if (sanitized.nutrition && typeof sanitized.nutrition === "object") {
    for (const key of ["calories", "protein", "carbs", "fat", "fiber", "sugar", "sodium", "potassium", "saturated_fat", "cholesterol"]) {
      sanitized.nutrition[key] = Math.max(0, Number(sanitized.nutrition[key]) || 0);
    }
  }

  if (Array.isArray(sanitized.insights)) {
    sanitized.insights = sanitized.insights.slice(0, 10).map((i: any) => ({
      type: ["good", "warning", "info"].includes(i?.type) ? i.type : "info",
      text: typeof i?.text === "string" ? i.text.slice(0, 800) : "Nutritional insight",
    }));
  } else {
    sanitized.insights = [];
  }

  if (typeof sanitized.summary === "string") {
    sanitized.summary = sanitized.summary.slice(0, 2000);
  } else {
    sanitized.summary = "Meal nutrition estimation based on image.";
  }

  return sanitized;
}

async function callGeminiOnce(imageBase64: string, mimeType: string): Promise<FoodAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your-gemini-api-key-here") {
    console.error(
      "[geminiService] GEMINI_API_KEY is not configured or is set to the default placeholder ('your-gemini-api-key-here'). Please set a valid Google Gemini API key in backend/.env",
    );
    throw new GeminiAnalysisError(
      "GEMINI_API_KEY is not configured in backend/.env",
      "invalid_key",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
    },
  });

  const result = await withTimeout(
    model.generateContent([
      { text: SYSTEM_PROMPT },
      { inlineData: { data: imageBase64, mimeType } },
    ]),
    REQUEST_TIMEOUT_MS,
  );

  const response = result.response;
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    throw new GeminiAnalysisError(`Blocked by safety filter: ${blockReason}`, "safety_blocked");
  }

  const text = response.text();
  if (!text || !text.trim()) {
    throw new GeminiAnalysisError("Empty response from Gemini", "invalid_response");
  }

  const parsed = extractJson(text);
  const sanitized = sanitizeFoodAnalysis(parsed);
  const validated = foodAnalysisSchema.safeParse(sanitized);
  if (!validated.success) {
    throw new GeminiAnalysisError(
      `AI response failed validation: ${validated.error.issues.map((i) => i.message).join(", ")}`,
      "invalid_response",
    );
  }
  return validated.data;
}

/** Analyze a food image, with retry on transient failures (timeout,
 * model_unavailable, network_error). Non-transient errors (bad key, safety
 * block, malformed response after retries) surface immediately. */
export async function analyzeFoodImage(
  imageBase64: string,
  mimeType: string,
): Promise<FoodAnalysis> {
  let lastError: GeminiAnalysisError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(imageBase64, mimeType);
    } catch (err) {
      const classified = classifyError(err);
      lastError = classified;
      const transient = ["model_unavailable", "network_error"].includes(
        classified.code,
      );
      if (!transient || attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  throw lastError ?? new GeminiAnalysisError("Unknown Gemini failure", "unknown");
}
