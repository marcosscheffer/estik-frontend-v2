import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useFilters } from "@/hooks/useFilters";
import { useViewMode } from "@/hooks/useViewMode";
import { usersService } from "@/services/users";
import { prettyRole, useRoles } from "@/hooks/useRoles";
import { Badge, Card, CardGrid, ErrorState, PageHeader, Pagination, SearchInput, Table, ViewToggle } from "@/components/ui";
import { FacilitySelect } from "@/components/LookupSelects";
import { UserCard } from "./UserCard";
import type { UserFilters } from "@/services/users";
import type { UserResponseSummary } from "@/types/api";

export function UsersPage() {
  const navigate = useNavigate();
  const { filters, page, setFilter, setPage } = useFilters({ username: "", facilityId: "" });
  const { nameOf, enabled: showRoles } = useRoles();
  const [view, setView] = useViewMode("users");

  const query = { ...(filters as UserFilters), page, size: 20 };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["users", "list", query],
    queryFn: () => usersService.list(query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Ative contas novas, defina perfis e unidades."
        actions={<ViewToggle value={view} onChange={setView} />}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <div className="w-full min-w-56 flex-1">
            <SearchInput value={filters.username} onChange={(v) => setFilter("username", v)} placeholder="Buscar por usuário" />
          </div>
          <FacilitySelect className="w-full sm:w-52" placeholder="Todas as unidades" value={filters.facilityId} onChange={(e) => setFilter("facilityId", e.target.value)} />
        </div>
        {error ? <div className="p-4"><ErrorState error={error} /></div> : view === "grid" ? (
          <CardGrid
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(u) => u.id}
            renderCard={(u) => <UserCard user={u} />}
          />
        ) : (
          <Table
            rows={data?.items}
            loading={isLoading || isFetching}
            rowKey={(u) => u.id}
            onRowClick={(u) => navigate(`/users/${u.id}`)}
            columns={[
              { header: "Usuário", cell: (u) => <span className="font-medium text-slate-100">{u.username}</span> },
              { header: "E-mail", cell: (u) => u.email || "—" },
              ...(showRoles ? [{ header: "Perfil", cell: (u: UserResponseSummary) => <Badge tone="violet">{prettyRole(nameOf(u.role))}</Badge> }] : []),
              { header: "Situação", cell: (u) => <Badge tone={u.active ? "green" : "amber"}>{u.active ? "Ativo" : "Inativo"}</Badge> },
            ]}
          />
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} totalItems={data.totalItems} onChange={setPage} />}
      </Card>
    </>
  );
}
