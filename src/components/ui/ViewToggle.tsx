import clsx from "clsx";
import { LayoutGrid, List } from "lucide-react";
import type { ViewMode } from "@/hooks/useViewMode";

const options = [
  { value: "grid", label: "Cards", icon: LayoutGrid },
  { value: "list", label: "Lista", icon: List },
] as const;

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex h-10 items-center gap-0.5 rounded-lg bg-slate-900 p-1 ring-1 ring-inset ring-slate-800">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={clsx(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            value === v ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-200",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
