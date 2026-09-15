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

export interface AuthTokenPayload {
  sub: string; // user id
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}
