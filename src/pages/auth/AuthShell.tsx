import { ClipboardList } from "lucide-react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between border-r border-white/[0.06] bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600">
            <ClipboardList className="size-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">estik</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight">
            Chamados, inventário e estoque das suas unidades em um só lugar.
          </h2>
          <p className="mt-4 max-w-md text-slate-400">
            Abra e acompanhe chamados, controle a movimentação de computadores e mantenha o estoque em dia.
          </p>
        </div>
        <p className="text-sm text-slate-500">estik · v1</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
