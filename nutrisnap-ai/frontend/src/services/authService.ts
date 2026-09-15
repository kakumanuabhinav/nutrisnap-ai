import { apiRequest } from "./apiClient";
import type { User } from "../types";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  age?: number;
  gender?: string;
  height_cm?: number;
  weight_kg?: number;
  activity_level?: string;
  nutrition_goal?: string;
}

export const authService = {
  register(input: RegisterInput) {
    return apiRequest<{ user: User; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  login(email: string, password: string) {
    return apiRequest<{ user: User; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  logout() {
    return apiRequest<{ ok: true }>("/auth/logout", { method: "POST" });
  },
  me() {
    return apiRequest<{ user: User & { created_at: string } }>("/auth/me");
  },
  forgotPassword(email: string) {
    return apiRequest<{ ok: true; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(token: string, password: string) {
    return apiRequest<{ ok: true }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },
};
