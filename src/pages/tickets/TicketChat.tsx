import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FileText, Lock, MessageSquare, Paperclip, Reply, SendHorizontal, X } from "lucide-react";
import clsx from "clsx";
import { useApiMutation } from "@/hooks/useApiMutation";
import {
  ACCEPTED_FILE_TYPES,
  MAX_CONTENT,
  chatsService,
  fileSrc,
  validateFiles,
} from "@/services/chats";
import { streamSse } from "@/lib/sse";
import { getStatus } from "@/lib/errors";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Button, Card, CardHeader, EmptyState, ErrorState, Modal } from "@/components/ui";
import type {
  ChatAttachmentResponse,
  ChatStreamPayload,
  MessageResponse,
  PageResult,
  TicketResponse,
  UUID,
} from "@/types/api";

/** Máximo da API. A página vem sem ordenação, então o histórico é carregado inteiro. */
const PAGE_SIZE = 100;
/** As URLs dos anexos valem 1h: renova um pouco antes. */
const URL_REFRESH_MS = 50 * 60_000;

type Connection = "connecting" | "live" | "offline";
/** Bolinha do cabeçalho: amarelo conectando, verde ao vivo, cinza desconectado. */
const connection: Record<Connection, { dot: string; label: string }> = {
  connecting: { dot: "bg-amber-400 animate-pulse", label: "Conectando..." },
  live: { dot: "bg-emerald-500", label: "Ao vivo" },
  offline: { dot: "bg-slate-500", label: "Desconectado" },
};
type Messages = InfiniteData<PageResult<MessageResponse>, number>;

const isImage = (a: ChatAttachmentResponse) => a.file.fileType.startsWith("image/");
const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

interface Props {
  ticket: TicketResponse;
  me: UUID;
  className?: string;
}

/**
 * Conversa do chamado (módulo /chats). Regras:
 * - o chat é criado quando o técnico assume (ticket.chatId fica preenchido);
 * - só solicitante e responsável participam (os outros levam 403);
 * - fica só leitura quando o chamado é resolvido ou cancelado.
 * GET /chats/{id} (participantes) hoje é só ADMINISTRATOR, por isso os
 * participantes saem do próprio chamado.
 */
