import clsx from "clsx";
import type { Tone } from "@/lib/labels";

const tones: Record<Tone, string> = {
  gray: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  blue: "bg-blue-500/10 text-blue-300 ring-blue-500/30",
  green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  red: "bg-red-500/10 text-red-300 ring-red-500/30",
  violet: "bg-violet-500/10 text-violet-300 ring-violet-500/30",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
