import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { createMealSchema } from "../utils/validation.js";
import type { Nutrition } from "../types/index.js";

export const mealsRouter = Router();
mealsRouter.use(requireAuth);

function scaleNutrition(n: Nutrition, multiplier: number): Nutrition {
  const scaled = {} as Nutrition;
  (Object.keys(n) as (keyof Nutrition)[]).forEach((k) => {
    scaled[k] = Math.round(n[k] * multiplier * 100) / 100;
  });
  return scaled;
}

mealsRouter.post("/", async (req, res) => {
  const parsed = createMealSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid meal data", details: parsed.error.issues });
  }
  const userId = req.user!.sub; // never trust a client-supplied user id
  const { meal_type, image_url, summary, ai_confidence, serving_multiplier, nutrition, detected_foods, insights } =
    parsed.data;

  // Nutrition values are recalculated from the raw AI values + multiplier
  // server-side, never taken as-is from the client, so a tampered request
  // body can't inflate/deflate what gets stored.
  const scaled = scaleNutrition(nutrition, serving_multiplier);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const mealResult = await client.query(
      `INSERT INTO meals
         (user_id, meal_type, image_url, summary, ai_confidence, serving_multiplier,
          calories, protein, carbs, fat, fiber, sugar, sodium, potassium, saturated_fat, cholesterol)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        userId,
        meal_type,
        image_url ?? null,
        summary ?? null,
        ai_confidence ?? null,
        serving_multiplier,
        scaled.calories,
        scaled.protein,
        scaled.carbs,
        scaled.fat,
        scaled.fiber,
        scaled.sugar,
        scaled.sodium,
        scaled.potassium,
        scaled.saturated_fat,
        scaled.cholesterol,
      ],
    );
    const meal = mealResult.rows[0];

    for (const food of detected_foods) {
      await client.query(
        `INSERT INTO meal_foods (meal_id, food_name, confidence, estimated_quantity)
         VALUES ($1, $2, $3, $4)`,
        [meal.id, food.name, food.confidence, food.estimated_quantity ?? null],
      );
    }
    for (const insight of insights ?? []) {
      await client.query(
        `INSERT INTO meal_insights (meal_id, type, text) VALUES ($1, $2, $3)`,
        [meal.id, insight.type, insight.text],
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ meal, detected_foods, insights: insights ?? [] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[meals/create]", err);
    res.status(500).json({ error: "Could not save meal" });
  } finally {
    client.release();
  }
});

mealsRouter.get("/", async (req, res) => {
  const userId = req.user!.sub;
  const { from, to, meal_type, q, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const conditions = ["user_id = $1"];
  const params: unknown[] = [userId];

  if (from) {
    params.push(from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`created_at <= $${params.length}`);
  }
  if (meal_type) {
    params.push(meal_type);
    conditions.push(`meal_type = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(
      `id IN (SELECT meal_id FROM meal_foods WHERE food_name ILIKE $${params.length})`,
    );
  }

  params.push(Math.min(Number(limit) || 50, 200));
  params.push(Number(offset) || 0);

  const result = await pool.query(
    `SELECT * FROM meals WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  res.json({ meals: result.rows });
});

mealsRouter.get("/:id", async (req, res) => {
  const userId = req.user!.sub;
  const mealResult = await pool.query("SELECT * FROM meals WHERE id = $1 AND user_id = $2", [
    req.params.id,
    userId,
  ]);
  const meal = mealResult.rows[0];
  if (!meal) return res.status(404).json({ error: "Meal not found" });

  const [foods, insights] = await Promise.all([
    pool.query("SELECT * FROM meal_foods WHERE meal_id = $1", [meal.id]),
    pool.query("SELECT * FROM meal_insights WHERE meal_id = $1", [meal.id]),
  ]);

  res.json({ meal, detected_foods: foods.rows, insights: insights.rows });
});

mealsRouter.delete("/:id", async (req, res) => {
  const userId = req.user!.sub;
  // WHERE clause scopes to the authenticated user, so this can never
  // delete another user's meal even if the id is guessed.
  const result = await pool.query("DELETE FROM meals WHERE id = $1 AND user_id = $2 RETURNING id", [
    req.params.id,
    userId,
  ]);
  if (!result.rowCount) return res.status(404).json({ error: "Meal not found" });
  res.json({ ok: true });
});
