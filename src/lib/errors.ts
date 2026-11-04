import { AxiosError } from "axios";
import type { ErrorResponse } from "@/types/api";

/** Extrai uma mensagem legível do ErrorResponse do GlobalExceptionHandler. */
export function getErrorMessage(error: unknown, fallback = "Algo deu errado"): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ErrorResponse | undefined;
    if (!error.response) return "Não foi possível falar com o servidor. O backend está rodando?";
    if (data?.fields && Object.keys(data.fields).length) {
      return Object.entries(data.fields)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(" · ");
    }
    const status = error.response.status;
    const url = error.config?.url ?? "";
    if (status === 403 && !data?.message && error.config?.method === "post" && url.startsWith("/stock/movements")) {
      // o matcher "/stock/" do SecurityConfig não cobre /stock/movements/**, então cai no ADMINISTRATOR
      return "O backend ainda só libera movimentar estoque para administradores.";
    }
    if (status === 403 && !data?.message) {
      return "Você não tem permissão para fazer isso.";
    }
    // @Version no Ticket: outra pessoa mexeu no chamado ao mesmo tempo
    if (status === 409 && url.startsWith("/tickets")) {
      return "O chamado foi alterado por outra pessoa. Recarregue a página e tente de novo.";
    }
    // assign/function/deactivate no próprio usuário
    if (status === 409 && /^\/users\/[^/]+\/(assign|function|deactivate)$/.test(url)) {
      return "Você não pode alterar o próprio papel, função ou status.";
    }
    if (status === 401 && /inactive/i.test(data?.message ?? "")) {
      return "Sua conta ainda está inativa. Aguarde a ativação por um administrador.";
    }
    if (url === "/auth/login" && status === 404) return "Usuário não encontrado.";
    if (url === "/auth/login" && status === 401) return "Usuário ou senha incorretos.";
    if (status === 502 && !data?.message) return "Erro inesperado no servidor. Tente de novo em instantes.";
    return data?.message || data?.error || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof AxiosError) {
    return (error.response?.data as ErrorResponse | undefined)?.fields ?? {};
  }
  return {};
}

export function getStatus(error: unknown): number | undefined {
  return error instanceof AxiosError ? error.response?.status : undefined;
}
