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
    if (error.response.status === 403 && !data?.message) {
      return "Você não tem permissão para fazer isso.";
    }
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
