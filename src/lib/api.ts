import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { TokenResponse } from "@/types/api";
import { isExpiringSoon, tokenStore } from "./tokens";

const baseURL = import.meta.env.VITE_API_URL || "/api";
/** Usado pelo SSE, que é feito com fetch e não passa pelo axios. */
export const apiBaseURL = baseURL;

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

/** Cliente sem interceptors, usado só para o refresh (evita loop). */
const bare = axios.create({ baseURL, headers: { "Content-Type": "application/json" } });

let refreshing: Promise<string> | null = null;

/**
 * Troca o refresh token por um par novo. Se várias requisições
 * precisarem de refresh ao mesmo tempo, todas esperam a mesma promise.
 */
export function refreshAccessToken(): Promise<string> {
  if (refreshing) return refreshing;

  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return Promise.reject(new Error("Sem refresh token"));

  refreshing = bare
    .post<TokenResponse>("/auth/refresh", { refreshToken })
    .then(({ data }) => {
      tokenStore.set(data);
      return data.accessToken;
    })
    .catch((err) => {
      tokenStore.clear();
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

const isAuthRoute = (url?: string) => !!url && url.startsWith("/auth/");

// Antes de cada requisição: se o access token já está vencendo, renova antes.
api.interceptors.request.use(async (config) => {
  if (isAuthRoute(config.url)) return config;

  let token = tokenStore.getAccess();
  if (token && isExpiringSoon(token) && tokenStore.getRefresh()) {
    try {
      token = await refreshAccessToken();
    } catch {
      token = null;
    }
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Depois: se voltou 401 (ou 403 com token vencido, que é o que o Spring
// devolve hoje sem AuthenticationEntryPoint), tenta 1 refresh e repete.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;

    const tokenLooksExpired = isExpiringSoon(tokenStore.getAccess(), 0);
    const shouldRefresh =
      original &&
      !original._retry &&
      !isAuthRoute(original.url) &&
      tokenStore.getRefresh() &&
      (status === 401 || (status === 403 && tokenLooksExpired));

    if (shouldRefresh) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        // refresh falhou: tokenStore.clear() já disparou o logout
      }
    }
    return Promise.reject(error);
  },
);
