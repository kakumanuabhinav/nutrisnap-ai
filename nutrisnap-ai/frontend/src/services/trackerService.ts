import { apiRequest } from "./apiClient";
import type { TrackerDay } from "../types";

export const trackerService = {
  today() {
    return apiRequest<TrackerDay>("/tracker/today");
  },
  byDate(date: string) {
    return apiRequest<TrackerDay>(`/tracker/${date}`);
  },
};
