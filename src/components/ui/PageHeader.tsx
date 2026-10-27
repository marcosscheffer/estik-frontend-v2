import { Link, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import clsx from "clsx";
import { accentFor } from "@/lib/accents";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: string;
}

export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  const { pathname } = useLocation();
  const accent = accentFor(pathname);
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {/* traço com a cor do módulo acima do título */}
        {!back && <span className={clsx("mb-3 block h-1 w-10 rounded-full bg-gradient-to-r to-transparent", accent.bar)} aria-hidden />}
        {back && (
          <Link
            to={back}
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-200"
          >
            <ChevronLeft className="size-4" /> Voltar
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
