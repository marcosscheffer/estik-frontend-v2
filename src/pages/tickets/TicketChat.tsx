import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDown,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Lock,
  MessagesSquare,
  Paperclip,
  Reply,
  SendHorizontal,
  Upload,
  X,
} from "lucide-react";
import clsx from "clsx";
import {
  ACCEPTED_FILE_TYPES,
  MAX_CONTENT,
  chatsService,
  fileSrc,
  validateFiles,
} from "@/services/chats";
import { streamSse } from "@/lib/sse";
import { getErrorMessage, getStatus } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { Button, Card, ErrorState } from "@/components/ui";
import { Avatar, ChatSkeleton, FileChip, Lightbox, RichText, SystemLine, eventLabel, middleEllipsis, type GalleryImage } from "./ChatParts";
import type {
  ChatAttachmentResponse,
  ChatStreamPayload,
  MessageResponse,
  PageResult,
  TicketHistoryResponse,
  TicketResponse,
  UUID,
} from "@/types/api";

/** Máximo da API. A página vem sem ordenação, então o histórico é carregado inteiro. */
const PAGE_SIZE = 100;
/** As URLs dos anexos valem 1h: renova um pouco antes. */
const URL_REFRESH_MS = 50 * 60_000;
/** Mensagens do mesmo remetente com até 5 min de diferença ficam no mesmo grupo. */
const GROUP_GAP_MS = 5 * 60_000;

type Connection = "connecting" | "live" | "offline";
/** Bolinha do cabeçalho: amarelo conectando, verde ao vivo, cinza desconectado. */
const connection: Record<Connection, { dot: string; label: string }> = {
  connecting: { dot: "bg-amber-400 animate-pulse", label: "Conectando..." },
  live: { dot: "bg-emerald-500", label: "Ao vivo" },
  offline: { dot: "bg-slate-500", label: "Desconectado" },
};
type Messages = InfiniteData<PageResult<MessageResponse>, number>;

/** Mensagem que eu mandei e o servidor ainda não confirmou (ou falhou). */
interface Pending {
  tempId: string;
  content: string;
  replyTo: MessageResponse | null;
  files: File[];
  createdAt: string;
  state: "sending" | "failed";
  error?: string;
}

type Item =
  | { kind: "msg"; at: string; m: MessageResponse }
  | { kind: "pending"; at: string; p: Pending }
  | { kind: "event"; at: string; id: string; text: string };

const isImage = (a: ChatAttachmentResponse) => a.file.fileType.startsWith("image/");
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
function dayLabel(iso: string) {
  const d = new Date(iso).getTime();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d >= start) return "Hoje";
  if (d >= start - 86_400_000) return "Ontem";
  return formatDate(iso);
}

interface Props {
  ticket: TicketResponse;
  me: UUID;
  className?: string;
  /** ocupa a altura do container (lista rola por dentro, campo fica embaixo) */
  fill?: boolean;
  /** histórico do chamado (já carregado pela página) para mostrar os eventos na conversa */
  events?: TicketHistoryResponse[];
}

/**
 * Conversa do chamado (módulo /chats). Regras:
 * - o chat é criado quando o técnico assume (ticket.chatId fica preenchido);
 * - só solicitante e responsável participam (os outros levam 403);
 * - fica só leitura quando o chamado é resolvido ou cancelado.
 * GET /chats/{id} (participantes) hoje é só ADMINISTRATOR, por isso os
 * participantes saem do próprio chamado.
 */
