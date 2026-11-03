import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types/api";

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function RoleRoute({ role }: { role: Role }) {
  const { can } = useAuth();
  if (!can(role)) return <Forbidden />;
  return <Outlet />;
}

export function Forbidden() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <ShieldAlert className="size-10 text-slate-600" />
      <h1 className="text-lg font-semibold text-slate-100">Acesso restrito</h1>
      <p className="max-w-sm text-sm text-slate-500">
        Seu papel não tem permissão para ver esta área. Peça a um administrador para ajustar seu acesso.
      </p>
    </div>
  );
}
