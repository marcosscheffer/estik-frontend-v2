import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Lock, MessageSquare, SendHorizontal } from "lucide-react";
import clsx from "clsx";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ticketsService } from "@/services/tickets";
import { streamSse } from "@/lib/sse";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Button, Card, CardHeader, EmptyState, ErrorState } from "@/components/ui";
import type {
  PageResult,
  TicketMessageResponse,
  TicketMessageStreamPayload,
  TicketResponse,
  TicketUserResponse,
  UUID,
} from "@/types/api";

const PAGE_SIZE = 30;

type Connection = "connecting" | "live" | "offline";
/** Bolinha do cabeçalho: amarelo conectando, verde ao vivo, cinza desconectado. */
const connection: Record<Connection, { dot: string; label: string }> = {
  connecting: { dot: "bg-amber-400 animate-pulse", label: "Conectando..." },
  live: { dot: "bg-emerald-500", label: "Ao vivo" },
  offline: { dot: "bg-slate-500", label: "Desconectado" },
};
type Messages = InfiniteData<PageResult<TicketMessageResponse>, number>;

interface Props {
  ticket: TicketResponse;
  me: UUID;
  className?: string;
}

/**
 * Chat do chamado. Regras do Ticket no backend:
 * - só solicitante e responsável (assignee) conversam;
 * - o chat abre quando alguém assume e fica só leitura quando resolve/cancela;
 * - o SSE /messages/stream só aceita quem pode enviar.
 * Regulador/admin veem o histórico em modo leitura (o GET não restringe).
 */