export function TicketChat({ ticket, me, className, fill, events }: Props) {
  const qc = useQueryClient();
  const chatId = ticket.chatId ?? undefined;
  const key = useMemo(() => ["chats", chatId, "messages"], [chatId]);

  const participant = ticket.requester?.id === me || ticket.assignee?.id === me;
  const closed = ticket.status === "RESOLVED" || ticket.status === "CANCELLED";
  const canRead = !!chatId && participant;
  const canSend = canRead && !closed;
  const [conn, setConn] = useState<Connection>("connecting");
  // erro definitivo no stream: não reconecta e mostra um aviso no card
  const [streamError, setStreamError] = useState<string | null>(null);

  const messages = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => chatsService.messages(chatId!, { page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled: canRead,
    // URLs assinadas dos anexos expiram em 1h
    refetchInterval: URL_REFRESH_MS,
  });

  // Sem ordenação no backend não dá para saber qual página é a "mais antiga":
  // busca todas e ordena aqui.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = messages;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ordem cronológica, sem duplicadas (o remetente recebe a própria mensagem pelo SSE também)
  const list = useMemo(() => {
    const byId = new Map<string, MessageResponse>();
    for (const p of messages.data?.pages ?? []) for (const m of p.items) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [messages.data]);
  const byId = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);

  // coloca uma mensagem nova na última página (sem duplicar)
  const addMessage = (m: MessageResponse) =>
    qc.setQueryData<Messages>(key, (old) => {
      if (!old) return old;
      if (old.pages.some((p) => p.items.some((i) => i.id === m.id))) return old;
      const pages = [...old.pages];
      const last = pages[pages.length - 1];
      pages[pages.length - 1] = { ...last, items: [...last.items, m], totalItems: last.totalItems + 1 };
      return { ...old, pages };
    });
  const addRef = useRef(addMessage);
  addRef.current = addMessage;
  const meRef = useRef(me);
  meRef.current = me;

  // tempo real: GET /chats/{id}/stream manda o evento "message"
  useEffect(() => {
    // só solicitante e responsável (comparado com o sub do token) abrem o stream
    if (!canRead || closed || !chatId) return;
    setStreamError(null);
    const ctrl = new AbortController();
    streamSse(`/chats/${chatId}/stream`, {
      signal: ctrl.signal,
      // 403/404/409 já param (4xx); 500/502 também: o backend falha ao responder o erro no SSE
      fatalStatuses: [500, 502],
      onConnecting: () => setConn("connecting"),
      onDisconnect: () => setConn("offline"),
      onOpen: () => {
        setConn("live");
        // pega o que chegou enquanto estava desconectado
        qc.invalidateQueries({ queryKey: ["chats", chatId, "messages"] });
      },
      onFatal: (status) => {
        setConn("offline");
        setStreamError(
          status === 403 ? "Você não participa deste chat." : "Não foi possível conectar ao chat em tempo real.",
        );
      },
      onEvent: ({ event, data }) => {
        if (event !== "message") return;
        try {
          const { chatId: _chat, ...m } = JSON.parse(data) as ChatStreamPayload;
          addRef.current(m);
          // minha própria mensagem pelo SSE: vale como confirmação do envio otimista
          if (m.sender?.userId?.id === meRef.current) confirmRef.current(m);
        } catch {
          /* evento malformado: ignora */
        }
      },
    }).finally(() => {
      if (!ctrl.signal.aborted) setConn("offline");
    });
    return () => ctrl.abort();
  }, [canRead, closed, chatId, qc]);

  // URL de anexo vencida (o backend devolve 502): busca de novo para ganhar URLs novas.
  const lastUrlRefresh = useRef(0);
  const onAttachmentError = () => {
    if (Date.now() - lastUrlRefresh.current < 30_000) return;
    lastUrlRefresh.current = Date.now();
    qc.invalidateQueries({ queryKey: key });
  };

  /* ---------- envio otimista ---------- */

  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessageResponse | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // tira a pendente equivalente (mesmo texto e nº de anexos) que ainda está "enviando"
  const confirmFromStream = (m: MessageResponse) =>
    setPending((all) => {
      const i = all.findIndex(
        (x) => x.state === "sending" && x.content === m.content && x.files.length === (m.attachments?.length ?? 0),
      );
      return i < 0 ? all : all.filter((_, j) => j !== i);
    });
  const confirmRef = useRef(confirmFromStream);
  confirmRef.current = confirmFromStream;

  const deliver = async (p: Pending) => {
    setPending((all) => all.map((x) => (x.tempId === p.tempId ? { ...x, state: "sending", error: undefined } : x)));
    try {
      const m = await chatsService.send(chatId!, { content: p.content, replyToId: p.replyTo?.id }, p.files);
      stick.current = true;
      addRef.current(m);
      setPending((all) => all.filter((x) => x.tempId !== p.tempId));
    } catch (e) {
      setPending((all) =>
        all.map((x) => (x.tempId === p.tempId ? { ...x, state: "failed", error: getErrorMessage(e, "Não foi possível enviar.") } : x)),
      );
    }
  };

  const content = draft.trim();
  const tooLong = content.length > MAX_CONTENT;
  const submit = () => {
    if (!content || tooLong) return;
    const p: Pending = {
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      content,
      replyTo,
      files,
      createdAt: new Date().toISOString(),
      state: "sending",
    };
    stick.current = true;
    setPending((all) => [...all, p]);
    setDraft("");
    setFiles([]);
    setFileError(null);
    setReplyTo(null);
    deliver(p);
  };

  const addFiles = (picked: FileList | File[] | null) => {
    if (!picked?.length) return;
    const next = [...files, ...Array.from(picked)];
    const problem = validateFiles(next);
    setFileError(problem);
    if (!problem) setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const startReply = (m: MessageResponse) => {
    setReplyTo(m);
    input.current?.focus();
  };
  const copy = (text: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast.success("Texto copiado"),
      () => toast.error("Não foi possível copiar"),
    );

  // campo cresce com o texto (1 a 6 linhas)
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 148)}px`;
  }, [draft]);

  /* ---------- linha do tempo: mensagens + eventos do chamado ---------- */

  const items = useMemo<Item[]>(() => {
    const out: Item[] = list.map((m) => ({ kind: "msg", at: m.createdAt, m }));
    for (const p of pending) out.push({ kind: "pending", at: p.createdAt, p });
    // eventos só a partir da primeira mensagem (antes disso o chat nem existia)
    const sortedEvents = [...(events ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const from = list[0]?.createdAt;
    sortedEvents.forEach((h, i) => {
      if (!from || h.createdAt < from) return;
      out.push({ kind: "event", at: h.createdAt, id: h.id, text: eventLabel(h.status, sortedEvents[i - 1]?.status) });
    });
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }, [list, pending, events]);

  // só as mensagens que chegam depois da primeira carga ganham animação
  const baseline = useRef<Set<string> | null>(null);
  if (baseline.current === null && !messages.isLoading && messages.data) baseline.current = new Set(list.map((m) => m.id));
  const isNew = (id: string) => !!baseline.current && !baseline.current.has(id);

  // imagens da conversa, na ordem, para o visualizador navegar entre elas
  const gallery = useMemo<GalleryImage[]>(
    () => list.flatMap((m) => (m.attachments ?? []).filter(isImage).map((a) => ({ src: fileSrc(a.file.fileUrl), name: a.file.fileName }))),
    [list],
  );
  const [viewer, setViewer] = useState<number | null>(null);

  /* ---------- rolagem ---------- */

  // Rola para o fim quando chega mensagem, se já estava perto do fim.
  // Se a pessoa subiu para ler, mostra "Novas mensagens".
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [unseen, setUnseen] = useState(false);
  const lastKey = items.length ? (items[items.length - 1].kind === "msg" ? (items[items.length - 1] as { m: MessageResponse }).m.id : items.length) : 0;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !lastKey) return;
    if (stick.current) el.scrollTop = el.scrollHeight;
    else setUnseen(true);
  }, [lastKey]);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stick.current) setUnseen(false);
  };
  const toBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setUnseen(false);
  };
  const jumpTo = (id: UUID) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-amber-400");
    setTimeout(() => el.classList.remove("ring-2", "ring-amber-400"), 1400);
  };

  const forbidden = getStatus(messages.error) === 403;
  const nameOf = (m?: MessageResponse) => (m?.sender?.userId?.id === me ? "Você" : m?.sender?.userId?.username ?? "—");
  const people = [ticket.requester, ticket.assignee].filter((p): p is NonNullable<typeof p> => !!p);

  const empty = (icon: React.ReactNode, title: string, text?: string) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">{icon}</span>
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {text && <p className="max-w-xs text-xs text-slate-500">{text}</p>}
    </div>
  );

  /** Autor de cada item para agrupar (eventos quebram o grupo). */
  const authorOf = (it?: Item) => (it?.kind === "msg" ? it.m.sender?.userId?.id : it?.kind === "pending" ? me : undefined);

  const renderBubble = (it: Item, i: number) => {
    if (it.kind === "event") return null;
    const prev = items[i - 1];
    const next = items[i + 1];
    const author = authorOf(it);
    const mine = author === me;
    const joinsPrev = !!prev && authorOf(prev) === author && sameDay(prev.at, it.at) && Date.parse(it.at) - Date.parse(prev.at) < GROUP_GAP_MS;
    const joinsNext = !!next && authorOf(next) === author && sameDay(it.at, next.at) && Date.parse(next.at) - Date.parse(it.at) < GROUP_GAP_MS;

    const m = it.kind === "msg" ? it.m : undefined;
    const p = it.kind === "pending" ? it.p : undefined;
    const text = m?.content ?? p!.content;
    const reply = m?.replyTo ?? (p?.replyTo ? { id: p.replyTo.id, content: p.replyTo.content } : null);
    const original = reply ? byId.get(reply.id) : undefined;
    const attachments = m?.attachments ?? [];
    const images = attachments.filter(isImage);
    const docs = attachments.filter((a) => !isImage(a));
    const domId = m ? `msg-${m.id}` : p!.tempId;

    return (
      <div
        className={clsx(
          "group flex items-end gap-2",
          mine && "flex-row-reverse",
          joinsPrev ? "mt-1" : "mt-4",
          ((m && isNew(m.id)) || p) && "animate-msg-in",
        )}
      >
        {!mine && (joinsNext ? <span className="w-8 shrink-0" /> : <Avatar id={author} name={m?.sender?.userId?.username} />)}

        <div className={clsx("flex min-w-0 max-w-[75%] flex-col", mine ? "items-end" : "items-start")}>
          {!joinsPrev && !mine && <span className="mb-1 px-1 text-xs font-medium text-slate-400">{nameOf(m)}</span>}
          <div className={clsx("relative flex items-center gap-1", mine && "flex-row-reverse")}>
            <div
              id={domId}
              title={formatDateTime(it.at)}
              className={clsx(
                "min-w-0 rounded-2xl px-3.5 py-2 text-sm leading-6 transition-shadow",
                mine ? "bg-brand-600 text-white" : "bg-slate-800 text-slate-100",
                // "rabinho": canto menor do lado de quem mandou na última bolha do grupo
                mine ? (joinsNext ? "rounded-br-md" : "rounded-br-sm") : joinsNext ? "rounded-bl-md" : "rounded-bl-sm",
                mine ? joinsPrev && "rounded-tr-md" : joinsPrev && "rounded-tl-md",
                p?.state === "sending" && "opacity-70",
                p?.state === "failed" && "bg-red-950 text-red-100 ring-1 ring-red-800",
              )}
            >
              {reply && (
                <button
                  type="button"
                  onClick={() => jumpTo(reply.id)}
                  className={clsx(
                    "mb-2 block w-full rounded-lg border-l-[3px] px-2.5 py-1.5 text-left text-xs",
                    mine ? "border-white/70 bg-brand-700 text-white/90" : "border-brand-400 bg-slate-900 text-slate-300",
                  )}
                  title="Ir para a mensagem original"
                >
                  <span className={clsx("block font-semibold", mine ? "text-white" : "text-brand-300")}>{original ? nameOf(original) : "Mensagem"}</span>
                  <span className="line-clamp-2 break-words">{reply.content}</span>
                </button>
              )}
              {images.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {images.map((a) => {
                    const src = fileSrc(a.file.fileUrl);
                    return (
                      <button key={a.id} type="button" onClick={() => setViewer(gallery.findIndex((g) => g.src === src))} aria-label={a.file.fileName ? `Ver ${a.file.fileName}` : "Ver imagem"} className="overflow-hidden rounded-xl">
                        <img
                          src={src}
                          alt={a.file.fileName ?? "Anexo"}
                          title={a.file.fileName ?? undefined}
                          loading="lazy"
                          onError={onAttachmentError}
                          className="max-h-60 max-w-60 bg-slate-900 object-cover transition hover:opacity-90"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
              {docs.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {docs.map((a) => (
                    <a
                      key={a.id}
                      href={fileSrc(a.file.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      title={a.file.fileName ?? "Documento PDF"}
                      className={clsx(
                        "flex w-60 max-w-full items-center gap-3 rounded-xl p-2.5 transition",
                        mine ? "bg-brand-700 hover:bg-indigo-800" : "bg-slate-900 hover:bg-slate-950",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-950 text-rose-300">
                        <FileText className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.file.fileName ? middleEllipsis(a.file.fileName) : "Documento PDF"}</span>
                        <span className={clsx("text-xs", mine ? "text-white/70" : "text-slate-500")}>Clique para abrir</span>
                      </span>
                      <ExternalLink className="size-4 shrink-0 opacity-70" />
                    </a>
                  ))}
                </div>
              )}
              {p && p.files.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {p.files.map((f, k) => (
                    <li key={k} className="flex items-center gap-1.5 text-xs opacity-80" title={f.name}>
                      {f.type === "application/pdf" ? <FileText className="size-3.5 shrink-0" /> : <Paperclip className="size-3.5 shrink-0" />}
                      {middleEllipsis(f.name)}
                    </li>
                  ))}
                </ul>
              )}
              <RichText text={text} mine={mine && p?.state !== "failed"} />
            </div>

            {/* ações ao passar o mouse */}
            {m && (
              <div
                className={clsx(
                  "flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-900 p-0.5 opacity-0 ring-1 ring-slate-800 transition group-hover:opacity-100 focus-within:opacity-100",
                )}
              >
                {canSend && (
                  <button type="button" onClick={() => startReply(m)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="Responder" title="Responder">
                    <Reply className="size-3.5" />
                  </button>
                )}
                <button type="button" onClick={() => copy(m.content)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="Copiar texto" title="Copiar texto">
                  <Copy className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          {p?.state === "failed" ? (
            <span className="mt-1 flex items-center gap-2 px-1 text-[11px] text-red-400">
              <AlertCircle className="size-3.5" /> Falhou
              <button type="button" onClick={() => deliver(p)} className="font-medium underline-offset-2 hover:underline">
                Tentar de novo
              </button>
              ·
              <button type="button" onClick={() => setPending((all) => all.filter((x) => x.tempId !== p.tempId))} className="font-medium underline-offset-2 hover:underline">
                Descartar
              </button>
            </span>
          ) : p ? (
            !joinsNext && (
              <span className="mt-1 inline-flex items-center gap-1 px-1 text-[11px] text-slate-500">
                <Clock className="size-3" /> Enviando...
              </span>
            )
          ) : (
            !joinsNext && (
              <span className="mt-1 inline-flex items-center gap-1 px-1 text-[11px] text-slate-500" title={formatDateTime(it.at)}>
                {mine && <Check className="size-3" />}
                {timeOf(it.at)}
              </span>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className={clsx("relative flex flex-col overflow-hidden", fill && "min-h-0", className)}>
      {/* cabeçalho: título, participantes e estado */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="text-base font-semibold text-slate-100">Conversa</h2>
          {chatId && people.length > 0 && (
            <div className="flex -space-x-1.5" aria-label={`Participantes: ${people.map((p) => p.username).join(", ")}`}>
              {people.map((p) => (
                <Avatar key={p.id} id={p.id} name={p.username} size="xs" />
              ))}
            </div>
          )}
        </div>
        {canSend && !streamError ? (
          <span role="status" className="inline-flex items-center gap-2 text-xs text-slate-400">
            <span className={clsx("size-2 rounded-full", connection[conn].dot)} aria-hidden />
            {connection[conn].label}
          </span>
        ) : canRead && closed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">
            <Lock className="size-3" /> Somente leitura
          </span>
        ) : null}
      </div>

      {streamError && canRead && !forbidden && (
        <p role="status" className="mx-4 mt-3 rounded-md bg-amber-950 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-800">
          {streamError} As mensagens novas aparecem ao recarregar a página.
        </p>
      )}

      {!chatId ? (
        empty(<MessagesSquare className="size-5" />, "A conversa ainda não começou", "O chat abre quando um técnico assumir o chamado.")
      ) : !participant || forbidden ? (
        empty(<Lock className="size-5" />, "Conversa privada", "Só o solicitante e o responsável participam desta conversa.")
      ) : messages.error ? (
        <div className="p-4">
          <ErrorState error={messages.error} />
        </div>
      ) : (
        <div
          ref={scroller}
          onScroll={onScroll}
          className={clsx("flex flex-col overflow-y-auto px-4 pb-4 pt-2", fill ? "min-h-0 flex-1" : "max-h-[32rem] min-h-64")}
        >
          {messages.isLoading ? (
            <ChatSkeleton />
          ) : items.length === 0 ? (
            empty(<MessagesSquare className="size-5" />, "Nenhuma mensagem ainda.", "Comece a conversa.")
          ) : (
            items.map((it, i) => (
              <Fragment key={it.kind === "msg" ? it.m.id : it.kind === "pending" ? it.p.tempId : `ev-${it.id}`}>
                {(i === 0 || !sameDay(items[i - 1].at, it.at)) && (
                  <div className="my-4 flex items-center gap-3 text-[11px] font-medium text-slate-500" role="separator">
                    <span className="h-px flex-1 bg-slate-800" />
                    {dayLabel(it.at)}
                    <span className="h-px flex-1 bg-slate-800" />
                  </div>
                )}
                {it.kind === "event" ? <SystemLine text={it.text} time={timeOf(it.at)} title={formatDateTime(it.at)} /> : renderBubble(it, i)}
              </Fragment>
            ))
          )}
        </div>
      )}

      {unseen && (
        <button
          type="button"
          onClick={toBottom}
          className="absolute bottom-28 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-brand-500"
        >
          Novas mensagens <ArrowDown className="size-3.5" />
        </button>
      )}

      {canSend && !forbidden ? (
        <form
          className="relative border-t border-slate-800 bg-slate-900 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-1 z-10 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-500 bg-slate-900 text-sm font-medium text-brand-300">
              <Upload className="size-4" /> Solte os arquivos para anexar
            </div>
          )}
          {replyTo && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border-l-[3px] border-brand-500 bg-slate-800 px-3 py-2 text-xs">
              <Reply className="mt-0.5 size-3.5 shrink-0 text-brand-400" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-200">Respondendo {replyTo.sender?.userId?.id === me ? "a você" : replyTo.sender?.userId?.username}</p>
                <p className="line-clamp-1 break-words text-slate-400">{replyTo.content}</p>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} className="rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-200" aria-label="Cancelar resposta (Esc)" title="Cancelar (Esc)">
                <X className="size-4" />
              </button>
            </div>
          )}
          {files.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <FileChip
                  key={`${f.name}-${i}`}
                  file={f}
                  onRemove={() => {
                    setFiles(files.filter((_, j) => j !== i));
                    setFileError(null);
                  }}
                />
              ))}
            </ul>
          )}
          <div
            className={clsx(
              "flex items-end gap-1 rounded-xl bg-slate-950 p-1.5 ring-1 ring-inset transition-shadow focus-within:ring-2",
              tooLong ? "ring-red-500" : "ring-slate-700 focus-within:ring-brand-500",
            )}
          >
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              aria-label="Anexar arquivo"
              title="Anexar (PNG, JPG, WEBP, PDF até 10 MB)"
            >
              <Paperclip className="size-4" />
            </button>
            <textarea
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter envia, Shift+Enter quebra linha
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape" && replyTo) setReplyTo(null);
              }}
              onPaste={(e) => {
                if (e.clipboardData.files.length) {
                  e.preventDefault();
                  addFiles(e.clipboardData.files);
                }
              }}
              rows={1}
              placeholder={files.length ? "Escreva uma mensagem para os anexos..." : "Escreva uma mensagem..."}
              aria-label="Mensagem"
              aria-invalid={tooLong}
              className="max-h-[148px] min-h-9 flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:ring-0"
            />
            <Button type="submit" icon={<SendHorizontal className="size-4" />} disabled={!content || tooLong} aria-label="Enviar" title="Enviar (Enter)" />
          </div>
          {fileError && (
            <p role="alert" className="mt-1.5 flex items-center gap-1.5 px-1 text-xs text-red-400">
              <AlertCircle className="size-3.5 shrink-0" /> {fileError}
            </p>
          )}
          <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-500">
            <span>
              <kbd className="font-sans font-medium text-slate-400">Enter</kbd> envia ·{" "}
              <kbd className="font-sans font-medium text-slate-400">Shift + Enter</kbd> quebra linha
            </span>
            {(tooLong || draft.length > MAX_CONTENT - 200) && (
              <span className={tooLong ? "font-medium text-red-400" : undefined}>
                {content.length}/{MAX_CONTENT}
              </span>
            )}
          </div>
        </form>
      ) : (
        canRead &&
        !forbidden && (
          <p className="flex items-center justify-center gap-2 border-t border-slate-800 px-5 py-3 text-xs text-slate-500">
            <Lock className="size-3.5" />
            Chamado encerrado: a conversa fica só para leitura.
          </p>
        )
      )}

      <Lightbox images={gallery} index={viewer} onIndex={setViewer} onError={onAttachmentError} />
    </Card>
  );
}
