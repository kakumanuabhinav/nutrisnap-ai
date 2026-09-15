export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  potassium: number;
  saturated_fat: number;
  cholesterol: number;
}

export interface DetectedFood {
  name: string;
  confidence: number;
  estimated_quantity?: string;
}

export type InsightType = "good" | "warning" | "info";

export interface Insight {
  type: InsightType;
  text: string;
}

export interface FoodAnalysis {
  detected_foods: DetectedFood[];
  nutrition: Nutrition;
  insights: Insight[];
  summary: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Meal {
  id: string;
  user_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  image_url: string | null;
  summary: string | null;
  ai_confidence: number | null;
  serving_multiplier: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  potassium: number;
  saturated_fat: number;
  cholesterol: number;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  age?: number;
  gender?: string;
  height_cm?: number;
  weight_kg?: number;
  activity_level?: string;
  nutrition_goal?: string;
  calorie_goal: number;
  protein_goal: number;
  carb_goal: number;
  fat_goal: number;
  fiber_goal: number;
}

export interface TrackerDay {
  date: string;
  consumed: Nutrition extends never ? never : Pick<Nutrition, "calories" | "protein" | "carbs" | "fat" | "fiber">;
  goals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  remaining_calories: number;
  progress_pct: number;
  meals: Meal[];
}

export interface AnalyticsTrend {
  range_days: number;
  daily: Array<{
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    meal_count: number;
  }>;
  total_meals: number;
  average_calories_per_meal: number;
  average_daily_calories: number;
}
