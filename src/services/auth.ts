import { api } from "@/lib/api";
import type { LoginRequest, RegisterRequest, TokenResponse, UserAuthResponse } from "@/types/api";

export const authService = {
  login: (body: LoginRequest) => api.post<TokenResponse>("/auth/login", body).then((r) => r.data),
  register: (body: RegisterRequest) =>
    api.post<UserAuthResponse>("/auth/register", body).then((r) => r.data),
};
