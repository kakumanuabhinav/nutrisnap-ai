import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

export const trackerRouter = Router();
trackerRouter.use(requireAuth);

async function getDayTotals(userId: string, date: string) {
  const [totalsResult, profileResult, mealsResult] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(calories), 0) AS calories,
         COALESCE(SUM(protein), 0) AS protein,
         COALESCE(SUM(carbs), 0) AS carbs,
         COALESCE(SUM(fat), 0) AS fat,
         COALESCE(SUM(fiber), 0) AS fiber
       FROM meals
       WHERE user_id = $1 AND created_at::date = $2::date`,
      [userId, date],
    ),
    pool.query(
      `SELECT calorie_goal, protein_goal, carb_goal, fat_goal, fiber_goal
       FROM user_profiles WHERE user_id = $1`,
      [userId],
    ),
    pool.query(
      `SELECT id, meal_type, calories, protein, carbs, fat, created_at, summary
       FROM meals WHERE user_id = $1 AND created_at::date = $2::date
       ORDER BY created_at ASC`,
      [userId, date],
    ),
  ]);

  const totals = totalsResult.rows[0];
  const goals = profileResult.rows[0] || {
    calorie_goal: 2000,
    protein_goal: 120,
    carb_goal: 250,
    fat_goal: 70,
    fiber_goal: 30,
  };

  return {
    date,
    consumed: {
      calories: Number(totals.calories),
      protein: Number(totals.protein),
      carbs: Number(totals.carbs),
      fat: Number(totals.fat),
      fiber: Number(totals.fiber),
    },
    goals: {
      calories: goals.calorie_goal,
      protein: goals.protein_goal,
      carbs: goals.carb_goal,
      fat: goals.fat_goal,
      fiber: goals.fiber_goal,
    },
    remaining_calories: Math.max(0, goals.calorie_goal - Number(totals.calories)),
    progress_pct: Math.min(100, Math.round((Number(totals.calories) / goals.calorie_goal) * 100)),
    meals: mealsResult.rows,
  };
}

trackerRouter.get("/today", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  res.json(await getDayTotals(req.user!.sub, today));
});

trackerRouter.get("/:date", async (req, res) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }
  res.json(await getDayTotals(req.user!.sub, req.params.date));
});
