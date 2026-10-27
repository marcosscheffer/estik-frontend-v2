import { useEffect, useState } from "react";
import { matchPath, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  Boxes,
  Building2,
  ChevronDown,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Monitor,
  Network,
  Package,
  Repeat,
  ShieldCheck,
  Tags,
  Ticket,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { access } from "@/lib/roles";
import { roleLabel } from "@/lib/labels";
import { accentFor } from "@/lib/accents";
import type { Role } from "@/types/api";
import { NotificationBell } from "./NotificationBell";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  role: Role;
}

interface NavGroup {
  title: string;
  /** Sem ícone = grupo fixo (sempre aberto, sem dropdown). */
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    title: "Início",
    items: [{ to: "/", label: "Início", icon: LayoutDashboard, role: "USER" }],
  },
  {
    title: "Atendimento",
    icon: Ticket,
    items: [{ to: "/tickets", label: "Chamados", icon: Ticket, role: access.tickets }],
  },
  {
    title: "Inventário",
    icon: Monitor,
    items: [
      { to: "/map", label: "Mapa", icon: MapIcon, role: access.computers },
      { to: "/computers", label: "Computadores", icon: Monitor, role: access.computers },
      { to: "/histories", label: "Histórico", icon: History, role: access.histories },
    ],
  },
  {
    title: "Estoque",
    icon: Boxes,
    items: [
      { to: "/stock/balances", label: "Saldos", icon: Boxes, role: access.stock },
      { to: "/stock/movements", label: "Movimentações", icon: Repeat, role: access.stock },
      { to: "/items", label: "Itens", icon: Package, role: access.catalog },
      { to: "/categories", label: "Categorias", icon: Tags, role: access.catalog },
    ],
  },
  {
    title: "Administração",
    icon: ShieldCheck,
    items: [
      { to: "/facilities", label: "Unidades", icon: Building2, role: access.facilities },
      { to: "/departaments", label: "Departamentos", icon: Network, role: access.departaments },
      { to: "/users", label: "Usuários", icon: Users, role: access.users },
    ],
  },
];

const OPEN_GROUPS_KEY = "estik.sidebar.open";

/** Grupos abertos na barra lateral, lembrados entre visitas. */
function useOpenGroups() {
  const [open, setOpen] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) ?? "null");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const update = (fn: (prev: string[]) => string[]) =>
    setOpen((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      try {
        localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
      } catch {
        // sem localStorage: só não lembra
      }
      return next;
    });
  const toggle = (title: string) =>
    update((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]));
  const ensureOpen = (title: string) => update((prev) => (prev.includes(title) ? prev : [...prev, title]));
  return { open, toggle, ensureOpen };
}

const isActiveItem = (item: NavItem, pathname: string) =>
  !!matchPath({ path: item.to, end: item.to === "/" }, pathname);

function NavItems({ items, onNavigate, nested }: { items: NavItem[]; onNavigate?: () => void; nested?: boolean }) {
  return (
    <ul className={clsx("space-y-0.5", nested && "ml-5 border-l border-white/10 pl-2")}>
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-500/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* barrinha de destaque à esquerda do item ativo */}
                {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-400" aria-hidden />}
                <item.icon className={clsx("size-4.5", accentFor(item.to).text, !isActive && "opacity-80")} />
                {item.label}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  const { pathname } = useLocation();
  const { open, toggle, ensureOpen } = useOpenGroups();

  // ao entrar numa página, abre o grupo dela (dá para fechar depois)
  const activeGroup = groups.find((g) => g.icon && g.items.some((i) => isActiveItem(i, pathname)))?.title;
  useEffect(() => {
    if (activeGroup) ensureOpen(activeGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]);

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-5">
      <div className="mb-5 flex items-center gap-2 px-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <ClipboardList className="size-4.5" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-white">estik</span>
      </div>
      {groups.map((g) => {
        const visible = g.items.filter((i) => can(i.role));
        if (!visible.length) return null;

        // sem ícone (Início) ou com um item só para este papel: link direto, sem dropdown
        if (!g.icon || visible.length === 1) {
          return <NavItems key={g.title} items={visible} onNavigate={onNavigate} />;
        }

        const hasActive = visible.some((i) => isActiveItem(i, pathname));
        const isOpen = open.includes(g.title);
        const GroupIcon = g.icon;
        const panelId = `nav-${g.title}`;

        return (
          <div key={g.title}>
            <button
              type="button"
              onClick={() => toggle(g.title)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className={clsx(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5",
                hasActive ? "text-white" : "text-slate-400 hover:text-slate-200",
              )}
            >
              <GroupIcon className={clsx("size-4.5", accentFor(visible[0].to).text, !hasActive && "opacity-80")} />
              <span className="flex-1 text-left">{g.title}</span>
              {hasActive && !isOpen && <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />}
              <ChevronDown className={clsx("size-4 text-slate-500 transition-transform duration-200", isOpen && "rotate-180")} />
            </button>
            {/* grid-rows anima a altura sem precisar medir o conteúdo */}
            <div
              id={panelId}
              className={clsx(
                "grid transition-[grid-template-rows] duration-200",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden" inert={!isOpen}>
                <div className="pt-0.5 pb-1">
                  <NavItems items={visible} onNavigate={onNavigate} nested />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function AppLayout() {
  const { claims, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-white/[0.06] bg-slate-900 lg:block">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-white/[0.06] bg-slate-900">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 text-slate-400 hover:text-white"
            >
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-slate-900/70 px-4 backdrop-blur sm:px-6">
          {/* linha fina com o gradiente da marca na base do topo */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-brand-500/30 via-violet-500/15 to-transparent" aria-hidden />
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
          <NavLink
            to="/profile"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-800"
          >
            <UserCircle className="size-6 text-slate-400" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block font-medium text-slate-200">{claims?.username}</span>
              <span className="block text-xs text-slate-500">{claims && roleLabel[claims.role]}</span>
            </span>
          </NavLink>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="size-5" />
          </button>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
