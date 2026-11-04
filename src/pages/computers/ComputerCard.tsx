import { useNavigate } from "react-router-dom";
import { Building2, Clock, Monitor, Network } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { Tile, TileIcon } from "@/components/ui";
import type { ComputerSummaryResponse } from "@/types/api";

/** Card de computador usado na lista e no detalhe do departamento. */
export function ComputerCard({ computer: c }: { computer: ComputerSummaryResponse }) {
  const navigate = useNavigate();
  return (
    <Tile onClick={() => navigate(`/computers/${c.id}`)}>
      <div className="flex items-start gap-3">
        <TileIcon icon={Monitor} />
        <div className="min-w-0">
          <h3 className="truncate font-medium text-slate-100" title={c.name}>{c.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-400">
            <Building2 className="size-3.5 shrink-0 text-slate-500" /> {c.facility?.name ?? "—"}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-400">
            <Network className="size-3.5 shrink-0 text-slate-500" /> {c.departament?.name ?? "—"}
          </p>
        </div>
      </div>
      <p className="mt-auto inline-flex items-center gap-1 text-xs text-slate-500">
        <Clock className="size-3.5" /> Atualizado {formatRelative(c.updatedAt)}
      </p>
    </Tile>
  );
}
