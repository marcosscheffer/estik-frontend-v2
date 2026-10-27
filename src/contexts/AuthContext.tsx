import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { decodeAccess, tokenStore, type AccessClaims } from "@/lib/tokens";
import { hasRole } from "@/lib/roles";
import { authService } from "@/services/auth";
import { usersService } from "@/services/users";
import type { LoginRequest, Role, UserResponse } from "@/types/api";

interface AuthContextValue {
  claims: AccessClaims | null;
  /** Dados completos do usuário logado (GET /users/{id}); traz facilityId. */
  me: UserResponse | undefined;
  isAuthenticated: boolean;
  login: (body: LoginRequest) => Promise<void>;
  logout: () => void;
  can: (role: Role) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const accessToken = useSyncExternalStore(tokenStore.subscribe, tokenStore.getAccess);
  const claims = useMemo(() => decodeAccess(accessToken), [accessToken]);

  const { data: me } = useQuery({
    queryKey: ["me", claims?.sub],
    queryFn: () => usersService.get(claims!.sub),
    enabled: !!claims?.sub,
    staleTime: 5 * 60_000,
  });

  // Se o token sumir (logout, refresh falhou) limpa todo o cache.
  useEffect(() => {
    if (!accessToken) queryClient.clear();
  }, [accessToken, queryClient]);

  const login = useCallback(async (body: LoginRequest) => {
    const tokens = await authService.login(body);
    tokenStore.set(tokens);
  }, []);

  const logout = useCallback(() => tokenStore.clear(), []);

  const can = useCallback((role: Role) => hasRole(claims?.role, role), [claims?.role]);

  const value = useMemo<AuthContextValue>(
    () => ({ claims, me, isAuthenticated: !!claims, login, logout, can }),
    [claims, me, login, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
