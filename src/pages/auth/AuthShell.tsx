import { Boxes, ClipboardList, Monitor, Ticket } from "lucide-react";

const features = [
  { icon: Ticket, title: "Chamados", text: "Abra, encaminhe e acompanhe com chat em tempo real." },
  { icon: Monitor, title: "Inventário", text: "Computadores por unidade e departamento, com histórico." },
  { icon: Boxes, title: "Estoque", text: "Saldos, entradas, saídas e alerta de estoque mínimo." },
];

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
          <ul className="mt-10 max-w-md space-y-5">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-brand-300 ring-1 ring-slate-700">
                  <Icon className="size-[18px]" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-slate-100">{title}</span>
                  <span className="block text-sm text-slate-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-slate-500">estik · v1</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* no celular o painel da esquerda some: mostra a marca aqui */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <ClipboardList className="size-5" />
            </span>
            <span className="text-xl font-semibold tracking-tight text-slate-100">estik</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
