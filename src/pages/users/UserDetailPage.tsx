import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Power, PowerOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApiMutation } from "@/hooks/useApiMutation";
import { usersService } from "@/services/users";
import { facilitiesService } from "@/services/facilities";
import { formatDateTime } from "@/lib/format";
import { roleLabel, toOptions } from "@/lib/labels";
import { Badge, Button, Card, CardHeader, DetailList, ErrorState, Modal, PageHeader, PageLoader, Select } from "@/components/ui";
import { FacilitySelect } from "@/components/LookupSelects";
import type { Role } from "@/types/api";

export function UserDetailPage() {
  const { id = "" } = useParams();
  const { claims } = useAuth();
  const isSelf = claims?.sub === id;

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["users", "detail", id],
    queryFn: () => usersService.get(id),
  });
  const facility = useQuery({
    queryKey: ["facilities", "detail", user?.facilityId],
    queryFn: () => facilitiesService.get(user!.facilityId!),
    enabled: !!user?.facilityId,
  });

  const [role, setRole] = useState<Role>("USER");
  const [facilityId, setFacilityId] = useState("");
  // ativar conta sem unidade pede a unidade antes (o cadastro não pede mais)
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateFacility, setActivateFacility] = useState("");
  useEffect(() => {
    if (user) {
      setRole(user.role);
      setFacilityId(user.facilityId ?? "");
    }
  }, [user]);

  const invalidate = [["users"], ["me"]];
  const toggle = useApiMutation({
    mutationFn: () => (user!.active ? usersService.deactivate(id) : usersService.activate(id)),
    invalidate,
    success: (u) => (u.active ? "Usuário ativado" : "Usuário desativado"),
  });
  const assign = useApiMutation({
    mutationFn: () => usersService.assign(id, role),
    invalidate,
    success: "Papel atualizado",
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
  const move = useApiMutation({
    mutationFn: () => usersService.changeFacility(id, facilityId),
    invalidate: [...invalidate, ["facilities"]],
    success: "Unidade atualizada",
  });

  if (isLoading) return <PageLoader />;
  if (error || !user) return <ErrorState error={error} />;

  return (
    <>
      <PageHeader
        back="/users"
        title={user.username}
        description={user.email}
        actions={
          !isSelf && (
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
              { label: "Papel", value: roleLabel[user.role] },
              { label: "Situação", value: <Badge tone={user.active ? "green" : "amber"}>{user.active ? "Ativo" : "Inativo"}</Badge> },
              { label: "Unidade", value: !user.facilityId ? <Badge tone="amber">Sem unidade</Badge> : facility.data ? `${facility.data.name} (${facility.data.code})` : "—" },
              { label: "Criado em", value: formatDateTime(user.createdAt) },
            ]}
          />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Papel" description={isSelf ? "Você não pode mudar o próprio papel." : "IT > Arquitetura > Usuário"} />
            <div className="flex gap-2 p-5">
              <Select className="flex-1" options={toOptions(roleLabel)} value={role} disabled={isSelf} onChange={(e) => setRole(e.target.value as Role)} />
              <Button disabled={isSelf || role === user.role} loading={assign.isPending} onClick={() => assign.mutate()}>Salvar</Button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Unidade" />
            <div className="flex gap-2 p-5">
              <FacilitySelect className="flex-1" value={facilityId} onChange={(e) => setFacilityId(e.target.value)} />
              <Button disabled={!facilityId || facilityId === user.facilityId} loading={move.isPending} onClick={() => move.mutate()}>Salvar</Button>
            </div>
          </Card>
        </div>
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
