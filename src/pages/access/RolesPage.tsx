import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApiMutation } from "@/hooks/useApiMutation";
import { prettyRole, useRoles } from "@/hooks/useRoles";
import { accessService } from "@/services/access";
import { PERMISSION_GROUPS, impliedBy, permissionLabel } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, PageLoader } from "@/components/ui";
import type { Permission, RoleResponse } from "@/types/api";

/**
 * Perfis (roles) e as permissões de cada um.
 * - criar perfil: POST /access/roles { name } (o backend grava em MAIÚSCULAS)
 * - marcar permissão: POST /access/permissions { roleId, permission }
 * - desmarcar: DELETE /access/permissions/{id da linha}
 * Mudanças valem no próximo login/refresh de quem tem o perfil (vêm no token).
 */
export function RolesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { roles, isLoading, error } = useRoles();
  const [name, setName] = useState("");

  const create = useApiMutation({
    mutationFn: () => accessService.createRole(name.trim()),
    invalidate: [["access", "roles"]],
    success: (r) => `Perfil ${prettyRole(r.name)} criado`,
    onSuccess: (r) => {
      setName("");
      navigate(`/roles/${r.id}`);
    },
  });

  const selected = roles.find((r) => r.id === id);

  return (
    <>
      <PageHeader title="Perfis" description="Cada perfil é um conjunto de permissões. O usuário recebe um perfil na tela dele." />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card className="self-start">
          <CardHeader title="Perfis" />
          <form
            className="flex gap-2 border-b border-slate-800 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate();
            }}
          >
            <Input className="flex-1" placeholder="Novo perfil" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do novo perfil" />
            <Button type="submit" icon={<Plus className="size-4" />} disabled={!name.trim()} loading={create.isPending} aria-label="Criar perfil" />
          </form>
          {error ? (
            <div className="p-4"><ErrorState error={error} /></div>
          ) : isLoading ? (
            <div className="flex justify-center p-6"><Loader2 className="size-5 animate-spin text-slate-500" /></div>
          ) : roles.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhum perfil ainda.</p>
          ) : (
            <ul className="p-2">
              {roles.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/roles/${r.id}`)}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                      r.id === id ? "bg-brand-500/15 text-brand-300" : "text-slate-300 hover:bg-slate-800",
                    )}
                  >
                    <KeyRound className="size-4 shrink-0" />
                    <span className="truncate">{prettyRole(r.name)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected ? (
          <RoleEditor key={selected.id} role={selected} onDeleted={() => navigate("/roles")} />
        ) : id && !isLoading ? (
          <Card><EmptyState title="Perfil não encontrado" message="Ele pode ter sido apagado." /></Card>
        ) : (
          <Card>
            <EmptyState icon={<KeyRound className="size-5" />} title="Escolha um perfil" message="Selecione um perfil na lista para ver e mudar as permissões dele, ou crie um novo." />
          </Card>
        )}
      </div>
    </>
  );
}

function RoleEditor({ role, onDeleted }: { role: RoleResponse; onDeleted: () => void }) {
  const { claims } = useAuth();
  const isMine = claims?.role === role.id;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const key = ["access", "permissions", role.id];

  const { data: rows, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => accessService.permissions(role.id),
  });
  const byPermission = new Map((rows ?? []).map((r) => [r.permission, r]));
  const granted = [...byPermission.keys()];

  const toggle = useApiMutation({
    mutationFn: async (p: Permission) => {
      const row = byPermission.get(p);
      if (row) await accessService.removePermission(row.id);
      else await accessService.addPermission(role.id, p);
    },
    invalidate: [key],
  });

  const remove = useApiMutation({
    mutationFn: () => accessService.deleteRole(role.id),
    invalidate: [["access", "roles"]],
    success: "Perfil apagado",
    onSuccess: onDeleted,
  });

  return (
    <Card>
      <CardHeader
        title={prettyRole(role.name)}
        description={`Criado em ${formatDateTime(role.createdAt)}${isMine ? " · é o seu perfil" : ""}`}
        actions={
          <Button variant="secondary" size="sm" icon={<Trash2 className="size-4" />} disabled={isMine} onClick={() => setConfirmDelete(true)} title={isMine ? "Você não pode apagar o próprio perfil" : undefined}>
            Apagar
          </Button>
        }
      />
      {error ? (
        <div className="p-5"><ErrorState error={error} /></div>
      ) : isLoading ? (
        <PageLoader />
      ) : (
        <div className="divide-y divide-slate-800">
          {PERMISSION_GROUPS.map((g) => (
            <section key={g.title} className="px-5 py-4">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">{g.title}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.items.map((it) => {
                  const marked = byPermission.has(it.value);
                  // não marcada, mas incluída por outra (ex.: STOCK_READ por STOCK_MANAGE)
                  const via = marked ? undefined : impliedBy(it.value, granted);
                  const on = marked || !!via;
                  // não deixa o próprio perfil perder o acesso a esta tela
                  const lockSelf = isMine && marked && it.value === "ACCESS_MANAGE";
                  const saving = toggle.isPending && toggle.variables === it.value;
                  return (
                    <button
                      key={it.value}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={lockSelf || !!via || toggle.isPending}
                      onClick={() => toggle.mutate(it.value)}
                      title={lockSelf ? "Seu próprio perfil não pode perder esta permissão" : via ? `Já vem junto com ${permissionLabel[via]}` : undefined}
                      className={clsx(
                        "flex items-start gap-3 rounded-lg p-3 text-left ring-1 transition disabled:cursor-not-allowed",
                        on ? "bg-brand-500/10 ring-brand-500/40" : "bg-slate-800/40 ring-white/[0.06] hover:ring-white/15",
                        (lockSelf || via) && "opacity-70",
                      )}
                    >
                      <span
                        className={clsx(
                          "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded ring-1",
                          on ? "bg-brand-600 text-white ring-brand-500" : "ring-slate-600",
                        )}
                        aria-hidden
                      >
                        {saving ? <Loader2 className="size-3 animate-spin" /> : on && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-100">{it.label}</span>
                        <span className="block text-xs text-slate-500">{it.hint}</span>
                        {via && <span className="mt-1 block text-xs text-brand-300">Incluída por {permissionLabel[via]}</span>}
                        {it.note && <span className="mt-1 block text-xs text-amber-400/90">{it.note}</span>}
                        <code className="mt-1 block text-[10px] text-slate-600">{it.value}</code>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <p className="px-5 py-3 text-xs text-slate-500">
            As mudanças salvam na hora, mas só valem para cada pessoa no próximo login (as permissões vão dentro do token).
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Apagar o perfil ${prettyRole(role.name)}?`}
        message="Se algum usuário ainda tiver este perfil, o backend recusa. Troque o perfil dessas pessoas antes."
        confirmLabel="Apagar"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </Card>
  );
}
