import clsx from "clsx";

interface TabsProps<K extends string> {
  tabs: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}

/** Abas em "pílula", usadas em Chamados e no detalhe do departamento. */
export function Tabs<K extends string>({ tabs, value, onChange, className }: TabsProps<K>) {
  return (
    <div className={clsx("mb-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-900 p-1 text-sm ring-1 ring-inset ring-slate-800 sm:inline-flex", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={clsx(
            "flex-1 whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors",
            value === t.key ? "bg-slate-800 text-slate-100 shadow-sm shadow-black/20" : "text-slate-400 hover:text-slate-100",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={clsx(
                "ml-1.5 rounded-full px-1.5 py-px text-[11px] tabular-nums",
                value === t.key ? "bg-slate-700 text-slate-200" : "bg-slate-800 text-slate-500",
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
