-- NutriSnap AI — PostgreSQL schema
-- Run via: npm run migrate  (see src/db/migrate.ts)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;   -- for case-insensitive email

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER,
  gender TEXT,
  height_cm NUMERIC(5, 1),
  weight_kg NUMERIC(5, 1),
  activity_level TEXT CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
  nutrition_goal TEXT CHECK (nutrition_goal IN ('lose_weight','maintain','gain_muscle','general_health')),
  calorie_goal INTEGER NOT NULL DEFAULT 2000,
  protein_goal INTEGER NOT NULL DEFAULT 120,
  carb_goal INTEGER NOT NULL DEFAULT 250,
  fat_goal INTEGER NOT NULL DEFAULT 70,
  fiber_goal INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL DEFAULT 'snack' CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  image_url TEXT,
  summary TEXT,
  ai_confidence NUMERIC(5, 2),
  calories NUMERIC(7, 2) NOT NULL DEFAULT 0,
  protein NUMERIC(7, 2) NOT NULL DEFAULT 0,
  carbs NUMERIC(7, 2) NOT NULL DEFAULT 0,
  fat NUMERIC(7, 2) NOT NULL DEFAULT 0,
  fiber NUMERIC(7, 2) NOT NULL DEFAULT 0,
  sugar NUMERIC(7, 2) NOT NULL DEFAULT 0,
  sodium NUMERIC(7, 2) NOT NULL DEFAULT 0,
  potassium NUMERIC(7, 2) NOT NULL DEFAULT 0,
  saturated_fat NUMERIC(7, 2) NOT NULL DEFAULT 0,
  cholesterol NUMERIC(7, 2) NOT NULL DEFAULT 0,
  serving_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meals_user_created ON meals(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS meal_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  confidence NUMERIC(5, 2),
  estimated_quantity TEXT
);
CREATE INDEX IF NOT EXISTS idx_meal_foods_meal ON meal_foods(meal_id);

CREATE TABLE IF NOT EXISTS meal_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('good','warning','info')),
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meal_insights_meal ON meal_insights(meal_id);

-- Kept for the spec's explicit table list; daily targets currently live on
-- user_profiles. This table allows per-day overrides without touching the
-- profile defaults (e.g. a lighter goal on a rest day).
CREATE TABLE IF NOT EXISTS daily_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_date DATE NOT NULL,
  calorie_goal INTEGER,
  protein_goal INTEGER,
  carb_goal INTEGER,
  fat_goal INTEGER,
  fiber_goal INTEGER,
  UNIQUE(user_id, goal_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_goals_user_date ON daily_goals(user_id, goal_date);
