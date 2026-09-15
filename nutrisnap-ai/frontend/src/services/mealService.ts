import { apiRequest } from "./apiClient";
import type { Meal, Nutrition, DetectedFood, Insight } from "../types";

export interface LogMealInput {
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  image_url?: string | null;
  summary?: string;
  ai_confidence?: number;
  serving_multiplier: number;
  nutrition: Nutrition;
  detected_foods: DetectedFood[];
  insights?: Insight[];
}

export interface MealFilters {
  from?: string;
  to?: string;
  meal_type?: string;
  q?: string;
}

export const mealService = {
  logMeal(input: LogMealInput) {
    return apiRequest<{ meal: Meal }>("/meals", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  listMeals(filters: MealFilters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v) as [string, string][],
    );
    const qs = params.toString();
    return apiRequest<{ meals: Meal[] }>(`/meals${qs ? `?${qs}` : ""}`);
  },
  getMeal(id: string) {
    return apiRequest<{ meal: Meal; detected_foods: DetectedFood[]; insights: Insight[] }>(
      `/meals/${id}`,
    );
  },
  deleteMeal(id: string) {
    return apiRequest<{ ok: true }>(`/meals/${id}`, { method: "DELETE" });
  },
};
