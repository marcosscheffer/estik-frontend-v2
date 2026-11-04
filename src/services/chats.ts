import { api, apiBaseURL } from "@/lib/api";
import type { MessageResponse, PageParams, PageResult, SendMessageRequest, UUID } from "@/types/api";

/** Tipos de anexo aceitos pelo backend. */
export const ACCEPTED_FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
export const MAX_CONTENT = 2000;

/** fileUrl vem relativo ("/files/{id}?expires=..&signature=..") e é público. */
export function fileSrc(fileUrl: string): string {
  if (/^https?:\/\//.test(fileUrl)) return fileUrl;
  return `${apiBaseURL}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
}

/** Devolve a mensagem de erro do primeiro arquivo inválido, ou null. */
export function validateFiles(files: File[]): string | null {
  let total = 0;
  for (const f of files) {
    if (!(ACCEPTED_FILE_TYPES as readonly string[]).includes(f.type)) return `"${f.name}": só PNG, JPEG, WEBP ou PDF.`;
    if (f.size > MAX_FILE_BYTES) return `"${f.name}" passa de 10 MB.`;
    total += f.size;
  }
  if (total > MAX_TOTAL_BYTES) return "Os anexos juntos passam de 30 MB.";
  return null;
}

export const chatsService = {
  /** A página vem sem ordem garantida: quem usa ordena por createdAt. */
  messages: (chatId: UUID, params: PageParams) =>
    api.get<PageResult<MessageResponse>>(`/chats/${chatId}/messages`, { params }).then((r) => r.data),

  /** multipart: parte "message" (JSON) + partes "files". O axios monta o boundary. */
  send: (chatId: UUID, body: SendMessageRequest, files: File[] = []) => {
    const form = new FormData();
    form.append("message", new Blob([JSON.stringify(body)], { type: "application/json" }));
    for (const f of files) form.append("files", f, f.name);
    return api.post<MessageResponse>(`/chats/${chatId}/messages`, form).then((r) => r.data);
  },
};
