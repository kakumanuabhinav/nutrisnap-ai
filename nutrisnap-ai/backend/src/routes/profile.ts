import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { hashPassword, verifyPassword } from "../services/authCrypto.js";
import { updateProfileSchema, changePasswordSchema } from "../utils/validation.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get("/", async (req, res) => {
  const userId = req.user!.sub;
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, p.age, p.gender, p.height_cm, p.weight_kg,
            p.activity_level, p.nutrition_goal, p.calorie_goal, p.protein_goal,
            p.carb_goal, p.fat_goal, p.fiber_goal
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  if (!result.rowCount) return res.status(404).json({ error: "Profile not found" });
  res.json({ profile: result.rows[0] });
});

// Mifflin-St Jeor based suggestion — shown to the user as a starting point,
// never silently overwriting a value they've set manually.
function suggestCalorieGoal(opts: {
  age?: number;
  gender?: string;
  height_cm?: number;
  weight_kg?: number;
  activity_level?: string;
  nutrition_goal?: string;
}) {
  const { age, gender, height_cm, weight_kg, activity_level, nutrition_goal } = opts;
  if (!age || !height_cm || !weight_kg) return null;

  const bmr =
    gender === "female"
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
      : 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;

  const activityMultiplier: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = bmr * (activityMultiplier[activity_level || "moderate"] || 1.55);

  const goalAdjustment: Record<string, number> = {
    lose_weight: -500,
    gain_muscle: 300,
    maintain: 0,
    general_health: 0,
  };
  return Math.round(tdee + (goalAdjustment[nutrition_goal || "maintain"] || 0));
}

profileRouter.get("/suggested-goals", async (req, res) => {
  const result = await pool.query(
    `SELECT age, gender, height_cm, weight_kg, activity_level, nutrition_goal
     FROM user_profiles WHERE user_id = $1`,
    [req.user!.sub],
  );
  const p = result.rows[0];
  const suggestedCalories = p ? suggestCalorieGoal(p) : null;
  res.json({
    suggested_calorie_goal: suggestedCalories,
    suggested_protein_goal: suggestedCalories ? Math.round((suggestedCalories * 0.3) / 4) : null,
    suggested_carb_goal: suggestedCalories ? Math.round((suggestedCalories * 0.4) / 4) : null,
    suggested_fat_goal: suggestedCalories ? Math.round((suggestedCalories * 0.3) / 9) : null,
  });
});

profileRouter.put("/", async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const userId = req.user!.sub;
  const { name, ...profileFields } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (name) {
      await client.query("UPDATE users SET name = $1, updated_at = now() WHERE id = $2", [
        name,
        userId,
      ]);
    }

    const keys = Object.keys(profileFields) as (keyof typeof profileFields)[];
    if (keys.length) {
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
      const values = keys.map((k) => profileFields[k]);
      await client.query(
        `UPDATE user_profiles SET ${setClauses.join(", ")}, updated_at = now() WHERE user_id = $1`,
        [userId, ...values],
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[profile/update]", err);
    res.status(500).json({ error: "Could not update profile" });
  } finally {
    client.release();
  }
});

profileRouter.post("/change-password", async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const userId = req.user!.sub;
  const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
  const ok = await verifyPassword(result.rows[0].password_hash, parsed.data.current_password);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

  const newHash = await hashPassword(parsed.data.new_password);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    newHash,
    userId,
  ]);
  res.json({ ok: true });
});

profileRouter.delete("/", async (req, res) => {
  // ON DELETE CASCADE on meals/user_profiles/reset tokens removes all
  // dependent rows automatically.
  await pool.query("DELETE FROM users WHERE id = $1", [req.user!.sub]);
  res.clearCookie("nutrisnap_token", { path: "/" });
  res.json({ ok: true });
});

profileRouter.get("/export", async (req, res) => {
  const userId = req.user!.sub;
  const [profile, meals] = await Promise.all([
    pool.query(
      `SELECT u.name, u.email, u.created_at, p.* FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [userId],
    ),
    pool.query("SELECT * FROM meals WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
  ]);
  res.setHeader("Content-Disposition", "attachment; filename=nutrisnap-data-export.json");
  res.json({ profile: profile.rows[0], meals: meals.rows });
});
