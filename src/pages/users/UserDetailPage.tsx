import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Power, PowerOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApiMutation } from "@/hooks/useApiMutation";
import { usersService } from "@/services/users";
import { facilitiesService } from "@/services/facilities";
import { formatDateTime } from "@/lib/format";
import { access } from "@/lib/permissions";
import { prettyRole, useRoles } from "@/hooks/useRoles";
import { Badge, Button, Card, CardHeader, DetailList, ErrorState, Modal, PageHeader, PageLoader, Select } from "@/components/ui";
import { FacilitySelect, SpecializationSelect } from "@/components/LookupSelects";

export function UserDetailPage() {
  const { id = "" } = useParams();
  const { claims, can } = useAuth();
  const isSelf = claims?.sub === id;
  // unidade e ativação: USER_MANAGE (/users/**)
  const isAdmin = can(access.manageUsers);
  // trocar o perfil (POST /users/{id}/assign) e listar perfis (/access/roles): SYSTEM_MANAGE
  const canAssign = can(access.assignRole);
  const { roles } = useRoles();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["users", "detail", id],
    queryFn: () => usersService.get(id),
  });
  const facility = useQuery({
    queryKey: ["facilities", "detail", user?.facilityId],
    queryFn: () => facilitiesService.get(user!.facilityId!),
    enabled: !!user?.facilityId,
  });

  const [role, setRole] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  // ativar conta sem unidade pede a unidade antes (o cadastro não pede mais)
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateFacility, setActivateFacility] = useState("");
  useEffect(() => {
    if (user) {
      setRole(user.role?.id ?? "");
      setFacilityId(user.facilityId ?? "");
      setSpecializationId(user.specialization?.id ?? "");
    }
  }, [user]);

  const invalidate = [["users"], ["me"]];
  const toggle = useApiMutation({
    mutationFn: () => (user!.active ? usersService.deactivate(id) : usersService.activate(id)),
    invalidate,
    success: (u) => (u.active ? "Usuário ativado" : "Usuário desativado"),
  });
  const activateWithFacility = useApiMutation({
    mutationFn: async () => {
      await usersService.changeFacility(id, activateFacility);
      return usersService.activate(id);
    },
    invalidate: [...invalidate, ["facilities"]],
    success: "Conta ativada e unidade definida",
    onSuccess: () => setActivateOpen(false),
  });
  // o que mudou em relação ao que veio do backend (cada campo tem seu endpoint)
  const roleChanged = canAssign && !isSelf && !!role && role !== (user?.role?.id ?? "");
  const facilityChanged = isAdmin && !!facilityId && facilityId !== (user?.facilityId ?? "");
  const areaChanged = isAdmin && specializationId !== (user?.specialization?.id ?? "");
  const dirty = roleChanged || facilityChanged || areaChanged;

  /** Um botão só: chama, em sequência, só os endpoints dos campos alterados. */
  const save = useApiMutation({
    mutationFn: async () => {
      if (roleChanged) await usersService.assign(id, role);
      if (facilityChanged) await usersService.changeFacility(id, facilityId);
      if (areaChanged) await usersService.changeSpecialization(id, specializationId || null);
    },
    invalidate: [...invalidate, ["facilities"]],
    success: () =>
      roleChanged || areaChanged
        ? "Alterações salvas. Perfil e área valem a partir do próximo login da pessoa."
        : "Alterações salvas",
  });
  const discard = () => {
    setRole(user?.role?.id ?? "");
    setFacilityId(user?.facilityId ?? "");
    setSpecializationId(user?.specialization?.id ?? "");
  };

  if (isLoading) return <PageLoader />;
  if (error || !user) return <ErrorState error={error} />;

  return (
    <>
      <PageHeader
        back="/users"
        title={user.username}
        description={user.email}
        actions={
          isAdmin && !isSelf && (
            <Button
              variant={user.active ? "secondary" : "primary"}
              icon={user.active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
              loading={toggle.isPending}
              onClick={() => {
                if (!user.active && !user.facilityId) {
                  setActivateFacility("");
                  setActivateOpen(true);
                } else toggle.mutate();
              }}
            >
              {user.active ? "Desativar" : "Ativar conta"}
            </Button>
          )
        }
      />

      {!user.active && (
        <div className="mb-6 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300 ring-1 ring-amber-500/30">
          Esta conta está inativa e não consegue fazer login até ser ativada.
          {!user.facilityId && " Ela ainda não tem unidade: você vai escolher uma ao ativar."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Dados" />
          <DetailList
            items={[
              { label: "Usuário", value: user.username },
              { label: "E-mail", value: user.email || "—" },
              { label: "Perfil", value: <Badge tone="violet">{prettyRole(user.role?.name)}</Badge> },
              { label: "Área", value: user.specialization ? <Badge>{user.specialization.name}</Badge> : <Badge tone="gray">Sem área</Badge> },
              { label: "Situação", value: <Badge tone={user.active ? "green" : "amber"}>{user.active ? "Ativo" : "Inativo"}</Badge> },
              { label: "Unidade", value: !user.facilityId ? <Badge tone="amber">Sem unidade</Badge> : facility.data ? `${facility.data.name} (${facility.data.code})` : "—" },
              { label: "Criado em", value: formatDateTime(user.createdAt) },
            ]}
          />
        </Card>

        {(isAdmin || canAssign) && (
          <Card>
            <CardHeader title="Administração" />
            {/* um card só com os três campos e um único Salvar no fim */}
            <div className="space-y-4 px-5 py-4">
              {canAssign ? (
                <div className="space-y-1">
                  <Select
                    label="Perfil"
                    options={roles.map((r) => ({ value: r.id, label: prettyRole(r.name) }))}
                    value={role}
                    disabled={isSelf}
                    onChange={(e) => setRole(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    {isSelf ? "Você não pode mudar o próprio perfil." : "Define o que a pessoa pode fazer (permissões em Sistema > Perfis)."}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Para trocar o perfil você precisa da permissão "Sistema (perfis e áreas)".</p>
              )}
              {isAdmin && (
                <div className="space-y-1">
                  <FacilitySelect label="Unidade" value={facilityId} onChange={(e) => setFacilityId(e.target.value)} />
                  {!user.facilityId && <p className="text-xs text-amber-300">Esta conta ainda não tem unidade.</p>}
                </div>
              )}
              {isAdmin && (
                <div className="space-y-1">
                  <SpecializationSelect
                    label="Área"
                    placeholder="Sem área"
                    value={specializationId}
                    onChange={(e) => setSpecializationId(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Define quais chamados a pessoa vê como supervisor e em quais encaminhamentos ela aparece.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
              <Button variant="secondary" disabled={!dirty || save.isPending} onClick={discard}>
                Descartar
              </Button>
              <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
                Salvar alterações
              </Button>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        title="Ativar conta"
        description={`Escolha a unidade de ${user.username} antes de ativar.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActivateOpen(false)}>Cancelar</Button>
            <Button
              icon={<Power className="size-4" />}
              disabled={!activateFacility}
              loading={activateWithFacility.isPending}
              onClick={() => activateWithFacility.mutate()}
            >
              Ativar
            </Button>
          </>
        }
      >
        <FacilitySelect label="Unidade" value={activateFacility} onChange={(e) => setActivateFacility(e.target.value)} />
      </Modal>
    </>
  );
}
