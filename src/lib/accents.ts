/**
 * Cor de destaque de cada módulo. As classes ficam escritas por extenso
 * porque o Tailwind só gera o que aparece literalmente no código.
 */
export interface Accent {
  /** ícone/texto colorido */
  text: string;
  /** "chip" do ícone: fundo translúcido + ring */
  chip: string;
  /** linha fina de destaque (gradiente) */
  bar: string;
  /** fundo suave para cards de resumo */
  soft: string;
}

export const accents = {
  brand: { text: "text-brand-400", chip: "bg-brand-500/15 text-brand-300 ring-brand-500/30", bar: "from-brand-500", soft: "from-brand-500/[0.04]" },
  blue: { text: "text-sky-400", chip: "bg-sky-500/15 text-sky-300 ring-sky-500/30", bar: "from-sky-500", soft: "from-sky-500/[0.04]" },
  teal: { text: "text-teal-400", chip: "bg-teal-500/15 text-teal-300 ring-teal-500/30", bar: "from-teal-500", soft: "from-teal-500/[0.04]" },
  cyan: { text: "text-cyan-400", chip: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30", bar: "from-cyan-500", soft: "from-cyan-500/[0.04]" },
  emerald: { text: "text-emerald-400", chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30", bar: "from-emerald-500", soft: "from-emerald-500/[0.04]" },
  amber: { text: "text-amber-400", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30", bar: "from-amber-500", soft: "from-amber-500/[0.04]" },
  violet: { text: "text-violet-400", chip: "bg-violet-500/15 text-violet-300 ring-violet-500/30", bar: "from-violet-500", soft: "from-violet-500/[0.04]" },
  pink: { text: "text-pink-400", chip: "bg-pink-500/15 text-pink-300 ring-pink-500/30", bar: "from-pink-500", soft: "from-pink-500/[0.04]" },
  orange: { text: "text-orange-400", chip: "bg-orange-500/15 text-orange-300 ring-orange-500/30", bar: "from-orange-500", soft: "from-orange-500/[0.04]" },
} satisfies Record<string, Accent>;

export type AccentName = keyof typeof accents;

/** Módulo → cor, pelo começo da rota. A mais específica vence. */
const routeAccents: [string, AccentName][] = [
  ["/tickets", "blue"],
  ["/map", "teal"],
  ["/computers", "cyan"],
  ["/histories", "cyan"],
  ["/stock", "emerald"],
  ["/items", "amber"],
  ["/categories", "amber"],
  ["/facilities", "violet"],
  ["/departaments", "violet"],
  ["/users", "pink"],
  ["/notifications", "orange"],
];

export function accentFor(pathname: string): Accent {
  const hit = routeAccents.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"));
  return accents[hit?.[1] ?? "brand"];
}
