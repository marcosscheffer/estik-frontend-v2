import { jwtDecode } from "jwt-decode";
import type { Role, TokenResponse, UUID } from "@/types/api";

const ACCESS_KEY = "estik.accessToken";
const REFRESH_KEY = "estik.refreshToken";

/** Claims que o JwtTokenAdapter do backend coloca no access token. */
export interface AccessClaims {
  sub: UUID;
  username: string;
  role: Role;
  type: "access" | "refresh";
  iss?: string;
  iat?: number;
  exp?: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),

  set(tokens: TokenResponse) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    listeners.forEach((l) => l());
  },

  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    listeners.forEach((l) => l());
  },

  /** Avisa quando os tokens mudam (login, refresh, logout). */
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function decodeAccess(token: string | null): AccessClaims | null {
  if (!token) return null;
  try {
    return jwtDecode<AccessClaims>(token);
  } catch {
    return null;
  }
}

/** true se o token vence nos próximos `marginSeconds` segundos. */
export function isExpiringSoon(token: string | null, marginSeconds = 30): boolean {
  const claims = decodeAccess(token);
  if (!claims?.exp) return true;
  return claims.exp * 1000 - Date.now() < marginSeconds * 1000;
}
