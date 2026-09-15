import { apiRequest } from "./apiClient";
import type { Profile } from "../types";

export const profileService = {
  get() {
    return apiRequest<{ profile: Profile }>("/profile");
  },
  suggestedGoals() {
    return apiRequest<{
      suggested_calorie_goal: number | null;
      suggested_protein_goal: number | null;
      suggested_carb_goal: number | null;
      suggested_fat_goal: number | null;
    }>("/profile/suggested-goals");
  },
  update(fields: Partial<Profile>) {
    return apiRequest<{ ok: true }>("/profile", {
      method: "PUT",
      body: JSON.stringify(fields),
    });
  },
  changePassword(current_password: string, new_password: string) {
    return apiRequest<{ ok: true }>("/profile/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    });
  },
  deleteAccount() {
    return apiRequest<{ ok: true }>("/profile", { method: "DELETE" });
  },
};
