import { apiRequest } from "./apiClient";
import type { AnalyticsTrend } from "../types";

export const analyticsService = {
  range(days: 7 | 30 | 90) {
    return apiRequest<AnalyticsTrend>(`/analytics/range/${days}`);
  },
};
