import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, FileText, X } from "lucide-react";
import clsx from "clsx";
import type { TicketStatus } from "@/types/api";

/* ---------- Avatar ---------- */

/** Cores sólidas e discretas; cada usuário cai sempre na mesma (hash do id). */
const AVATAR_COLORS = [
  "bg-sky-800 text-sky-100",
  "bg-emerald-800 text-emerald-100",
  "bg-amber-800 text-amber-100",
  "bg-rose-800 text-rose-100",
  "bg-violet-800 text-violet-100",
  "bg-teal-800 text-teal-100",
  "bg-fuchsia-800 text-fuchsia-100",
  "bg-orange-800 text-orange-100",
];
function colorFor(id?: string) {
  let h = 0;
  for (const c of id ?? "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ id, name, size = "sm" }: { id?: string; name?: string; size?: "xs" | "sm" }) {
  return (
    <span
      title={name}
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-semibold uppercase ring-2 ring-slate-900",
        size === "xs" ? "size-6 text-[10px]" : "size-8 text-xs",
        colorFor(id),
      )}
    >
      {(name ?? "?").slice(0, 2)}
    </span>
  );
}

/* ---------- Texto com links ---------- */

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Quebra de linha preservada e links http/https clicáveis. */
export function RichText({ text, mine }: { text: string; mine: boolean }) {
  const parts = text.split(URL_RE);
  return (
    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx("underline underline-offset-2", mine ? "text-white decoration-white/60" : "text-brand-300 decoration-brand-300/50")}
          >
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </p>
  );
}

/* ---------- Eventos do chamado no meio da conversa ---------- */

const eventText: Record<TicketStatus, string> = {
  OPEN: "Chamado aberto",
  FORWARDED: "Chamado encaminhado",
  PROGRESS: "Chamado assumido",
  RESOLVED: "Chamado resolvido",
  CANCELLED: "Chamado cancelado",
};
/** PROGRESS depois de RESOLVED é reabertura. */
export function eventLabel(status: TicketStatus, previous?: TicketStatus) {
  return status === "PROGRESS" && previous === "RESOLVED" ? "Chamado reaberto" : eventText[status];
}

export function SystemLine({ text, time, title }: { text: string; time: string; title: string }) {
  return (
    <div className="my-2 flex justify-center" title={title}>
      <span className="rounded-full bg-slate-800/70 px-3 py-1 text-[11px] text-slate-400">
        {text} · {time}
      </span>
    </div>
  );
}

/* ---------- Esqueleto ---------- */

export function ChatSkeleton() {
  const rows = [
    { mine: false, w: "w-48" },
    { mine: false, w: "w-64" },
    { mine: true, w: "w-40" },
    { mine: false, w: "w-56" },
    { mine: true, w: "w-52" },
  ];
  return (
    <div className="space-y-3 py-2" aria-hidden>
      {rows.map((r, i) => (
        <div key={i} className={clsx("flex items-end gap-2", r.mine && "flex-row-reverse")}>
          {!r.mine && <span className="size-8 animate-pulse rounded-full bg-slate-800" />}
          <span className={clsx("h-9 animate-pulse rounded-2xl bg-slate-800", r.w)} />
        </div>
      ))}
    </div>
  );
}

/** "relatorio-muito-grande-final.pdf" -> "relatorio-mu…final.pdf" (mantém a extensão visível). */
export function middleEllipsis(name: string, max = 28) {
  if (name.length <= max) return name;
  const keep = max - 1;
  const tail = Math.ceil(keep / 2);
  return `${name.slice(0, keep - tail)}…${name.slice(-tail)}`;
}

/* ---------- Arquivo escolhido antes de enviar ---------- */

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <li className="flex items-center gap-2 rounded-lg bg-slate-800 py-1.5 pl-1.5 pr-2 text-xs text-slate-200 ring-1 ring-slate-700">
      {url ? (
        <img src={url} alt="" className="size-8 rounded object-cover" />
      ) : (
        <span className="flex size-8 items-center justify-center rounded bg-rose-950 text-rose-300">
          <FileText className="size-4" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block max-w-36 truncate font-medium">{file.name}</span>
        <span className="text-slate-500">{formatSize(file.size)}</span>
      </span>
      <button type="button" onClick={onRemove} className="ml-1 rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-200" aria-label={`Remover ${file.name}`}>
        <X className="size-3.5" />
      </button>
    </li>
  );
}

/* ---------- Visualizador de imagens ---------- */

export interface GalleryImage {
  src: string;
  name?: string | null;
}

interface LightboxProps {
  images: GalleryImage[];
  index: number | null;
  onIndex: (i: number | null) => void;
  onError?: () => void;
}

/** Esc fecha, setas navegam entre as imagens da conversa. */
export function Lightbox({ images, index, onIndex, onError }: LightboxProps) {
  const open = index !== null && !!images[index];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onIndex(null);
      if (e.key === "ArrowLeft" && index! > 0) onIndex(index! - 1);
      if (e.key === "ArrowRight" && index! < images.length - 1) onIndex(index! + 1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, index, images.length, onIndex]);
  if (!open) return null;
  const { src, name } = images[index!];
  const nav = "absolute top-1/2 -translate-y-1/2 rounded-full bg-slate-800 p-2.5 text-slate-200 hover:bg-slate-700 disabled:opacity-30";

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Imagem anexada">
      <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-300">
        <span className="min-w-0 truncate">
          {name && <span className="mr-2 font-medium text-slate-100" title={name}>{name}</span>}
          <span className="text-slate-400">{index! + 1} de {images.length}</span>
        </span>
        <div className="flex items-center gap-1">
          <a href={src} target="_blank" rel="noreferrer" download={name ?? true} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-slate-800">
            <Download className="size-4" /> Baixar
          </a>
          <button type="button" onClick={() => onIndex(null)} className="rounded-md p-1.5 hover:bg-slate-800" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-8" onClick={() => onIndex(null)}>
        <img src={src} alt={name ?? "Anexo"} onError={onError} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-lg object-contain" />
        {images.length > 1 && (
          <>
            <button
              type="button"
              className={clsx(nav, "left-4")}
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation();
                onIndex(index! - 1);
              }}
              aria-label="Anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              className={clsx(nav, "right-4")}
              disabled={index === images.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                onIndex(index! + 1);
              }}
              aria-label="Próxima"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
