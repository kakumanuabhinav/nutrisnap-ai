import { z } from "zod";

/**
 * ============================================================
 * AUTHENTICATION SCHEMAS
 * ============================================================
 */

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),

  email: z.string().trim().email().max(200),

  password: z.string().min(8).max(200),

  age: z.coerce.number().int().min(10).max(120).optional(),

  gender: z.string().trim().max(30).optional(),

  height_cm: z.coerce.number().min(50).max(260).optional(),

  weight_kg: z.coerce.number().min(20).max(400).optional(),

  activity_level: z
    .enum([
      "sedentary",
      "light",
      "moderate",
      "active",
      "very_active",
    ])
    .optional(),

  nutrition_goal: z
    .enum([
      "lose_weight",
      "maintain",
      "gain_muscle",
      "general_health",
    ])
    .optional(),
});


export const loginSchema = z.object({
  email: z.string().trim().email().max(200),

  password: z.string().min(1).max(200),
});


export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(200),
});


export const resetPasswordSchema = z.object({
  token: z.string().min(10),

  password: z.string().min(8).max(200),
});


/**
 * ============================================================
 * NUTRITION SCHEMA
 * ============================================================
 */

export const nutritionSchema = z.object({
  calories: z.coerce.number().nonnegative(),

  protein: z.coerce.number().nonnegative(),

  carbs: z.coerce.number().nonnegative(),

  fat: z.coerce.number().nonnegative(),

  fiber: z.coerce.number().nonnegative(),

  sugar: z.coerce.number().nonnegative(),

  sodium: z.coerce.number().nonnegative(),

  potassium: z.coerce.number().nonnegative(),

  saturated_fat: z.coerce.number().nonnegative(),

  cholesterol: z.coerce.number().nonnegative(),
});


/**
 * ============================================================
 * DETECTED FOOD
 * ============================================================
 */

export const detectedFoodSchema = z.object({
  name: z.string().trim().min(1).max(300),

  confidence: z.coerce
    .number()
    .min(0)
    .max(100),

  estimated_quantity: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v ?? undefined),
});


/**
 * ============================================================
 * AI INSIGHTS
 * ============================================================
 */

export const insightSchema = z.object({
  type: z.enum([
    "good",
    "warning",
    "info",
  ]),

  text: z
    .string()
    .trim()
    .min(1)
    .max(1000),
});


/**
 * ============================================================
 * AI FOOD ANALYSIS RESPONSE
 * ============================================================
 */

export const foodAnalysisSchema = z.object({
  detected_foods: z
    .array(detectedFoodSchema)
    .max(50),

  nutrition: nutritionSchema,

  insights: z
    .array(insightSchema)
    .max(20),

  summary: z
    .string()
    .trim()
    .min(1)
    .max(3000),
});


/**
 * ============================================================
 * CREATE MEAL
 * ============================================================
 */

export const createMealSchema = z.object({
  meal_type: z
    .enum([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
    ])
    .default("snack"),

  image_url: z
    .string()
    .url()
    .optional()
    .nullable(),

  summary: z
    .string()
    .trim()
    .max(1000)
    .optional(),

  ai_confidence: z.coerce
    .number()
    .min(0)
    .max(100)
    .optional(),

  serving_multiplier: z.coerce
    .number()
    .positive()
    .max(10)
    .default(1),

  nutrition: nutritionSchema,

  detected_foods: z
    .array(detectedFoodSchema)
    .min(1)
    .max(15),

  insights: z
    .array(insightSchema)
    .max(10)
    .optional(),
});


/**
 * ============================================================
 * UPDATE PROFILE
 * ============================================================
 */

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .optional(),

  age: z.coerce
    .number()
    .int()
    .min(10)
    .max(120)
    .optional(),

  gender: z
    .string()
    .trim()
    .max(30)
    .optional(),

  height_cm: z.coerce
    .number()
    .min(50)
    .max(260)
    .optional(),

  weight_kg: z.coerce
    .number()
    .min(20)
    .max(400)
    .optional(),

  activity_level: z
    .enum([
      "sedentary",
      "light",
      "moderate",
      "active",
      "very_active",
    ])
    .optional(),

  nutrition_goal: z
    .enum([
      "lose_weight",
      "maintain",
      "gain_muscle",
      "general_health",
    ])
    .optional(),

  calorie_goal: z.coerce
    .number()
    .int()
    .min(800)
    .max(6000)
    .optional(),

  protein_goal: z.coerce
    .number()
    .int()
    .min(0)
    .max(600)
    .optional(),

  carb_goal: z.coerce
    .number()
    .int()
    .min(0)
    .max(900)
    .optional(),

  fat_goal: z.coerce
    .number()
    .int()
    .min(0)
    .max(400)
    .optional(),

  fiber_goal: z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
    .optional(),
});


/**
 * ============================================================
 * CHANGE PASSWORD
 * ============================================================
 */

export const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(200),

  new_password: z.string().min(8).max(200),
});