export function TicketChat({ ticket, me, className }: Props) {
  const qc = useQueryClient();
  const key = useMemo(() => ["tickets", "messages", ticket.id], [ticket.id]);

  const participant = ticket.requester?.id === me || ticket.assignee?.id === me;
  const closed = ticket.status === "RESOLVED" || ticket.status === "CANCELLED";
  const canSend = participant && !!ticket.assignee && !closed;
  const [conn, setConn] = useState<Connection>("connecting");

  const messages = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => ticketsService.messages(ticket.id, { page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled: !!ticket.assignee,
  });

  // a API devolve do mais novo para o mais antigo; na tela é o contrário
  const list = useMemo(() => {
    const seen = new Set<string>();
    const all = (messages.data?.pages ?? []).flatMap((p) => p.items).filter((m) => !seen.has(m.id) && !!seen.add(m.id));
    return all.reverse();
  }, [messages.data]);

  // coloca uma mensagem nova no topo da primeira página (sem duplicar)
  const addMessage = (m: TicketMessageResponse) =>
    qc.setQueryData<Messages>(key, (old) => {
      if (!old) return old;
      if (old.pages.some((p) => p.items.some((i) => i.id === m.id))) return old;
      const [first, ...rest] = old.pages;
      return { ...old, pages: [{ ...first, items: [m, ...first.items], totalItems: first.totalItems + 1 }, ...rest] };
    });

  // tempo real: o payload do SSE só traz authorId, o nome vem dos participantes
  useEffect(() => {
    if (!canSend) return;
    const people: Record<string, TicketUserResponse> = {};
    for (const u of [ticket.requester, ticket.assignee]) if (u) people[u.id] = u;

    const ctrl = new AbortController();
    streamSse(`/tickets/${ticket.id}/messages/stream`, {
      signal: ctrl.signal,
      onConnecting: () => setConn("connecting"),
      onDisconnect: () => setConn("offline"),
      onOpen: () => {
        setConn("live");
        // pega o que chegou enquanto estava desconectado
        qc.invalidateQueries({ queryKey: key });
      },
      onFatal: () => setConn("offline"),
      onEvent: ({ event, data }) => {
        if (event !== "ticket_message") return;
        try {
          const p = JSON.parse(data) as TicketMessageStreamPayload;
          addMessage({
            id: p.id,
            body: p.body,
            createdAt: p.createdAt,
            author: people[p.authorId] ?? { id: p.authorId, username: "—" },
          });
        } catch {
          /* evento malformado: ignora */
        }
      },
    }).finally(() => {
      if (!ctrl.signal.aborted) setConn("offline");
    });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSend, ticket.id, ticket.requester?.id, ticket.assignee?.id]);

  const [draft, setDraft] = useState("");
  const send = useApiMutation({
    mutationFn: (body: string) => ticketsService.sendMessage(ticket.id, body),
    onSuccess: (m) => {
      addMessage(m);
      setDraft("");
    },
  });
  const submit = () => {
    const body = draft.trim();
    if (body && !send.isPending) send.mutate(body);
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

  // carregar antigas sem pular a posição de leitura
  const loadOlder = async () => {
    const el = scroller.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    stick.current = false;
    await messages.fetchNextPage();
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  };

  const description = !ticket.assignee
    ? "Abre quando alguém assumir o chamado."
    : closed
      ? "Chamado encerrado: conversa só para leitura."
      : !participant
        ? "Só solicitante e responsável conversam aqui."
        : undefined; // estado da conexão fica ao lado da bolinha

  return (
    <Card className={clsx("flex flex-col", className)}>
      <CardHeader
        title="Conversa"
        description={description}
        actions={
          canSend ? (
            <span role="status" className="mt-0.5 inline-flex items-center gap-2 text-xs text-slate-400">
              <span className={clsx("size-2.5 rounded-full", connection[conn].dot)} aria-hidden />
              {connection[conn].label}
            </span>
          ) : undefined
        }
      />

      {!ticket.assignee ? (
        <EmptyState message="Ninguém assumiu este chamado ainda. A conversa começa quando o técnico assumir." />
      ) : messages.error ? (
        <div className="p-4">
          <ErrorState error={messages.error} />
        </div>
      ) : (
        <div ref={scroller} onScroll={onScroll} className="max-h-[28rem] min-h-48 space-y-3 overflow-y-auto px-5 py-4">
          {messages.hasNextPage && (
            <div className="text-center">
              <Button variant="ghost" loading={messages.isFetchingNextPage} onClick={loadOlder}>
                Carregar mensagens anteriores
              </Button>
            </div>
          )}
          {messages.isLoading && <p className="text-center text-sm text-slate-500">Carregando...</p>}
          {!messages.isLoading && list.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-500">
              <MessageSquare className="size-6" />
              Nenhuma mensagem ainda.
            </div>
          )}
          {list.map((m) => {
            const mine = m.author?.id === me;
            return (
              <div key={m.id} className={clsx("flex flex-col", mine ? "items-end" : "items-start")}>
                <div
                  className={clsx(
                    "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
                    mine ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-slate-800 text-slate-100",
                  )}
                >
                  {m.body}
                </div>
                <span className="mt-1 px-1 text-[11px] text-slate-500" title={formatDateTime(m.createdAt)}>
                  {mine ? "Você" : m.author?.username} · {formatRelative(m.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {canSend ? (
        <form
          className="flex items-end gap-2 border-t border-slate-800 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia, Shift+Enter quebra linha
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Escreva uma mensagem..."
            aria-label="Mensagem"
            className="max-h-32 min-h-10 flex-1 resize-y rounded-lg border-0 bg-slate-900 px-3 py-2 text-sm text-slate-100 ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-brand-600"
          />
          <Button type="submit" icon={<SendHorizontal className="size-4" />} disabled={!draft.trim()} loading={send.isPending} aria-label="Enviar" />
        </form>
      ) : (
        ticket.assignee && (
          <p className="flex items-center gap-2 border-t border-slate-800 px-5 py-3 text-xs text-slate-500">
            <Lock className="size-3.5" />
            {closed ? "Conversa encerrada." : "Você pode ler, mas não enviar mensagens."}
          </p>
        )
      )}
    </Card>
  );
}
