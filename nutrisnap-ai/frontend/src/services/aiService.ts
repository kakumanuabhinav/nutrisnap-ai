import { apiRequest, API_BASE, ApiError } from "./apiClient";
import type { FoodAnalysis } from "../types";

export interface AnalyzeResult {
  analysis: FoodAnalysis;
  image_url: string | null;
}

export const aiService = {
  async analyzeFood(file: File): Promise<AnalyzeResult> {
    if (!navigator.onLine) {
      throw new ApiError(
        "You're offline. Connect to the internet to analyze a meal.",
        0,
        "offline",
      );
    }
    const formData = new FormData();
    formData.append("image", file);

    return apiRequest<AnalyzeResult>("/analyze-food", {
      method: "POST",
      isForm: true,
      body: formData,
    });
  },
};

export { API_BASE };
