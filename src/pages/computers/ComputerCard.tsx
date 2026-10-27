import { useNavigate } from "react-router-dom";
import { Clock, Monitor } from "lucide-react";
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
          <h3 className="truncate font-medium text-slate-100">{c.name}</h3>
          <p className="truncate text-sm text-slate-400">
            {c.facility?.name ?? "—"} · {c.departament?.name ?? "—"}
          </p>
        </div>
      </div>
      <p className="mt-auto inline-flex items-center gap-1 text-xs text-slate-500">
        <Clock className="size-3.5" /> Atualizado {formatRelative(c.updatedAt)}
      </p>
    </Tile>
  );
}
