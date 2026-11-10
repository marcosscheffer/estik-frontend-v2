import { useNavigate } from "react-router-dom";
import { prettyRole, useRoles } from "@/hooks/useRoles";
import { Badge, Tile } from "@/components/ui";
import type { UserResponseSummary } from "@/types/api";

/** Card de usuário usado na lista de usuários e no detalhe da unidade. */
export function UserCard({ user: u }: { user: UserResponseSummary }) {
  const navigate = useNavigate();
  const { nameOf, enabled } = useRoles();
  return (
    <Tile onClick={() => navigate(`/users/${u.id}`)}>
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-lg font-semibold uppercase text-brand-400">
          {u.username.charAt(0)}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-medium text-slate-100">{u.username}</h3>
          <p className="truncate text-sm text-slate-400">{u.email || "Sem e-mail"}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5">
        {enabled && <Badge tone="violet">{prettyRole(nameOf(u.role))}</Badge>}
        <Badge tone={u.active ? "green" : "amber"}>{u.active ? "Ativo" : "Inativo"}</Badge>
      </div>
    </Tile>
  );
}
