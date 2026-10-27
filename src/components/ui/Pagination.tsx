import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, totalItems, onChange }: PaginationProps) {
  if (totalItems === 0) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-sm text-slate-400">
      <span>
        {totalItems.toLocaleString("pt-BR")} {totalItems === 1 ? "registro" : "registros"}
      </span>
      <div className="flex items-center gap-2">
        <span>
          Página {page + 1} de {Math.max(totalPages, 1)}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
          icon={<ChevronLeft className="size-4" />}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={page + 1 >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Próxima página"
          icon={<ChevronRight className="size-4" />}
        />
      </div>
    </div>
  );
}
