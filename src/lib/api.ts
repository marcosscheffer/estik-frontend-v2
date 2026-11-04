import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { TokenResponse } from "@/types/api";
import { isExpiringSoon, tokenStore } from "./tokens";

const baseURL = import.meta.env.VITE_API_URL || "/api";
/** Usado pelo SSE, que é feito com fetch e não passa pelo axios. */
export const apiBaseURL = baseURL;

// Sem Content-Type fixo: o axios põe application/json para objetos e deixa o
// navegador montar o multipart (com boundary) quando o body é FormData.
export const api = axios.create({ baseURL });

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

/** O Spring devolve 403 com corpo vazio quando o token falta ou venceu (não há 401). */
function isEmptyBody(data: unknown): boolean {
  return data == null || data === "" || (typeof data === "object" && Object.keys(data as object).length === 0);
}

// Depois: se voltou 401, ou 403 sem corpo (token vencido/ausente), ou 403
// com o token já vencido, tenta 1 refresh e repete a requisição.
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
      (status === 401 || (status === 403 && (tokenLooksExpired || isEmptyBody(error.response?.data))));

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
