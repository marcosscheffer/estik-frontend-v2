import { apiBaseURL, refreshAccessToken } from "./api";
import { isExpiringSoon, tokenStore } from "./tokens";

export interface SseEvent {
  event: string;
  data: string;
}

interface Options {
  onEvent: (e: SseEvent) => void;
  /** Chamado quando a conexão abre (inclusive depois de reconectar). */
  onOpen?: () => void;
  /** Antes de cada tentativa de conexão (a primeira e as reconexões). */
  onConnecting?: () => void;
  /** A conexão caiu; vai esperar e tentar de novo. */
  onDisconnect?: () => void;
  /** Erro definitivo (4xx que não é token): para de tentar. */
  onFatal?: (status: number) => void;
  signal: AbortSignal;
}

/**
 * Lê um endpoint SSE com fetch. O EventSource do navegador não deixa mandar
 * o header Authorization, e o JwtAuthenticationFilter só lê o token de lá.
 * Reconecta sozinho (backoff até 15s) enquanto o signal não for abortado.
 */
export async function streamSse(path: string, { onEvent, onOpen, onConnecting, onDisconnect, onFatal, signal }: Options) {
  let delay = 1000;
  let refreshed = false;

  while (!signal.aborted) {
    onConnecting?.();
    try {
      let token = tokenStore.getAccess();
      if (token && isExpiringSoon(token) && tokenStore.getRefresh()) token = await refreshAccessToken();

      const res = await fetch(`${apiBaseURL}${path}`, {
        headers: { Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal,
      });

      // 401/403 com token vencido: tenta um refresh e reconecta na hora
      if ((res.status === 401 || res.status === 403) && !refreshed && tokenStore.getRefresh() && isExpiringSoon(token, 0)) {
        refreshed = true;
        await refreshAccessToken();
        continue;
      }
      if (res.status >= 400 && res.status < 500) {
        onFatal?.(res.status);
        return;
      }
      if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);

      onOpen?.();
      delay = 1000;
      refreshed = false;
      await readEvents(res.body, onEvent);
    } catch {
      if (signal.aborted) return;
    }
    // caiu (servidor reiniciou, rede, etc.): espera e tenta de novo
    onDisconnect?.();
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 15_000);
  }
}

async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (e: SseEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");
    // eventos são separados por linha em branco
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith(":")) continue; // comentário (ping/connect do backend)
        const i = line.indexOf(":");
        const field = i < 0 ? line : line.slice(0, i);
        const val = i < 0 ? "" : line.slice(i + 1).replace(/^ /, "");
        if (field === "event") event = val;
        else if (field === "data") data.push(val);
      }
      if (data.length) onEvent({ event, data: data.join("\n") });
    }
  }
}
