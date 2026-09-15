import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

async function getTrend(userId: string, days: number) {
  const dailyResult = await pool.query(
    `SELECT
       created_at::date AS day,
       SUM(calories) AS calories,
       SUM(protein) AS protein,
       SUM(carbs) AS carbs,
       SUM(fat) AS fat,
       SUM(fiber) AS fiber,
       COUNT(*) AS meal_count
     FROM meals
     WHERE user_id = $1 AND created_at >= now() - ($2 || ' days')::interval
     GROUP BY day
     ORDER BY day ASC`,
    [userId, days],
  );

  const summaryResult = await pool.query(
    `SELECT
       COUNT(*) AS total_meals,
       COALESCE(AVG(calories), 0) AS avg_calories_per_meal,
       COALESCE(SUM(calories), 0) AS total_calories
     FROM meals
     WHERE user_id = $1 AND created_at >= now() - ($2 || ' days')::interval`,
    [userId, days],
  );

  const daily = dailyResult.rows.map((r) => ({
    date: r.day,
    calories: Number(r.calories),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fat: Number(r.fat),
    fiber: Number(r.fiber),
    meal_count: Number(r.meal_count),
  }));

  const summary = summaryResult.rows[0];
  const activeDays = daily.length || 1;

  return {
    range_days: days,
    daily,
    total_meals: Number(summary.total_meals),
    average_calories_per_meal: Math.round(Number(summary.avg_calories_per_meal)),
    average_daily_calories: Math.round(Number(summary.total_calories) / activeDays),
  };
}

analyticsRouter.get("/weekly", async (req, res) => {
  res.json(await getTrend(req.user!.sub, 7));
});

analyticsRouter.get("/monthly", async (req, res) => {
  res.json(await getTrend(req.user!.sub, 30));
});

// Bonus beyond the spec's two endpoints: lets the frontend's 7/30/90-day
// selector (section 16) hit one endpoint instead of three.
analyticsRouter.get("/range/:days", async (req, res) => {
  const days = Number(req.params.days);
  if (![7, 30, 90].includes(days)) {
    return res.status(400).json({ error: "days must be 7, 30, or 90" });
  }
  res.json(await getTrend(req.user!.sub, days));
});