export function TicketChat({ ticket, me, className }: Props) {
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

  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<MessageResponse | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const send = useApiMutation({
    mutationFn: (vars: { content: string; replyToId?: UUID; files: File[] }) =>
      chatsService.send(chatId!, { content: vars.content, replyToId: vars.replyToId }, vars.files),
    onSuccess: (m) => {
      addMessage(m);
      setDraft("");
      setFiles([]);
      setReplyTo(null);
      stick.current = true;
    },
  });

  const content = draft.trim();
  const tooLong = content.length > MAX_CONTENT;
  const submit = () => {
    if (!content || tooLong || send.isPending) return;
    send.mutate({ content, replyToId: replyTo?.id, files });
  };

  const addFiles = (picked: FileList | null) => {
    if (!picked?.length) return;
    const next = [...files, ...Array.from(picked)];
    const problem = validateFiles(next);
    if (problem) toast.error(problem);
    else setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const startReply = (m: MessageResponse) => {
    setReplyTo(m);
    input.current?.focus();
  };

  // rola para o fim quando chega mensagem, se já estava perto do fim
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastId = list[list.length - 1]?.id;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);
  const onScroll = () => {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  const jumpTo = (id: UUID) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-brand-500");
    setTimeout(() => el.classList.remove("ring-2", "ring-brand-500"), 1200);
  };

  const forbidden = getStatus(messages.error) === 403;
  const description = !chatId
    ? "O chat abre quando um técnico assumir o chamado."
    : !participant
      ? "Só solicitante e responsável participam da conversa."
      : closed
        ? "Chamado encerrado: conversa só para leitura."
        : undefined; // estado da conexão fica ao lado da bolinha

  return (
    <Card className={clsx("flex flex-col", className)}>
      <CardHeader
        title="Conversa"
        description={description}
        actions={
          canSend && !streamError ? (
            <span role="status" className="mt-0.5 inline-flex items-center gap-2 text-xs text-slate-400">
              <span className={clsx("size-2.5 rounded-full", connection[conn].dot)} aria-hidden />
              {connection[conn].label}
            </span>
          ) : undefined
        }
      />

      {streamError && canRead && !forbidden && (
        <p role="status" className="mx-5 mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/30">
          {streamError} As mensagens novas aparecem ao recarregar a página.
        </p>
      )}
      {!chatId ? (
        <EmptyState message="O chat abre quando um técnico assumir o chamado." />
      ) : !participant || forbidden ? (
        <EmptyState message="Você não participa desta conversa. Só o solicitante e o responsável têm acesso." />
      ) : messages.error ? (
        <div className="p-4">
          <ErrorState error={messages.error} />
        </div>
      ) : (
        <div ref={scroller} onScroll={onScroll} className="max-h-[32rem] min-h-48 space-y-3 overflow-y-auto px-5 py-4">
          {(messages.isLoading || isFetchingNextPage) && <p className="text-center text-sm text-slate-500">Carregando...</p>}
          {!messages.isLoading && list.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-500">
              <MessageSquare className="size-6" />
              Nenhuma mensagem ainda.
            </div>
          )}
          {list.map((m) => {
            const mine = m.sender?.userId?.id === me;
            const attachments = m.attachments ?? [];
            const images = attachments.filter(isImage);
            const docs = attachments.filter((a) => !isImage(a));
            return (
              <div key={m.id} className={clsx("group flex flex-col", mine ? "items-end" : "items-start")}>
                <div className={clsx("flex max-w-[85%] items-end gap-1", mine && "flex-row-reverse")}>
                  <div
                    id={`msg-${m.id}`}
                    className={clsx(
                      "min-w-0 rounded-2xl px-3.5 py-2 text-sm transition-shadow",
                      mine ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-slate-800 text-slate-100",
                    )}
                  >
                    {m.replyTo && (
                      <button
                        type="button"
                        onClick={() => jumpTo(m.replyTo!.id)}
                        className={clsx(
                          "mb-1.5 block w-full rounded-md border-l-2 px-2 py-1 text-left text-xs",
                          mine ? "border-white/60 bg-black/15 text-white/85" : "border-brand-500 bg-slate-900/60 text-slate-300",
                        )}
                      >
                        <span className="line-clamp-2 break-words">{m.replyTo.content}</span>
                      </button>
                    )}
                    {images.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap gap-1.5">
                        {images.map((a) => (
                          <button key={a.id} type="button" onClick={() => setPreview(fileSrc(a.file.fileUrl))} aria-label="Ver imagem">
                            <img
                              src={fileSrc(a.file.fileUrl)}
                              alt="Anexo"
                              loading="lazy"
                              onError={onAttachmentError}
                              className="size-28 rounded-lg bg-slate-900 object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    {docs.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap gap-1.5">
                        {docs.map((a) => (
                          <a
                            key={a.id}
                            href={fileSrc(a.file.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className={clsx(
                              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                              mine ? "bg-black/15 text-white hover:bg-black/25" : "bg-slate-900 text-slate-200 hover:bg-slate-950",
                            )}
                          >
                            <FileText className="size-3.5" /> PDF <ExternalLink className="size-3" />
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                  {canSend && (
                    <button
                      type="button"
                      onClick={() => startReply(m)}
                      className="shrink-0 rounded-md p-1 text-slate-500 opacity-0 transition hover:bg-slate-800 hover:text-slate-200 focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label="Responder"
                      title="Responder"
                    >
                      <Reply className="size-4" />
                    </button>
                  )}
                </div>
                <span className="mt-1 px-1 text-[11px] text-slate-500" title={formatDateTime(m.createdAt)}>
                  {mine ? "Você" : m.sender?.userId?.username ?? "—"} · {formatRelative(m.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {canSend && !forbidden ? (
        <form
          className="border-t border-slate-800 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {replyTo && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-brand-500 bg-slate-800/60 px-3 py-2 text-xs">
              <Reply className="mt-0.5 size-3.5 shrink-0 text-brand-400" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-300">
                  Respondendo {replyTo.sender?.userId?.id === me ? "a você" : replyTo.sender?.userId?.username}
                </p>
                <p className="line-clamp-2 break-words text-slate-400">{replyTo.content}</p>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-slate-200" aria-label="Cancelar resposta">
                <X className="size-4" />
              </button>
            </div>
          )}
          {files.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">
                  {f.type === "application/pdf" ? <FileText className="size-3.5" /> : <Paperclip className="size-3.5" />}
                  <span className="max-w-40 truncate">{f.name}</span>
                  <span className="text-slate-500">{formatSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="text-slate-500 hover:text-slate-200"
                    aria-label={`Remover ${f.name}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="ghost"
              icon={<Paperclip className="size-4" />}
              onClick={() => fileInput.current?.click()}
              aria-label="Anexar arquivo"
              title="Anexar (PNG, JPEG, WEBP ou PDF; até 10 MB cada, 30 MB no total)"
            />
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
              rows={1}
              placeholder={files.length ? "Escreva uma mensagem para os anexos..." : "Escreva uma mensagem..."}
              aria-label="Mensagem"
              aria-invalid={tooLong}
              className={clsx(
                "max-h-32 min-h-10 flex-1 resize-y rounded-lg border-0 bg-slate-900 px-3 py-2 text-sm text-slate-100 ring-1 ring-inset placeholder:text-slate-500 focus:ring-2 focus:ring-inset",
                tooLong ? "ring-red-500 focus:ring-red-500" : "ring-slate-700 focus:ring-brand-600",
              )}
            />
            <Button type="submit" icon={<SendHorizontal className="size-4" />} disabled={!content || tooLong} loading={send.isPending} aria-label="Enviar" />
          </div>
          {(tooLong || draft.length > MAX_CONTENT - 200) && (
            <p className={clsx("mt-1 text-right text-[11px]", tooLong ? "text-red-400" : "text-slate-500")}>
              {draft.trim().length}/{MAX_CONTENT}
            </p>
          )}
        </form>
      ) : (
        chatId &&
        participant &&
        !forbidden && (
          <p className="flex items-center gap-2 border-t border-slate-800 px-5 py-3 text-xs text-slate-500">
            <Lock className="size-3.5" />
            Conversa encerrada.
          </p>
        )
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Anexo" size="lg">
        {preview && (
          <div className="space-y-3">
            <img src={preview} alt="Anexo" onError={onAttachmentError} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
            <a
              href={preview}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-400 hover:text-brand-300"
            >
              <ExternalLink className="size-4" /> Abrir em nova aba
            </a>
          </div>
        )}
      </Modal>
    </Card>
  );
}
